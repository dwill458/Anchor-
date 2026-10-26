import type { AvailableRecapView, RecapCandidateKind, RecapHeroKind } from './recapTypes';

export type RecapStatusKind = 'PREVIEW' | 'PROVISIONAL' | 'FINAL';

export interface RecapViewModel {
  weekKey: string;
  weekLabel: string;
  status: { kind: RecapStatusKind; label: string | null };
  hero: { kind: RecapHeroKind; eyebrow: string; headline: string; support: string; anchorId: string | null };
  stats: { key: string; label: string; value: string }[];
  days: { dateKey: string; letter: string; practiced: boolean; achievements: number }[];
  highlights: { key: string; kind: RecapCandidateKind; label: string; detail: string; anchorId: string | null }[];
  moreCount: number;
  nextAction: { kind: 'CHART' | 'PRACTICE'; label: string; anchorId?: string | null };
  map:
    | { mode: 'VERIFIED'; anchorId: string | null; routeStatus: 'active' | 'complete'; waypointIndex: number; waypointTotal: number; reachedMask: boolean[] }
    | { mode: 'NONE'; reason: 'NO_COURSE' | 'UNVERIFIED' };
  feedbackEnabled: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function parse(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const fmt = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const EYEBROW: Record<RecapHeroKind, string> = {
  DESTINATION: 'DESTINATION REACHED',
  INTENTION_COMPLETED: 'INTENTION COMPLETED',
  WAYPOINT: 'WAYPOINT REACHED',
  MOVES_PROGRESS: 'MOVES COMPLETED',
  MOVE_SINGLE: 'MOVE COMPLETED',
  MILESTONE: 'MILESTONE',
  RELEASE: 'RELEASED',
  PRACTICE: 'SHOWING UP',
  QUIET: 'THIS WEEK',
};

const HIGHLIGHT_LABEL: Record<RecapCandidateKind, string> = {
  DESTINATION_REACHED: 'Destination reached',
  INTENTION_COMPLETED: 'Intention completed',
  WAYPOINT_REACHED: 'Waypoint reached',
  MOVE_COMPLETED: 'Move completed',
  MILESTONE_EARNED: 'Milestone earned',
  ANCHOR_RELEASED: 'Anchor released',
};

/**
 * A route is drawn only from server-verified state with a complete per-waypoint mask whose
 * reached waypoints form a contiguous prefix (the map reveals a continuous route). Anything
 * else is shown as "not available" rather than approximated.
 */
function drawable(map: NonNullable<AvailableRecapView['content']['map']>): boolean {
  const f = map.frozen;
  if (map.status !== 'VERIFIED' || !f || !f.reachedMask) return false;
  if (f.waypointTotal < 1 || f.reachedMask.length !== f.waypointTotal) return false;
  const reached = f.reachedMask.filter(Boolean).length;
  return reached === f.waypointIndex && f.reachedMask.slice(0, reached).every(Boolean);
}

export function buildRecapViewModel(view: AvailableRecapView): RecapViewModel {
  const { core, map } = view.content;
  const start = parse(view.weekKey);
  const end = new Date(start.getTime() + 6 * 86400000);
  const s = core.stats;

  const facts: string[] = [];
  if (s.practiceDays > 0) facts.push(plural(s.practiceDays, 'practice day', 'practice days'));
  if (s.moves > 0) facts.push(`${plural(s.moves, 'move', 'moves')} completed`);
  if (s.waypoints > 0) facts.push(`${plural(s.waypoints, 'waypoint', 'waypoints')} reached`);
  const support = facts.length ? facts.join(' · ') : 'No practice or progress was recorded this week.';

  const stats = [
    { key: 'practiceDays', label: 'Practice days', value: String(s.practiceDays) },
    { key: 'moves', label: 'Moves', value: String(s.moves) },
    { key: 'waypoints', label: 'Waypoints', value: String(s.waypoints) },
  ];
  if (s.destinations > 0) stats.push({ key: 'destinations', label: 'Destinations', value: String(s.destinations) });
  if (s.intentionsCompleted > 0) stats.push({ key: 'intentionsCompleted', label: 'Intentions completed', value: String(s.intentionsCompleted) });
  if (s.milestones > 0) stats.push({ key: 'milestones', label: 'Milestones', value: String(s.milestones) });
  if (s.releases > 0) stats.push({ key: 'releases', label: 'Released', value: String(s.releases) });

  const kind = core.hero.kind;
  const anchorId = core.hero.anchorId ?? null;
  const nextAction: RecapViewModel['nextAction'] =
    kind === 'DESTINATION' || kind === 'INTENTION_COMPLETED' || kind === 'RELEASE'
      ? { kind: 'CHART', label: 'Plan what comes next', anchorId }
      : kind === 'WAYPOINT' || kind === 'MOVES_PROGRESS' || kind === 'MOVE_SINGLE'
        ? { kind: 'CHART', label: 'Choose your next move', anchorId }
        : { kind: 'PRACTICE', label: 'Start a practice', anchorId };

  let mapVm: RecapViewModel['map'];
  if (!map) mapVm = { mode: 'NONE', reason: 'NO_COURSE' };
  else if (!drawable(map)) mapVm = { mode: 'NONE', reason: 'UNVERIFIED' };
  else {
    const f = map.frozen!;
    mapVm = {
      mode: 'VERIFIED',
      anchorId,
      routeStatus: kind === 'DESTINATION' ? 'complete' : 'active',
      waypointIndex: f.waypointIndex,
      waypointTotal: f.waypointTotal,
      reachedMask: f.reachedMask!,
    };
  }

  const status =
    view.status === 'FINAL'
      ? { kind: 'FINAL' as const, label: null }
      : view.phase === 'PREVIEW'
        ? { kind: 'PREVIEW' as const, label: 'A preview of your week so far. It becomes a recap on Monday.' }
        : { kind: 'PROVISIONAL' as const, label: 'Still syncing. Final Tuesday at noon.' };

  return {
    weekKey: view.weekKey,
    weekLabel: `${fmt(start)} – ${fmt(end)}`,
    status,
    hero: { kind, eyebrow: EYEBROW[kind], headline: core.headline, support, anchorId },
    stats,
    days: core.days.map((d) => ({ dateKey: d.dateKey, letter: LETTERS[parse(d.dateKey).getUTCDay()], practiced: d.practiced, achievements: d.achievements })),
    highlights: core.highlights.map((h) => ({
      key: `${h.kind}:${h.sourceEntityId}`,
      kind: h.kind,
      anchorId: h.anchorId ?? null,
      label: HIGHLIGHT_LABEL[h.kind],
      detail:
        h.kind === 'WAYPOINT_REACHED' && h.absorbedMoveCount > 0
          ? `${h.title ?? 'Waypoint'} · ${plural(h.absorbedMoveCount, 'move', 'moves')} toward it`
          : h.title ?? h.anchorTitle ?? '',
    })),
    moreCount: core.omittedHighlightCount,
    nextAction,
    map: mapVm,
    feedbackEnabled: view.status === 'FINAL',
  };
}
