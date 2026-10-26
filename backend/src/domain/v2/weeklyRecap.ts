/**
 * Weekly Insight 2.0 — the domain contract and the pure composer. No I/O, no clock, no randomness.
 *
 * The server decides what happened; the phone decides how it looks. Everything here is derived from canonical source
 * records handed in by `WeeklyRecapService`. Rules that keep the story truthful:
 *
 *  1. Every counted fact has one canonical source row, counted once (`dedupeKey`):
 *       practice  → PracticeSession.id          waypoint → Waypoint.id (reachedAt)
 *       move      → Move.id (completedAt)       destination → Course.id (completedAt)
 *       completed → Anchor.id + intentionCompletedAt   released → Anchor.id + releasedAt
 *     CourseEvent, ThreadEventLedger and AnchorMilestone rows describe the SAME actions and are never added to totals;
 *     a milestone whose source entity is already included becomes a label on it.
 *  2. A completed Move is meaningful progress. Moves tied to a waypoint reached the same week are folded into that
 *     waypoint (they still count once in the MOVES total); the rest make a MOVES_PROGRESS recap on their own, so a week
 *     of finished moves with no waypoint is never reported as quiet.
 *  3. A failed or missing source domain is reported in `dataQuality.missing` and omitted from stats. It is never coerced
 *     to zero, never produces "a quiet week", and prevents finalization.
 *  4. Archiving is not releasing: only `releasedAt` creates a release fact.
 *  5. Reflection copy is template-driven from the facts above. No inferred emotion, identity, streak or invented trend.
 */
import {
  RecapPhase,
  localDateKeyOf,
  weekBounds,
  weekRangeLabel,
  weekdayOfKey,
} from './weeklyRecapTime';

export const RECAP_VERSION = 2;
export const TEMPLATE_VERSION = 1;
export const PRACTICE_WEEK_MIN_DAYS = 4;
export const RETURN_MIN_GAP_DAYS = 14;
export const MAX_HIGHLIGHTS = 3;
export const MAX_ANCHOR_ROWS = 4;

export type DataDomain =
  | 'PRACTICE'
  | 'CHART'
  | 'MOVES'
  | 'ANCHOR_LIFECYCLE'
  | 'MILESTONES'
  | 'VISION';

export type HeroKind =
  | 'DESTINATION_REACHED'
  | 'ANCHOR_COMPLETED_RELEASED'
  | 'ANCHOR_RELEASED'
  | 'ANCHOR_COMPLETED'
  | 'WAYPOINT_REACHED'
  | 'MOVES_PROGRESS'
  | 'STRENGTH_MILESTONE'
  | 'VISION_MILESTONE'
  | 'PRACTICE_COUNT_MILESTONE'
  | 'PRACTICE_WEEK'
  | 'RETURN'
  | 'STEADY'
  | 'QUIET'
  | 'INCOMPLETE';

// ---- Source records (what the service reads) ------------------------------------------------------------------------
export type PracticeRecord = {
  id: string;
  anchorId: string | null;
  localDateKey: string;
  mode: string;
  completedAt: Date;
};
export type WaypointRecord = {
  id: string;
  courseId: string;
  anchorId: string | null;
  title: string;
  reachedAt: Date;
};
export type CourseRecord = {
  id: string;
  anchorId: string | null;
  destination: string;
  waypointTotal: number;
  /** Waypoints reached up to the end of the week (for ordering ties). */
  waypointsReached: number;
  finalWaypointId: string | null;
  completedAt: Date | null;
  routeScope: string;
};
export type MoveRecord = {
  id: string;
  courseId: string;
  waypointId: string;
  anchorId: string | null;
  title: string;
  completedAt: Date;
};
export type AnchorEventRecord = { anchorId: string; at: Date };
export type MilestoneRecord = {
  id: string;
  anchorId: string;
  definitionId: string;
  earnedAt: Date;
  sourceEntityId: string | null;
};
export type VisionRecord = {
  id: string;
  kind: 'FIRST' | 'BOARD';
  anchorId: string | null;
  at: Date;
};
export type AnchorRef = { id: string; intention: string; categoryKey: string; isReleased: boolean };

export type RecapSource = {
  userId: string;
  weekKey: string;
  timeZone: string;
  now: Date;
  phase: RecapPhase;
  provenance: 'LIVE' | 'RECONSTRUCTED';
  /** Whether the account has ever completed a practice or recorded any event; false → no recap at all. */
  hasAnyHistory: boolean;
  practices: PracticeRecord[];
  /** Latest completed practice strictly before the week (for RETURN). */
  priorPracticeAt: Date | null;
  waypoints: WaypointRecord[];
  courses: CourseRecord[];
  moves: MoveRecord[];
  completions: AnchorEventRecord[];
  releases: AnchorEventRecord[];
  milestones: MilestoneRecord[];
  visions: VisionRecord[];
  anchors: AnchorRef[];
  failedDomains: DataDomain[];
};

// ---- Output contract ------------------------------------------------------------------------------------------------
export type HeroOrHighlight = {
  kind: HeroKind;
  dedupeKey: string;
  anchorId: string | null;
  courseId?: string | null;
  title: string;
  dateKey: string | null;
  count?: number;
  /** Moves completed toward this waypoint during the week (folded in, not counted again). */
  movesCompleted?: number;
  labels: string[];
};

export type StatId =
  | 'PRACTICE_DAYS'
  | 'PRACTICES'
  | 'WAYPOINTS'
  | 'MOVES'
  | 'COMPLETED'
  | 'RELEASED'
  | 'MILESTONES';
export type MarkerKind =
  | 'WAYPOINT'
  | 'DESTINATION'
  | 'MOVE'
  | 'COMPLETED'
  | 'RELEASED'
  | 'VISION'
  | 'MILESTONE';

export type WeeklyRecapV2 = {
  recapVersion: 2;
  templateVersion: number;
  weekKey: string;
  timeZone: string;
  range: { startKey: string; endKey: string; label: string };
  status: 'DRAFT' | 'FINAL';
  /** True while the week is still in progress, still syncing, or built from incomplete data. */
  provisional: {
    isProvisional: boolean;
    reason: 'WEEK_IN_PROGRESS' | 'SYNCING' | 'INCOMPLETE_DATA' | null;
  };
  /** Final only when the lifecycle says so AND every source domain loaded. */
  finalizable: boolean;
  provenance: 'LIVE' | 'RECONSTRUCTED';
  opening: { headline: string; summary: string };
  hero: HeroOrHighlight;
  stats: Array<{ id: StatId; value: number; of?: number }>;
  motion: Array<{
    dateKey: string;
    weekday: number;
    practices: Array<{ id: string; mode: string; anchorId: string | null }>;
    markers: Array<{ kind: MarkerKind; dedupeKey: string }>;
  }>;
  highlights: HeroOrHighlight[];
  /** Distinct candidates not shown as the hero or a highlight, so the displayed list reconciles with the totals. */
  highlightsOverflow: number;
  anchors: Array<{
    anchorId: string;
    practiceDays: number;
    practices: number;
    moves: number;
    waypoints: number;
  }>;
  anchorsOverflow: number;
  reflection: { templateId: string; text: string };
  refs: {
    anchors: Record<string, { intention: string; categoryKey: string; isReleased: boolean }>;
    charts: Record<string, { anchorId: string | null; destination: string; waypointTotal: number }>;
  };
  dataQuality: { missing: DataDomain[] };
};

// ---- Ranking tables -------------------------------------------------------------------------------------------------
const TIER: Record<HeroKind, number> = {
  DESTINATION_REACHED: 1,
  ANCHOR_COMPLETED_RELEASED: 2,
  ANCHOR_RELEASED: 2,
  ANCHOR_COMPLETED: 2,
  WAYPOINT_REACHED: 3,
  MOVES_PROGRESS: 4,
  STRENGTH_MILESTONE: 5,
  VISION_MILESTONE: 6,
  PRACTICE_COUNT_MILESTONE: 7,
  PRACTICE_WEEK: 8,
  RETURN: 9,
  STEADY: 10,
  QUIET: 11,
  INCOMPLETE: 12,
};
const STRENGTH_RANK: Record<string, number> = {
  'strength.full': 5,
  'strength.reinforced': 4,
  'strength.integrated': 3,
  'strength.established': 2,
  'strength.building': 1,
};
const COUNT_RANK: Record<string, number> = {
  'commitment.practices.100': 6,
  'commitment.minutes.500': 5,
  'vision.visualize.30': 4,
  'commitment.practices.30': 4,
  'commitment.minutes.100': 3,
  'commitment.practices.10': 2,
  'vision.visualize.10': 2,
  'commitment.practices.1': 1,
  'vision.visualize.1': 1,
};
const MILESTONE_LABEL: Record<string, string> = {
  'journey.waypoint.first': 'First waypoint',
  'journey.halfway': 'Halfway there',
  'journey.destination': 'Destination',
  'journey.goal': 'Intention completed',
  'commitment.practices.1': 'First practice',
  'commitment.practices.10': '10th practice',
  'commitment.practices.30': '30th practice',
  'commitment.practices.100': '100th practice',
  'commitment.minutes.100': '100 minutes practiced',
  'commitment.minutes.500': '500 minutes practiced',
  'strength.building': 'Thread building',
  'strength.established': 'Thread established',
  'strength.integrated': 'Thread integrated',
  'strength.reinforced': 'Thread reinforced',
  'strength.full': 'Thread at full strength',
  'vision.first': 'Vision created',
  'vision.board.complete': 'Vision board completed',
  'vision.visualize.1': 'First visualization',
  'vision.visualize.10': '10th visualization',
  'vision.visualize.30': '30th visualization',
};

// ---- Helpers --------------------------------------------------------------------------------------------------------
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
const pick = <T>(variants: T[], userId: string, weekKey: string, salt: string): T =>
  variants[fnv1a(`${userId}|${weekKey}|${salt}`) % variants.length];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const compare = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);

type Candidate = HeroOrHighlight & { rank: number; significance: number; at: number };

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Total order: tier, domain rank (higher first), significance (higher first), most recent, then dedupeKey. */
function orderCandidates(list: Candidate[]): Candidate[] {
  return [...list].sort(
    (a, b) =>
      compare(TIER[a.kind], TIER[b.kind]) ||
      compare(b.rank, a.rank) ||
      compare(b.significance, a.significance) ||
      compare(b.at, a.at) ||
      compare(a.dedupeKey, b.dedupeKey)
  );
}

export function composeWeeklyRecap(source: RecapSource): WeeklyRecapV2 | null {
  const { userId, weekKey, timeZone } = source;
  const bounds = weekBounds(weekKey, timeZone);
  const inWeek = (d: Date) => d >= bounds.startUtc && d < bounds.endUtc;
  const keySet = new Set(bounds.keys);
  const missing = Array.from(new Set(source.failedDomains)).sort() as DataDomain[];
  const down = (d: DataDomain) => missing.includes(d);
  const anchorById = new Map(source.anchors.map(a => [a.id, a]));
  const courseById = new Map(source.courses.map(c => [c.id, c]));

  // 1. Canonical, de-duplicated, in-range facts. -------------------------------------------------------------------
  const practices = dedupeBy(
    source.practices.filter(p => keySet.has(p.localDateKey)),
    p => p.id
  );
  const waypoints = dedupeBy(
    source.waypoints.filter(w => inWeek(w.reachedAt)),
    w => w.id
  );
  const moves = dedupeBy(
    source.moves.filter(m => inWeek(m.completedAt)),
    m => m.id
  );
  const completions = dedupeBy(
    source.completions.filter(e => inWeek(e.at)),
    e => e.anchorId
  );
  const releases = dedupeBy(
    source.releases.filter(e => inWeek(e.at)),
    e => e.anchorId
  );
  const destinations = dedupeBy(
    source.courses.filter(
      c => c.completedAt && inWeek(c.completedAt) && c.routeScope !== 'NEXT_STRETCH'
    ),
    c => c.id
  );
  const milestones = dedupeBy(
    source.milestones.filter(m => inWeek(m.earnedAt)),
    m => m.id
  );
  const visions = dedupeBy(
    source.visions.filter(v => inWeek(v.at)),
    v => `${v.kind}:${v.id}`
  );

  const practiceDays = new Set(practices.map(p => p.localDateKey));
  const anyEvent =
    waypoints.length +
      moves.length +
      completions.length +
      releases.length +
      destinations.length +
      milestones.length +
      visions.length >
    0;
  if (!source.hasAnyHistory && practices.length === 0 && !anyEvent && missing.length === 0)
    return null;

  // 2. Association: moves folded into waypoints reached this week; destination absorbs its final waypoint. -------------
  const destinationFinalIds = new Set(
    destinations.map(d => d.finalWaypointId).filter((x): x is string => !!x)
  );
  const reachedIds = new Set(waypoints.map(w => w.id));
  const movesByWaypoint = new Map<string, number>();
  const unassociatedMoves = moves.filter(m => {
    if (!reachedIds.has(m.waypointId)) return true;
    movesByWaypoint.set(m.waypointId, (movesByWaypoint.get(m.waypointId) ?? 0) + 1);
    return false;
  });
  const dateKeyOf = (d: Date) => localDateKeyOf(d, timeZone);

  // Labels from milestones whose source is already an included entity; the rest may become candidates.
  // Practice sessions are not candidates themselves, so a practice-sourced milestone stays an achievement of its own
  // (totals still come from PracticeSession rows, so nothing is added twice).
  const includedEntityIds = new Set<string>([
    ...waypoints.map(w => w.id),
    ...destinations.map(d => d.id),
  ]);
  const labelsByEntity = new Map<string, string[]>();
  const standalone: MilestoneRecord[] = [];
  for (const m of milestones) {
    if (m.sourceEntityId && includedEntityIds.has(m.sourceEntityId)) {
      const list = labelsByEntity.get(m.sourceEntityId) ?? [];
      const label = MILESTONE_LABEL[m.definitionId];
      if (label && !list.includes(label)) list.push(label);
      labelsByEntity.set(m.sourceEntityId, list.sort());
    } else standalone.push(m);
  }

  // 3. Candidates. ------------------------------------------------------------------------------------------------------
  const candidates: Candidate[] = [];
  const anchorTitle = (id: string | null) =>
    id ? (anchorById.get(id)?.intention ?? 'Your Anchor') : 'Your Anchor';

  for (const c of destinations) {
    candidates.push({
      kind: 'DESTINATION_REACHED',
      dedupeKey: `destination:${c.id}`,
      anchorId: c.anchorId,
      courseId: c.id,
      title: c.destination,
      dateKey: dateKeyOf(c.completedAt!),
      labels: labelsByEntity.get(c.id) ?? [],
      rank: c.waypointTotal,
      significance: 4,
      at: c.completedAt!.getTime(),
    });
  }

  const releasedIds = new Set(releases.map(r => r.anchorId));
  const completedIds = new Set(completions.map(r => r.anchorId));
  for (const id of new Set([...releasedIds, ...completedIds])) {
    const both = releasedIds.has(id) && completedIds.has(id);
    const at = Math.max(
      ...[releases, completions].flatMap(l =>
        l.filter(e => e.anchorId === id).map(e => e.at.getTime())
      )
    );
    candidates.push({
      kind: both
        ? 'ANCHOR_COMPLETED_RELEASED'
        : releasedIds.has(id)
          ? 'ANCHOR_RELEASED'
          : 'ANCHOR_COMPLETED',
      dedupeKey: `anchor:${id}:${both ? 'completed+released' : releasedIds.has(id) ? 'released' : 'completed'}`,
      anchorId: id,
      title: anchorTitle(id),
      dateKey: dateKeyOf(new Date(at)),
      labels: [],
      rank: both ? 2 : releasedIds.has(id) ? 1 : 0,
      significance: 4,
      at,
    });
  }

  // Waypoints: the final waypoint of a destination reached this week is covered by that destination.
  const waypointCandidates = waypoints.filter(w => !destinationFinalIds.has(w.id));
  for (const w of waypointCandidates) {
    const course = courseById.get(w.courseId);
    candidates.push({
      kind: 'WAYPOINT_REACHED',
      dedupeKey: `waypoint:${w.id}`,
      anchorId: w.anchorId ?? course?.anchorId ?? null,
      courseId: w.courseId,
      title: w.title,
      dateKey: dateKeyOf(w.reachedAt),
      labels: labelsByEntity.get(w.id) ?? [],
      movesCompleted: movesByWaypoint.get(w.id) || undefined,
      rank: course && course.waypointTotal > 0 ? course.waypointsReached / course.waypointTotal : 0,
      significance: 3,
      at: w.reachedAt.getTime(),
    });
  }

  if (unassociatedMoves.length > 0) {
    const latest = unassociatedMoves.reduce((a, b) => (b.completedAt > a.completedAt ? b : a));
    const anchors = Array.from(
      new Set(unassociatedMoves.map(m => m.anchorId).filter((x): x is string => !!x))
    ).sort();
    candidates.push({
      kind: 'MOVES_PROGRESS',
      dedupeKey: `moves:${weekKey}`,
      anchorId: anchors.length === 1 ? anchors[0] : null,
      courseId:
        new Set(unassociatedMoves.map(m => m.courseId)).size === 1
          ? unassociatedMoves[0].courseId
          : null,
      title:
        unassociatedMoves.length === 1
          ? unassociatedMoves[0].title
          : plural(unassociatedMoves.length, 'move'),
      dateKey: dateKeyOf(latest.completedAt),
      count: unassociatedMoves.length,
      labels: [],
      rank: unassociatedMoves.length,
      significance: 2,
      at: latest.completedAt.getTime(),
    });
  }

  for (const m of standalone) {
    const label = MILESTONE_LABEL[m.definitionId];
    if (!label) continue;
    const family = m.definitionId.split('.')[0];
    const base = {
      anchorId: m.anchorId,
      title: label,
      dateKey: dateKeyOf(m.earnedAt),
      labels: [],
      at: m.earnedAt.getTime(),
      dedupeKey: `milestone:${m.id}`,
    };
    if (family === 'strength')
      candidates.push({
        ...base,
        kind: 'STRENGTH_MILESTONE',
        rank: STRENGTH_RANK[m.definitionId] ?? 0,
        significance: 2,
      });
    else if (
      family === 'vision' &&
      (m.definitionId === 'vision.first' || m.definitionId === 'vision.board.complete')
    )
      candidates.push({
        ...base,
        kind: 'VISION_MILESTONE',
        rank: m.definitionId === 'vision.board.complete' ? 2 : 1,
        significance: 2,
      });
    else if (COUNT_RANK[m.definitionId])
      candidates.push({
        ...base,
        kind: 'PRACTICE_COUNT_MILESTONE',
        rank: COUNT_RANK[m.definitionId],
        significance: 1,
      });
    // journey.* milestones restate waypoint/destination/intention facts and are never separate candidates.
  }
  for (const v of visions) {
    // A Vision milestone row for the same moment would double it; the milestone wins, the raw Vision fact fills in without it.
    const hasMilestone = standalone.some(
      m =>
        m.anchorId === v.anchorId &&
        m.definitionId === (v.kind === 'BOARD' ? 'vision.board.complete' : 'vision.first')
    );
    if (hasMilestone) continue;
    candidates.push({
      kind: 'VISION_MILESTONE',
      dedupeKey: `vision:${v.kind}:${v.id}`,
      anchorId: v.anchorId,
      title: v.kind === 'BOARD' ? 'Vision board completed' : 'Vision created',
      dateKey: dateKeyOf(v.at),
      labels: [],
      rank: v.kind === 'BOARD' ? 2 : 1,
      significance: 2,
      at: v.at.getTime(),
    });
  }

  // 4. Support heroes. --------------------------------------------------------------------------------------------------
  const sortedKeys = [...practiceDays].sort();
  const sortedPractices = [...practices].sort(
    (a, b) => a.completedAt.getTime() - b.completedAt.getTime() || compare(a.id, b.id)
  );
  const supportKind = ((): HeroKind => {
    if (practiceDays.size >= PRACTICE_WEEK_MIN_DAYS) return 'PRACTICE_WEEK';
    if (practices.length > 0 && source.priorPracticeAt) {
      const gap = Math.round(
        (Date.parse(sortedKeys[0]) - Date.parse(dateKeyOf(source.priorPracticeAt))) / 86_400_000
      );
      if (gap >= RETURN_MIN_GAP_DAYS) return 'RETURN';
    }
    if (practices.length > 0) return 'STEADY';
    return missing.length > 0 ? 'INCOMPLETE' : 'QUIET';
  })();

  const ordered = orderCandidates(candidates);
  const supportHero: Candidate = {
    kind: supportKind,
    dedupeKey: `${supportKind.toLowerCase()}:${weekKey}`,
    anchorId: null,
    title: supportKind === 'INCOMPLETE' ? '' : plural(practiceDays.size, 'practice day'),
    dateKey: sortedKeys[0] ?? null,
    count: practiceDays.size,
    labels: [],
    rank: practiceDays.size,
    significance: 0,
    at: 0,
  };
  const hero: HeroOrHighlight = ordered[0] ?? supportHero;
  const rest = ordered.slice(ordered[0] ? 1 : 0);

  // 5. Highlights: collapse multiple waypoints per Chart into one row, cap, and account for the overflow. --------------
  const collapsed: Candidate[] = [];
  const waypointGroup = new Map<string, Candidate>();
  for (const c of rest) {
    if (
      c.kind === 'WAYPOINT_REACHED' &&
      hero.kind === 'WAYPOINT_REACHED' &&
      c.courseId &&
      c.courseId === hero.courseId
    ) {
      const existing = waypointGroup.get(c.courseId);
      if (existing) {
        existing.count = (existing.count ?? 1) + 1;
        existing.title = `${existing.count} waypoints reached`;
      } else {
        const row = { ...c, count: 2, title: '2 waypoints reached' };
        waypointGroup.set(c.courseId, row);
        collapsed.push(row);
      }
      continue;
    }
    collapsed.push(c);
  }
  const strip = ({ rank: _r, significance: _s, at: _a, ...rest }: Candidate): HeroOrHighlight =>
    rest;
  const highlightsShown = collapsed.slice(0, MAX_HIGHLIGHTS);
  const heroOut = 'rank' in hero ? strip(hero as Candidate) : hero;

  // 6. Totals come from canonical sources, never from the (truncated) highlight list. --------------------------------
  const stats: WeeklyRecapV2['stats'] = [];
  if (!down('PRACTICE')) {
    stats.push({ id: 'PRACTICE_DAYS', value: practiceDays.size, of: 7 });
    stats.push({ id: 'PRACTICES', value: practices.length });
  }
  if (!down('CHART') && waypoints.length > 0)
    stats.push({ id: 'WAYPOINTS', value: waypoints.length });
  if (!down('MOVES') && moves.length > 0) stats.push({ id: 'MOVES', value: moves.length });
  if (!down('ANCHOR_LIFECYCLE') && completions.length > 0)
    stats.push({ id: 'COMPLETED', value: completions.length });
  if (!down('ANCHOR_LIFECYCLE') && releases.length > 0)
    stats.push({ id: 'RELEASED', value: releases.length });
  const countedMilestones = milestones.filter(
    m => !m.definitionId.startsWith('journey.') && MILESTONE_LABEL[m.definitionId]
  );
  if (!down('MILESTONES') && countedMilestones.length > 0)
    stats.push({ id: 'MILESTONES', value: countedMilestones.length });

  // 7. Motion strip. ----------------------------------------------------------------------------------------------------
  const motion: WeeklyRecapV2['motion'] = bounds.keys.map(dateKey => ({
    dateKey,
    weekday: weekdayOfKey(dateKey),
    practices: [],
    markers: [],
  }));
  const day = (key: string) => motion.find(d => d.dateKey === key);
  for (const p of sortedPractices)
    day(p.localDateKey)?.practices.push({ id: p.id, mode: p.mode, anchorId: p.anchorId });
  const mark = (at: Date, kind: MarkerKind, dedupeKey: string) =>
    day(dateKeyOf(at))?.markers.push({ kind, dedupeKey });
  for (const w of waypoints)
    mark(
      w.reachedAt,
      destinationFinalIds.has(w.id) ? 'DESTINATION' : 'WAYPOINT',
      `waypoint:${w.id}`
    );
  for (const m of moves) mark(m.completedAt, 'MOVE', `move:${m.id}`);
  for (const e of completions) mark(e.at, 'COMPLETED', `anchor:${e.anchorId}:completed`);
  for (const e of releases) mark(e.at, 'RELEASED', `anchor:${e.anchorId}:released`);
  for (const v of visions) mark(v.at, 'VISION', `vision:${v.kind}:${v.id}`);
  for (const m of countedMilestones) mark(m.earnedAt, 'MILESTONE', `milestone:${m.id}`);
  motion.forEach(d => d.markers.sort((a, b) => compare(a.dedupeKey, b.dedupeKey)));

  // 8. Per-Anchor rows. -------------------------------------------------------------------------------------------------
  const perAnchor = new Map<
    string,
    { days: Set<string>; practices: number; moves: number; waypoints: number }
  >();
  const row = (id: string) => {
    let r = perAnchor.get(id);
    if (!r) {
      r = { days: new Set(), practices: 0, moves: 0, waypoints: 0 };
      perAnchor.set(id, r);
    }
    return r;
  };
  for (const p of practices)
    if (p.anchorId) {
      const r = row(p.anchorId);
      r.days.add(p.localDateKey);
      r.practices++;
    }
  for (const m of moves) if (m.anchorId) row(m.anchorId).moves++;
  for (const w of waypoints) {
    const id = w.anchorId ?? courseById.get(w.courseId)?.anchorId;
    if (id) row(id).waypoints++;
  }
  const anchorRows = [...perAnchor.entries()]
    .map(([anchorId, r]) => ({
      anchorId,
      practiceDays: r.days.size,
      practices: r.practices,
      moves: r.moves,
      waypoints: r.waypoints,
    }))
    .sort(
      (a, b) =>
        compare(b.practices + b.moves + b.waypoints, a.practices + a.moves + a.waypoints) ||
        compare(a.anchorId, b.anchorId)
    );

  // 9. Copy: template-driven, factual, stable per (user, week). ---------------------------------------------------------
  const copy = writeCopy({
    hero: heroOut,
    practiceDays: practiceDays.size,
    practices: practices.length,
    moves: moves.length,
    waypoints: waypoints.length,
    userId,
    weekKey,
  });

  // 10. Provenance of the text we freeze (refs). --------------------------------------------------------------------------
  const referencedAnchors = new Set<string>();
  [heroOut, ...highlightsShown].forEach(h => h.anchorId && referencedAnchors.add(h.anchorId));
  anchorRows.slice(0, MAX_ANCHOR_ROWS).forEach(r => referencedAnchors.add(r.anchorId));
  const referencedCourses = new Set<string>();
  [heroOut, ...highlightsShown].forEach(h => h.courseId && referencedCourses.add(h.courseId));

  const isFinalPhase = source.phase === 'FINAL';
  const finalizable = isFinalPhase && missing.length === 0;
  return {
    recapVersion: RECAP_VERSION,
    templateVersion: TEMPLATE_VERSION,
    weekKey,
    timeZone,
    range: { startKey: weekKey, endKey: bounds.endKey, label: weekRangeLabel(weekKey) },
    status: finalizable ? 'FINAL' : 'DRAFT',
    provisional: {
      isProvisional: !finalizable,
      reason:
        missing.length > 0
          ? 'INCOMPLETE_DATA'
          : source.phase === 'PREVIEW'
            ? 'WEEK_IN_PROGRESS'
            : source.phase === 'SYNCING'
              ? 'SYNCING'
              : null,
    },
    finalizable,
    provenance: source.provenance,
    opening: { headline: copy.headline, summary: copy.summary },
    hero: heroOut,
    stats,
    motion,
    highlights: highlightsShown.map(strip),
    highlightsOverflow: collapsed.length - highlightsShown.length,
    anchors: anchorRows.slice(0, MAX_ANCHOR_ROWS),
    anchorsOverflow: Math.max(0, anchorRows.length - MAX_ANCHOR_ROWS),
    reflection: { templateId: copy.reflectionId, text: copy.reflection },
    refs: {
      anchors: Object.fromEntries(
        [...referencedAnchors]
          .sort()
          .filter(id => anchorById.has(id))
          .map(id => {
            const a = anchorById.get(id)!;
            return [
              id,
              { intention: a.intention, categoryKey: a.categoryKey, isReleased: a.isReleased },
            ];
          })
      ),
      charts: Object.fromEntries(
        [...referencedCourses]
          .sort()
          .filter(id => courseById.has(id))
          .map(id => {
            const c = courseById.get(id)!;
            return [
              id,
              { anchorId: c.anchorId, destination: c.destination, waypointTotal: c.waypointTotal },
            ];
          })
      ),
    },
    dataQuality: { missing },
  };
}

// ---- Copy -----------------------------------------------------------------------------------------------------------
function writeCopy(i: {
  hero: HeroOrHighlight;
  practiceDays: number;
  practices: number;
  moves: number;
  waypoints: number;
  userId: string;
  weekKey: string;
}) {
  const { hero, userId, weekKey } = i;
  const v = <T>(list: T[], salt: string) => pick(list, userId, weekKey, salt);
  const n = hero.count ?? 0;
  let headline: string;
  let summary: string;
  switch (hero.kind) {
    case 'DESTINATION_REACHED':
      headline = v(['You reached your destination.', 'Destination reached.'], 'h');
      summary = `${hero.title} is complete.`;
      break;
    case 'ANCHOR_COMPLETED_RELEASED':
      headline = 'You completed a chapter.';
      summary = `You completed and released “${hero.title}”.`;
      break;
    case 'ANCHOR_RELEASED':
      headline = v(['You let one go.', 'A release, on purpose.'], 'h');
      summary = `You released “${hero.title}”.`;
      break;
    case 'ANCHOR_COMPLETED':
      headline = v(['An intention, completed.', 'You finished what you set out to do.'], 'h');
      summary = `You completed “${hero.title}”.`;
      break;
    case 'WAYPOINT_REACHED':
      headline = v(['A milestone worth remembering.', 'You moved your Chart forward.'], 'h');
      summary = hero.movesCompleted
        ? `You reached “${hero.title}” and finished ${plural(hero.movesCompleted, 'move')} on the way.`
        : `You reached “${hero.title}”.`;
      break;
    case 'MOVES_PROGRESS':
      headline = v(['You kept your Chart moving.', 'Real moves, finished.'], 'h');
      summary =
        n === 1
          ? `You finished a move: “${hero.title}”.`
          : `You finished ${plural(n, 'move')} this week.`;
      break;
    case 'STRENGTH_MILESTONE':
      headline = 'Your thread grew stronger.';
      summary = `${hero.title}.`;
      break;
    case 'VISION_MILESTONE':
      headline = 'Your Vision took shape.';
      summary = `${hero.title}.`;
      break;
    case 'PRACTICE_COUNT_MILESTONE':
      headline = 'A practice milestone.';
      summary = `${hero.title}.`;
      break;
    case 'PRACTICE_WEEK':
      headline = v(['Steady work, all week.', 'You showed up, again and again.'], 'h');
      summary = `You practiced on ${i.practiceDays} of 7 days.`;
      break;
    case 'RETURN':
      headline = 'You came back.';
      summary = 'You practiced again after time away.';
      break;
    case 'STEADY':
      headline = v(['Small steps. Real movement.', 'A few steady steps.'], 'h');
      summary = `You practiced on ${plural(i.practiceDays, 'day')}.`;
      break;
    case 'INCOMPLETE':
      headline = 'We couldn’t load all of your week yet.';
      summary = 'Try again in a moment. Nothing has been lost.';
      break;
    default:
      headline = 'A quiet week.';
      summary = 'Nothing was recorded this week.';
  }
  // Reflection states only measured facts that the headline/summary did not already say.
  const parts: string[] = [];
  if (hero.kind !== 'PRACTICE_WEEK' && hero.kind !== 'STEADY' && i.practices > 0)
    parts.push(`${plural(i.practices, 'practice')} on ${plural(i.practiceDays, 'day')}`);
  if (hero.kind !== 'MOVES_PROGRESS' && i.moves > 0)
    parts.push(`${plural(i.moves, 'move')} finished`);
  if (hero.kind !== 'WAYPOINT_REACHED' && hero.kind !== 'DESTINATION_REACHED' && i.waypoints > 0)
    parts.push(`${plural(i.waypoints, 'waypoint')} reached`);
  const reflectionId = `${hero.kind.toLowerCase()}.${parts.length ? 'facts' : 'none'}.v${TEMPLATE_VERSION}`;
  const reflection = parts.length ? `Also this week: ${parts.join(', ')}.` : '';
  return { headline, summary, reflection, reflectionId };
}
