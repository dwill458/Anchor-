/**
 * Weekly Insight 2.0 — the one server-side calculation engine.
 *
 * Reads canonical tables (never the phone), hands plain records to the pure composer in `domain/v2/weeklyRecap`, and
 * persists the result as a GLOBAL snapshot with a draft → final lifecycle:
 *
 *   - A FINAL snapshot is immutable and is returned as stored. It is never recomputed.
 *   - A DRAFT is recomputed on every read and written with a conditional update (`WHERE status = 'DRAFT'`).
 *   - Finalization is lazy (first read after Tuesday 12:00 local) and conditional, so concurrent readers produce
 *     exactly one winner. A recap built from incomplete data never finalizes.
 *   - Week identity is (user, 'GLOBAL', weekKey). The IANA zone is captured with the first snapshot and then reused,
 *     so every device sees the same seven days.
 *
 * Progress stays per Anchor and is not read here.
 */
import {
  composeWeeklyRecap, DataDomain, RecapSource, WeeklyRecapV2, AnchorRef, CourseRecord, MilestoneRecord, MoveRecord, PracticeRecord,
  VisionRecord, WaypointRecord, AnchorEventRecord,
} from '../../domain/v2/weeklyRecap';
import {
  RecapPhase, isMondayKey, isValidTimeZone, latestRecapWeek, phaseOfWeek, weekBounds,
} from '../../domain/v2/weeklyRecapTime';

export class WeeklyRecapError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
  }
}

// ---- Ports ----------------------------------------------------------------------------------------------------------
export type RecapReader = {
  hasAnyHistory(userId: string): Promise<boolean>;
  practices(userId: string, from: Date, to: Date): Promise<PracticeRecord[]>;
  priorPracticeAt(userId: string, before: Date): Promise<Date | null>;
  chart(userId: string, from: Date, to: Date): Promise<{ waypoints: WaypointRecord[]; courses: CourseRecord[] }>;
  moves(userId: string, from: Date, to: Date): Promise<MoveRecord[]>;
  completions(userId: string, from: Date, to: Date): Promise<AnchorEventRecord[]>;
  releases(userId: string, from: Date, to: Date): Promise<AnchorEventRecord[]>;
  milestones(userId: string, from: Date, to: Date): Promise<MilestoneRecord[]>;
  visions(userId: string, from: Date, to: Date): Promise<VisionRecord[]>;
  anchors(userId: string, ids: string[]): Promise<AnchorRef[]>;
};

export type SnapshotRow = {
  id: string; userId: string; weekKey: string; timeZone: string; status: 'DRAFT' | 'FINAL'; provenance: 'LIVE' | 'RECONSTRUCTED';
  snapshot: WeeklyRecapV2; feedback: string | null; finalizedAt: Date | null; updatedAt: Date;
};
export type SnapshotStore = {
  find(userId: string, weekKey: string): Promise<SnapshotRow | null>;
  /** Returns null when another request created the row first (unique violation). */
  create(input: { userId: string; weekKey: string; timeZone: string; startUtc: Date; endUtc: Date; recap: WeeklyRecapV2 }): Promise<SnapshotRow | null>;
  /** Conditional on status = DRAFT. Returns false when the row was finalized (or removed) meanwhile. */
  updateDraft(id: string, recap: WeeklyRecapV2): Promise<boolean>;
  /** Conditional on status = DRAFT. Exactly one concurrent caller gets true. */
  finalize(id: string, recap: WeeklyRecapV2, at: Date): Promise<boolean>;
  list(userId: string, opts: { before?: string; limit: number }): Promise<SnapshotRow[]>;
};

export type RecapResult =
  | { kind: 'RECAP'; id: string; recap: WeeklyRecapV2; feedback: string | null; updatedAt: Date }
  | { kind: 'NO_HISTORY'; weekKey: string; timeZone: string };

// ---- Collection -----------------------------------------------------------------------------------------------------
const PRACTICE_WIDEN_MS = 14 * 3_600_000; // UTC offsets span −12h…+14h; the exact filter is localDateKey.

export async function collectSource(
  reader: RecapReader,
  args: { userId: string; weekKey: string; timeZone: string; now: Date; phase: RecapPhase; provenance: 'LIVE' | 'RECONSTRUCTED' }
): Promise<RecapSource> {
  const { userId, weekKey, timeZone } = args;
  const { startUtc, endUtc } = weekBounds(weekKey, timeZone);
  const failed = new Set<DataDomain>();
  const settle = async <T>(domain: DataDomain, work: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await work(); } catch { failed.add(domain); return fallback; }
  };
  const [history, practices, prior, chart, moves, completions, releases, milestones, visions] = await Promise.all([
    settle('PRACTICE', () => reader.hasAnyHistory(userId), true),
    settle('PRACTICE', () => reader.practices(userId, new Date(startUtc.getTime() - PRACTICE_WIDEN_MS), new Date(endUtc.getTime() + PRACTICE_WIDEN_MS)), []),
    settle('PRACTICE', () => reader.priorPracticeAt(userId, startUtc), null),
    settle('CHART', () => reader.chart(userId, startUtc, endUtc), { waypoints: [], courses: [] }),
    settle('MOVES', () => reader.moves(userId, startUtc, endUtc), []),
    settle('ANCHOR_LIFECYCLE', () => reader.completions(userId, startUtc, endUtc), []),
    settle('ANCHOR_LIFECYCLE', () => reader.releases(userId, startUtc, endUtc), []),
    settle('MILESTONES', () => reader.milestones(userId, startUtc, endUtc), []),
    settle('VISION', () => reader.visions(userId, startUtc, endUtc), []),
  ]);
  const ids = new Set<string>();
  [...chart.waypoints, ...chart.courses, ...moves].forEach(r => r.anchorId && ids.add(r.anchorId));
  [...completions, ...releases, ...milestones, ...visions].forEach(r => r.anchorId && ids.add(r.anchorId));
  practices.forEach(p => p.anchorId && ids.add(p.anchorId));
  const anchors = await settle('ANCHOR_LIFECYCLE', () => reader.anchors(userId, [...ids]), []);
  return {
    userId, weekKey, timeZone, now: args.now, phase: args.phase, provenance: args.provenance, hasAnyHistory: history,
    practices, priorPracticeAt: prior, waypoints: chart.waypoints, courses: chart.courses, moves, completions, releases, milestones,
    visions, anchors, failedDomains: [...failed],
  };
}

// ---- Service --------------------------------------------------------------------------------------------------------
export class WeeklyRecapService {
  constructor(private readonly reader: RecapReader, private readonly store: SnapshotStore, private readonly clock: () => Date = () => new Date()) {}

  async get(userId: string, request: { weekKey: 'latest' | string; timeZone: unknown }): Promise<RecapResult> {
    if (!isValidTimeZone(request.timeZone)) throw new WeeklyRecapError('A valid IANA timeZone is required.', 400, 'INVALID_TIME_ZONE');
    const requestZone = request.timeZone;
    const now = this.clock();
    let weekKey: string;
    if (request.weekKey === 'latest') weekKey = latestRecapWeek(now, requestZone).weekKey;
    else if (isMondayKey(request.weekKey)) weekKey = request.weekKey;
    else throw new WeeklyRecapError('weekKey must be a Monday (YYYY-MM-DD).', 400, 'INVALID_WEEK_KEY');

    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await this.store.find(userId, weekKey);
      // A FINAL snapshot is returned exactly as stored, whatever device or zone is asking.
      if (existing?.status === 'FINAL') return this.asResult(existing);

      const timeZone = existing?.timeZone ?? requestZone;
      const phase = phaseOfWeek(weekKey, now, timeZone);
      if (phase === 'NOT_YET') throw new WeeklyRecapError('That week is not available yet.', 404, 'WEEK_NOT_AVAILABLE');
      const provenance = existing?.provenance ?? (phase === 'FINAL' ? 'RECONSTRUCTED' : 'LIVE');
      const source = await collectSource(this.reader, { userId, weekKey, timeZone, now, phase, provenance });
      const recap = composeWeeklyRecap(source);
      if (!recap) return { kind: 'NO_HISTORY', weekKey, timeZone };

      if (!existing) {
        const { startUtc, endUtc } = weekBounds(weekKey, timeZone);
        const created = await this.store.create({ userId, weekKey, timeZone, startUtc, endUtc, recap });
        if (created) return this.asResult(created);
        continue; // another device won the create; read theirs and reconcile
      }
      const won = recap.finalizable ? await this.store.finalize(existing.id, recap, now) : await this.store.updateDraft(existing.id, recap);
      if (won) return { kind: 'RECAP', id: existing.id, recap, feedback: existing.feedback, updatedAt: now };
      // Lost a race with a finalizer: loop and return what is stored.
    }
    throw new WeeklyRecapError('Weekly Insight is busy. Try again.', 409, 'RECAP_CONFLICT');
  }

  async history(userId: string, opts: { before?: string; limit?: number }) {
    const limit = Math.min(Math.max(opts.limit ?? 26, 1), 52);
    const rows = await this.store.list(userId, { before: opts.before, limit: limit + 1 });
    const page = rows.slice(0, limit);
    return {
      items: page.map(r => ({
        id: r.id, weekKey: r.weekKey, label: r.snapshot.range.label, status: r.status, heroKind: r.snapshot.hero.kind,
        headline: r.snapshot.opening.headline, provisional: r.status !== 'FINAL', schemaVersion: 2,
      })),
      nextCursor: rows.length > limit ? page[page.length - 1].weekKey : null,
    };
  }

  private asResult(row: SnapshotRow): RecapResult {
    return { kind: 'RECAP', id: row.id, recap: row.snapshot, feedback: row.feedback, updatedAt: row.updatedAt };
  }
}

