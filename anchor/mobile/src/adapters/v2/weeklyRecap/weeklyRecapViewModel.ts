import { getCategoryColor } from '@/theme/v2';
import type { RecapHeroKind, RecapItem, RecapStatId, WeeklyRecap } from './types';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const STAT_LABEL: Record<RecapStatId, (n: number) => string> = {
  PRACTICE_DAYS: () => 'Practice days', PRACTICES: n => (n === 1 ? 'Practice' : 'Practices'), WAYPOINTS: n => (n === 1 ? 'Waypoint' : 'Waypoints'),
  MOVES: n => (n === 1 ? 'Move' : 'Moves'), COMPLETED: () => 'Completed', RELEASED: () => 'Released', MILESTONES: n => (n === 1 ? 'Milestone' : 'Milestones'),
};

export const HERO_EYEBROW: Record<RecapHeroKind, string> = {
  DESTINATION_REACHED: 'Destination reached', ANCHOR_COMPLETED_RELEASED: 'Completed and released', ANCHOR_RELEASED: 'Released',
  ANCHOR_COMPLETED: 'Completed', WAYPOINT_REACHED: 'Waypoint reached', MOVES_PROGRESS: 'Moves finished', STRENGTH_MILESTONE: 'Thread milestone',
  VISION_MILESTONE: 'Vision', PRACTICE_COUNT_MILESTONE: 'Practice milestone', PRACTICE_WEEK: 'Steady week', RETURN: 'Welcome back',
  STEADY: 'This week', QUIET: 'This week', INCOMPLETE: 'This week',
};

/** Why a recap is not final yet, in plain words. Null once it is final. */
export function provisionalNotice(recap: WeeklyRecap): string | null {
  if (!recap.provisional.isProvisional) return null;
  switch (recap.provisional.reason) {
    case 'WEEK_IN_PROGRESS': return 'A look at your week so far. It will update when the week ends.';
    case 'SYNCING': return 'Your week is complete. Practice from other devices may still be syncing, and this recap finalizes Tuesday at noon.';
    case 'INCOMPLETE_DATA': return 'Some of your week could not be loaded yet. Pull down to try again.';
    default: return 'This recap is not final yet.';
  }
}

export function statsForDisplay(recap: WeeklyRecap) {
  return recap.stats.map(s => ({ id: s.id, value: s.of ? `${s.value} of ${s.of}` : String(s.value), label: STAT_LABEL[s.id](s.value), spoken: `${s.value}${s.of ? ` of ${s.of}` : ''} ${STAT_LABEL[s.id](s.value).toLowerCase()}` }));
}

export function motionForDisplay(recap: WeeklyRecap) {
  return recap.motion.map(d => {
    const parts: string[] = [];
    if (d.practices.length) parts.push(`${d.practices.length} ${d.practices.length === 1 ? 'practice' : 'practices'}`);
    const counts = d.markers.reduce<Record<string, number>>((m, x) => ((m[x.kind] = (m[x.kind] ?? 0) + 1), m), {});
    for (const [kind, n] of Object.entries(counts)) parts.push(`${n} ${kind.toLowerCase()}`);
    return { dateKey: d.dateKey, letter: WEEKDAY_LETTERS[d.weekday], practices: d.practices.length, markers: d.markers.length, spoken: `${WEEKDAY_NAMES[d.weekday]}: ${parts.length ? parts.join(', ') : 'nothing recorded'}` };
  });
}

export function itemLabel(item: RecapItem): string {
  if (item.kind === 'MOVES_PROGRESS' && item.count && item.count > 1) return `${item.count} moves finished`;
  return item.title;
}

/** Accent comes from the Anchor's category, never hard-coded. Falls back to the neutral custom category. */
export function accentFor(recap: WeeklyRecap, anchorId: string | null): string {
  return getCategoryColor(anchorId ? recap.refs.anchors[anchorId]?.categoryKey : null);
}

/** An Anchor row is a link only when the Anchor can actually be opened on this device. */
export function canOpenAnchor(anchorId: string, openable: ReadonlySet<string>): boolean {
  return openable.has(anchorId);
}

export type RecapNextAction = { label: string; target: 'CHART' | 'ANCHOR'; anchorId: string };

/**
 * One useful next step, computed live from what can really be opened on this device (never frozen into the recap).
 * Released Anchors have archived Charts, so they offer no Chart link; Anchors that cannot be opened offer nothing.
 */
export function nextActionFor(recap: WeeklyRecap, focusAnchorId: string | undefined, openable: ReadonlySet<string>): RecapNextAction | null {
  const chartKinds: RecapHeroKind[] = ['DESTINATION_REACHED', 'WAYPOINT_REACHED', 'MOVES_PROGRESS'];
  const candidates = [focusAnchorId, recap.hero.anchorId, recap.anchors[0]?.anchorId].filter((x): x is string => !!x);
  for (const id of candidates) {
    const ref = recap.refs.anchors[id];
    if (!openable.has(id) || ref?.isReleased) continue;
    if (chartKinds.includes(recap.hero.kind) && recap.hero.anchorId === id && recap.hero.kind !== 'DESTINATION_REACHED')
      return { label: 'See your next move', target: 'CHART', anchorId: id };
    return { label: ref ? `Continue with ${ref.intention}` : 'Open your Anchor', target: 'ANCHOR', anchorId: id };
  }
  return null;
}
