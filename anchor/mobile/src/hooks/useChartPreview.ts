import { createContext, useContext, useMemo } from 'react';
import { liveWaypoints } from '@/adapters/v2/chart/chartV2Model';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import type { CourseDetail } from '@/types/chart';

export type ChartPreviewData = {
  category: string | null;
  status: 'empty' | 'active' | 'complete';
  /** One-based live route position; zero when no waypoint is selected. */
  waypointIndex: number;
  waypointTotal: number;
  title: string;
  current: number | null;
  target: number | null;
  startValue: number | null;
  progress: number;
  nextMove: string | null;
  /** "2 of 4 moves done" for a waypoint whose progress is its moves; null otherwise. */
  movesLabel?: string | null;
};

const finiteOrNull = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function selectChartPreview(course: CourseDetail | null, category: string | null = null): ChartPreviewData {
  const waypoints = course ? liveWaypoints(course) : [];
  if (!course || waypoints.length === 0) return {
    category, status: 'empty', waypointIndex: 0, waypointTotal: 0, title: 'Chart your first waypoint',
    current: null, target: null, startValue: null, progress: 0, nextMove: null,
  };
  const complete = course.status === 'COMPLETED';
  const currentWaypoint = waypoints.find(w => w.id === course.currentWaypointId);
  // A confirmed reach can precede the next waypoint becoming current. Keep that
  // reached waypoint visible; never promote an upcoming waypoint locally.
  const waypoint = complete ? waypoints[waypoints.length - 1] : currentWaypoint
    ?? waypoints.filter(w => w.state === 'REACHED' || w.reachedAt).slice(-1)[0];
  const current = finiteOrNull(waypoint?.metric?.current);
  const target = finiteOrNull(waypoint?.metric?.target);
  const waypointMoves = waypoint
    ? (course.moves ?? []).filter(m => m.waypointId === waypoint.id && (m.status === 'ACTIVE' || m.status === 'COMPLETED'))
    : [];
  const movesDone = waypointMoves.filter(m => m.status === 'COMPLETED').length;
  // Only a waypoint without a measure shows its moves; a counter belongs to numeric waypoints alone.
  const movesBased = !complete && target === null && waypoint?.progressMode !== 'none' && waypointMoves.length > 0;
  const nextMove = !complete && currentWaypoint ? course.moves?.find(m =>
    m.id === course.currentMoveId && m.waypointId === currentWaypoint.id && m.status === 'ACTIVE')?.title ?? null : null;
  return {
    category,
    status: complete ? 'complete' : 'active',
    waypointIndex: waypoint ? waypoints.indexOf(waypoint) + 1 : 0,
    waypointTotal: waypoints.length,
    title: complete ? 'Chart complete' : waypoint?.title ?? course.destinationText,
    current, target, startValue: finiteOrNull(waypoint?.metric?.baseline),
    movesLabel: movesBased ? `${movesDone} of ${waypointMoves.length} ${waypointMoves.length === 1 ? 'move' : 'moves'} done` : null,
    // Baseline is display-only. Keep the locked ratio separate from toMetricView.
    progress: complete ? 1 : current !== null && target !== null && target > 0
      ? Math.max(0, Math.min(1, current / target))
      : movesBased ? movesDone / waypointMoves.length : 0,
    nextMove,
  };
}

/** Only the unregistered development screen supplies these read-only snapshots. */
export const ChartPreviewFixtureContext = createContext<Readonly<Record<string, ChartPreviewData>> | null>(null);

/** Null means unavailable/unresolved, never confirmed empty. Reuses existing subscriptions. */
export function useChartPreview(anchorId: string): ChartPreviewData | null {
  const fixtures = useContext(ChartPreviewFixtureContext);
  const fixture = __DEV__ ? fixtures?.[anchorId] : undefined;
  const source = useAnchorChart(fixture ? null : anchorId);
  return useMemo(() => {
    if (fixture) return fixture;
    if (source.data) return selectChartPreview(source.data.chart, source.data.anchor?.category ?? null);
    // A server-confirmed missing Chart is the empty CTA state; unresolved or
    // failed requests remain null so the card reserves its loading footprint.
    if (!source.loading && source.error?.kind === 'not_found') return selectChartPreview(null);
    return null;
  }, [fixture, source.data, source.error, source.loading]);
}
