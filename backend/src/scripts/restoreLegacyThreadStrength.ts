/**
 * Thread Strength 2.1 — one-time legacy baseline restoration.
 *
 * The 2.0 recalculation (recalculateThreadStrength2.ts) deleted every ThreadV2Movement and
 * overwrote ThreadV2State.strength, so the only in-database record of pre-2.0 strength is the
 * append-only ThreadEventLedger (`THREAD_STRENGTHENED.metadata.afterStrength`, upserted with
 * `update: {}` so rows written by the old formula survived the recalculation).
 *
 * This script NEVER guesses. For each Anchor it takes the last ledger event created strictly
 * before `--cutoff` (the moment the 2.0 recalculation ran), cross-checks it against the
 * Anchor's own practice session, and records it as a protected baseline on ThreadV2State.
 * Anchors without such an event are reported as unrecoverable and left untouched.
 *
 * Default is a dry run. `--apply` writes. Safe to re-run: Anchors that already carry
 * legacy_baseline_applied_at are skipped.
 *
 *   ts-node src/scripts/restoreLegacyThreadStrength.ts --cutoff 2026-10-25T00:00:00Z [--apply] [--report out.json]
 */
import { writeFileSync } from 'fs';
import { prisma } from '../lib/prisma';
import {
  threadStrengthService,
  resolveLocalDateKeyFromDate,
  roundToPrecision,
  MAX_STRENGTH,
  MIN_STRENGTH,
  LegacyBaseline,
  ThreadStrengthSensitivity,
  DecayPreferenceHistoryEntry,
} from '../services/v2/ThreadStrengthService';

export type LegacyEventCandidate = {
  id: string;
  occurredAt: Date;
  createdAt: Date;
  ledgerSequence: bigint | number;
  sourceEntityId: string | null;
  metadata: unknown;
};

export type LegacySessionRecord = {
  id: string;
  userId: string;
  anchorId: string | null;
  completedAt: Date;
  localDateKey: string | null;
  timeZone: string | null;
  completionStatus: string;
};

export type BaselineSelection =
  | { ok: true; baseline: LegacyBaseline; sessionId: string; source: string }
  | { ok: false; reason: string };

function readAfterStrength(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>).afterStrength;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < MIN_STRENGTH || value > MAX_STRENGTH) return null;
  return value;
}

/**
 * Pure selection of the protected baseline from pre-cutoff ledger events. An event only
 * qualifies if its source session exists, is completed, and belongs to the same user AND anchor
 * (prevents attributing one Anchor's score to another).
 */
export function selectLegacyBaseline(input: {
  userId: string;
  anchorId: string;
  cutoff: Date;
  events: readonly LegacyEventCandidate[];
  sessionsById: ReadonlyMap<string, LegacySessionRecord>;
}): BaselineSelection {
  const preCutoff = input.events
    .filter(e => e.createdAt.getTime() < input.cutoff.getTime())
    .sort((a, b) => {
      const diff = a.occurredAt.getTime() - b.occurredAt.getTime();
      return diff !== 0 ? diff : Number(a.ledgerSequence) - Number(b.ledgerSequence);
    });
  if (preCutoff.length === 0) return { ok: false, reason: 'no_pre_cutoff_ledger_event' };

  const last = preCutoff[preCutoff.length - 1];
  const afterStrength = readAfterStrength(last.metadata);
  if (afterStrength === null) return { ok: false, reason: 'ledger_event_missing_valid_afterStrength' };
  if (!last.sourceEntityId) return { ok: false, reason: 'ledger_event_missing_session' };

  const session = input.sessionsById.get(last.sourceEntityId);
  if (!session) return { ok: false, reason: 'source_session_not_found' };
  if (session.userId !== input.userId || session.anchorId !== input.anchorId) {
    return { ok: false, reason: 'source_session_belongs_to_other_anchor' };
  }
  if (session.completionStatus !== 'completed') return { ok: false, reason: 'source_session_not_completed' };

  const dateKey =
    session.localDateKey || resolveLocalDateKeyFromDate(session.completedAt, session.timeZone || 'UTC');
  return {
    ok: true,
    sessionId: session.id,
    source: `thread_event_ledger:${last.id}`,
    baseline: {
      strength: roundToPrecision(afterStrength, 4),
      completedAt: session.completedAt,
      dateKey,
    },
  };
}

export type RestoreOutcome = {
  userId: string;
  anchorId: string;
  status: 'restored' | 'would_restore' | 'unrecoverable' | 'already_applied' | 'legacy_not_higher';
  reason?: string;
  legacyBaseline?: number;
  currentWithout?: number | null;
  currentWith?: number | null;
  source?: string;
};

export async function restoreLegacyThreadStrength(options: {
  cutoff: Date;
  apply: boolean;
  asOf?: Date;
}): Promise<RestoreOutcome[]> {
  const asOf = options.asOf ?? new Date();
  const states = await prisma.threadV2State.findMany({
    select: { userId: true, anchorId: true, legacyBaselineAppliedAt: true },
  });
  const outcomes: RestoreOutcome[] = [];

  for (const state of states) {
    const { userId, anchorId } = state;
    if (state.legacyBaselineAppliedAt) {
      outcomes.push({ userId, anchorId, status: 'already_applied' });
      continue;
    }

    const events = await prisma.threadEventLedger.findMany({
      where: { userId, anchorId, eventType: 'THREAD_STRENGTHENED', createdAt: { lt: options.cutoff } },
      select: {
        id: true,
        occurredAt: true,
        createdAt: true,
        ledgerSequence: true,
        sourceEntityId: true,
        metadata: true,
      },
    });
    const sessionIds = events.map(e => e.sourceEntityId).filter((id): id is string => !!id);
    const sessions = sessionIds.length
      ? await prisma.practiceSession.findMany({
          where: { id: { in: sessionIds } },
          select: {
            id: true,
            userId: true,
            anchorId: true,
            completedAt: true,
            localDateKey: true,
            timeZone: true,
            completionStatus: true,
          },
        })
      : [];
    const selection = selectLegacyBaseline({
      userId,
      anchorId,
      cutoff: options.cutoff,
      events,
      sessionsById: new Map(sessions.map(s => [s.id, s])),
    });
    if (!selection.ok) {
      outcomes.push({ userId, anchorId, status: 'unrecoverable', reason: selection.reason });
      continue;
    }

    // Compare what the user sees now with what the baseline would produce.
    const movements = await prisma.threadV2Movement.findMany({
      where: { userId, anchorId },
      orderBy: [{ completedAt: 'asc' }, { sessionId: 'asc' }],
    });
    const movementSessions = movements.length
      ? await prisma.practiceSession.findMany({
          where: { id: { in: movements.map(m => m.sessionId) } },
          select: { id: true, localDateKey: true, timeZone: true, completedAt: true, completedDurationSeconds: true },
        })
      : [];
    const dateMap = new Map(
      movementSessions.map(s => [s.id, s.localDateKey || resolveLocalDateKeyFromDate(s.completedAt, s.timeZone)])
    );
    const durationMap = new Map(movementSessions.map(s => [s.id, s.completedDurationSeconds ?? 0]));
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { threadStrengthSensitivity: true, decayPreferencesHistory: true, restDays: true },
    });
    const sensitivity = (settings?.threadStrengthSensitivity as ThreadStrengthSensitivity) || 'balanced';
    const history = (settings?.decayPreferencesHistory as DecayPreferenceHistoryEntry[] | null) || null;
    const restDays = settings?.restDays || [];
    const current = (baseline: LegacyBaseline | null) =>
      threadStrengthService.calculateStrengthAtDate(
        asOf,
        movements,
        asOf,
        restDays,
        'UTC',
        dateMap,
        durationMap,
        sensitivity,
        history,
        { baseline }
      );
    const currentWithout = current(null);
    // A baseline-only anchor (no movements after it) still needs a movement list; fall back
    // to a synthetic covered movement so the baseline replays and decays.
    const withBaseline = (() => {
      const base = selection.baseline;
      const list = movements.length
        ? movements
        : [{ sessionId: selection.sessionId, practiceType: 'focus', completedAt: base.completedAt }];
      return threadStrengthService.calculateStrengthAtDate(
        asOf,
        list,
        asOf,
        restDays,
        'UTC',
        dateMap,
        durationMap,
        sensitivity,
        history,
        { baseline: base }
      );
    })();

    if (withBaseline === null || (currentWithout !== null && withBaseline <= currentWithout)) {
      outcomes.push({
        userId,
        anchorId,
        status: 'legacy_not_higher',
        legacyBaseline: selection.baseline.strength,
        currentWithout,
        currentWith: withBaseline,
        source: selection.source,
      });
      continue;
    }

    if (!options.apply) {
      outcomes.push({
        userId,
        anchorId,
        status: 'would_restore',
        legacyBaseline: selection.baseline.strength,
        currentWithout,
        currentWith: withBaseline,
        source: selection.source,
      });
      continue;
    }

    // Idempotent: only the first writer (applied_at IS NULL) wins.
    const written = await prisma.threadV2State.updateMany({
      where: { userId, anchorId, legacyBaselineAppliedAt: null },
      data: {
        legacyBaselineStrength: selection.baseline.strength,
        legacyBaselineAt: selection.baseline.completedAt,
        legacyBaselineDateKey: selection.baseline.dateKey,
        legacyBaselineSessionId: selection.sessionId,
        legacyBaselineSource: selection.source,
        legacyBaselineAppliedAt: new Date(),
        // Legacy anchors never get the +12 retroactively.
        activationStatus: 'legacy_exempt',
      },
    });
    if (written.count === 0) {
      outcomes.push({ userId, anchorId, status: 'already_applied' });
      continue;
    }
    await threadStrengthService.getAnchorThreadState(userId, anchorId, asOf);
    outcomes.push({
      userId,
      anchorId,
      status: 'restored',
      legacyBaseline: selection.baseline.strength,
      currentWithout,
      currentWith: withBaseline,
      source: selection.source,
    });
  }
  return outcomes;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (require.main === module) {
  const cutoffArg = argValue('--cutoff');
  if (!cutoffArg || Number.isNaN(Date.parse(cutoffArg))) {
    console.error('--cutoff <ISO timestamp of the 2.0 recalculation run> is required.');
    process.exit(1);
  }
  const apply = process.argv.includes('--apply');
  restoreLegacyThreadStrength({ cutoff: new Date(cutoffArg), apply })
    .then(outcomes => {
      const summary = outcomes.reduce<Record<string, number>>((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      }, {});
      console.log(apply ? 'APPLIED' : 'DRY RUN', summary);
      const report = argValue('--report');
      if (report) writeFileSync(report, JSON.stringify({ cutoff: cutoffArg, apply, summary, outcomes }, null, 2));
    })
    .catch(err => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
