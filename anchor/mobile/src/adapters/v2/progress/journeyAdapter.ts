import type { CourseLogEntry } from '@/types/chart';
import type { AnyProgressSession } from './progressAdapter';
import type { V2ProgressLifetimeStats, V2ProgressRecentReflection, V2ProgressRouteSummary } from './types';
import { localDateString } from '@/utils/primingAnalytics';

/**
 * Which "Your Journey" layout to draw. Derived only from persisted Chart and Vision availability
 * for the selected Anchor. `loading` is returned until both are known so the wrong state never flashes.
 */
export type JourneyState = 'loading' | 'chartVision' | 'chartOnly' | 'visionOnly' | 'practiceFirst';

export type JourneyVisionStatus = 'loading' | 'ready' | 'none' | 'error';

export function resolveJourneyState(input: {
  chartLoading: boolean;
  route: V2ProgressRouteSummary | null | undefined;
  visionStatus: JourneyVisionStatus;
}): JourneyState {
  if (input.chartLoading || input.visionStatus === 'loading') return 'loading';
  const hasChart = Boolean(input.route);
  // An unreachable Vision read is not evidence that there is no Vision, but it is also not evidence of
  // one: draw only what is known (the cached read normally keeps `ready` available offline).
  const hasVision = input.visionStatus === 'ready';
  if (hasChart && hasVision) return 'chartVision';
  if (hasChart) return 'chartOnly';
  if (hasVision) return 'visionOnly';
  return 'practiceFirst';
}

function sessionKey(s: AnyProgressSession): string | undefined {
  return s.anchorId || (s as any).anchorLocalId || (s as any).anchor_id || undefined;
}

function seconds(s: AnyProgressSession): number {
  if ('completedDurationSeconds' in s && typeof s.completedDurationSeconds === 'number') return s.completedDurationSeconds;
  if ('durationSeconds' in s && typeof s.durationSeconds === 'number') return s.durationSeconds;
  return 0;
}

/** Whole-history totals for one Anchor, straight from its persisted sessions (never a window). */
export function buildLifetimeStats(
  sessions: AnyProgressSession[],
  anchorIds: readonly string[],
  route: V2ProgressRouteSummary | null | undefined,
): V2ProgressLifetimeStats {
  const days = new Set<string>();
  let practices = 0;
  let totalSeconds = 0;
  let first: number | null = null;
  for (const s of sessions) {
    const key = sessionKey(s);
    if (!key || !anchorIds.includes(key)) continue;
    const at = new Date(s.completedAt);
    if (Number.isNaN(at.getTime())) continue;
    practices += 1;
    totalSeconds += seconds(s);
    const stored = 'localDateKey' in s ? s.localDateKey : undefined;
    days.add(typeof stored === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stored) ? stored : localDateString(at));
    if (first === null || at.getTime() < first) first = at.getTime();
  }
  return {
    practices,
    activeDays: days.size,
    totalSeconds,
    firstPracticeAt: first === null ? null : new Date(first).toISOString(),
    waypointsReached: route?.reachedCount ?? 0,
  };
}

/** "2h 46m", "46m", "0m". Whole minutes, rounded down to what was actually completed. */
export function formatFocusTime(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
}

/** The newest Chart reflection that has the user's own words. Null when there is none. */
export function buildRecentReflection(courseLogs: CourseLogEntry[]): V2ProgressRecentReflection | null {
  let best: V2ProgressRecentReflection | null = null;
  for (const log of courseLogs) {
    const body = log.reflection?.body?.trim();
    if (!body) continue;
    const at = Date.parse(log.occurredAt);
    if (Number.isNaN(at)) continue;
    if (!best || at > Date.parse(best.occurredAt)) best = { text: body, occurredAt: log.occurredAt };
  }
  return best;
}
