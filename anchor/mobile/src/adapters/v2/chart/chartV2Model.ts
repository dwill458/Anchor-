import type { CourseDetail, MoveSummary, WaypointSummary } from '@/types/chart';
import type { ChartForAnchor } from '@/services/v2/chartV2Api';

/**
 * Presentation model for Anchor 2.0 Chart. Pure: everything here is derived
 * from the server's Course projection. The client never decides which
 * waypoint is current, whether a waypoint is reached, or when the destination
 * is reached — it only reads those facts.
 */

export type ChartMarkerState = 'completed' | 'current' | 'upcoming';

export type ChartMetricView = {
  current: number | null;
  target: number;
  label: string | null;
  /** 0–1, clamped. Null when no current value has been recorded. */
  fraction: number | null;
  /** "642 / 1,000" or "— / 1,000". */
  display: string;
  percentLabel: string | null;
};

export type ChartWaypointView = {
  id: string;
  /** 1-based position on the live route. */
  number: number;
  title: string;
  rationale: string | null;
  state: ChartMarkerState;
  isDestination: boolean;
  metric: ChartMetricView | null;
  reachedAt: string | null;
  moves: MoveSummary[];
  suggestedMoves: MoveSummary[];
  accessibilityLabel: string;
};

export type ChartViewModel = {
  courseId: string;
  version: number;
  anchorId: string | null;
  destination: string;
  startingContext: string | null;
  status: CourseDetail['status'];
  isFinished: boolean;
  waypoints: ChartWaypointView[];
  total: number;
  reachedCount: number;
  current: ChartWaypointView | null;
  /** 0-based index of the current waypoint, or `total` when finished. */
  currentIndex: number;
  oneMove: MoveSummary | null;
  plottedAt: string;
  completedAt: string | null;
  completedMoveCount: number;
  practiceCount: number | null;
  positionLabel: string;
};

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function formatMetricNumber(value: number): string {
  return numberFormat.format(value);
}

export function toMetricView(metric: WaypointSummary['metric']): ChartMetricView | null {
  if (!metric || typeof metric.target !== 'number' || metric.target <= 0) return null;
  const current = typeof metric.current === 'number' ? metric.current : null;
  const baseline = typeof metric.baseline === 'number' && metric.baseline < metric.target ? metric.baseline : 0;
  const fraction =
    current === null ? null : Math.max(0, Math.min(1, (current - baseline) / (metric.target - baseline)));
  return {
    current,
    target: metric.target,
    label: metric.label,
    fraction,
    display: `${current === null ? '—' : formatMetricNumber(current)} / ${formatMetricNumber(metric.target)}`,
    percentLabel: fraction === null ? null : `${Math.round(fraction * 100)}%`,
  };
}

/** Cancelled waypoints left the route; everything else is part of its story. */
export function liveWaypoints(course: CourseDetail): WaypointSummary[] {
  return [...course.waypoints]
    .filter((waypoint) => waypoint.state !== 'CANCELLED' && !waypoint.cancelledAt)
    .sort((left, right) => left.position - right.position);
}

function markerState(waypoint: WaypointSummary, course: CourseDetail): ChartMarkerState {
  if (waypoint.reachedAt || waypoint.state === 'REACHED' || waypoint.state === 'SKIPPED') return 'completed';
  if (waypoint.id === course.currentWaypointId) return 'current';
  return 'upcoming';
}

function describeWaypoint(view: Omit<ChartWaypointView, 'accessibilityLabel'>, total: number): string {
  const stateText =
    view.state === 'completed' ? 'reached' : view.state === 'current' ? 'current waypoint' : 'ahead';
  const destination = view.isDestination ? ', destination' : '';
  const metric = view.metric ? `, ${view.metric.display}${view.metric.label ? ` ${view.metric.label}` : ''}` : '';
  return `Waypoint ${view.number} of ${total}${destination}: ${view.title}, ${stateText}${metric}`;
}

export function toChartViewModel(
  course: CourseDetail,
  stats?: ChartForAnchor['stats'] | null
): ChartViewModel {
  const waypoints = liveWaypoints(course);
  const total = waypoints.length;
  const moves = course.moves ?? [];
  const views: ChartWaypointView[] = waypoints.map((waypoint, index) => {
    const base = {
      id: waypoint.id,
      number: index + 1,
      title: waypoint.title,
      rationale: waypoint.description,
      state: markerState(waypoint, course),
      isDestination: index === total - 1,
      metric: toMetricView(waypoint.metric ?? null),
      reachedAt: waypoint.reachedAt,
      moves: moves.filter((move) => move.waypointId === waypoint.id && (move.status === 'ACTIVE' || move.status === 'COMPLETED')),
      suggestedMoves: moves.filter((move) => move.waypointId === waypoint.id && move.status === 'SUGGESTED'),
    };
    return { ...base, accessibilityLabel: describeWaypoint(base, total) };
  });
  const isFinished = course.status === 'COMPLETED';
  const currentIndex = isFinished ? total : views.findIndex((view) => view.state === 'current');
  const current = currentIndex >= 0 && currentIndex < total ? views[currentIndex] : null;
  const oneMove =
    !isFinished && course.currentMoveId ? moves.find((move) => move.id === course.currentMoveId) ?? null : null;
  const reachedCount = views.filter((view) => view.state === 'completed').length;

  return {
    courseId: course.id,
    version: course.version,
    anchorId: course.anchorId ?? null,
    destination: course.destinationText,
    startingContext: course.startingContext ?? null,
    status: course.status,
    isFinished,
    waypoints: views,
    total,
    reachedCount,
    current,
    currentIndex: currentIndex < 0 ? 0 : currentIndex,
    oneMove,
    plottedAt: course.plottedAt,
    completedAt: course.completedAt,
    completedMoveCount: stats?.completedMoveCount ?? moves.filter((move) => move.status === 'COMPLETED').length,
    practiceCount: stats?.practiceCount ?? null,
    positionLabel: current ? `${current.number} of ${total}` : `${total} of ${total}`,
  };
}

/** Compact summary for Home, Vision and completion surfaces. Null when there is no live route. */
export type ChartSummary = {
  courseId: string;
  waypointNumber: number;
  total: number;
  waypointTitle: string;
  oneMoveTitle: string | null;
  isFinished: boolean;
  destination: string;
};

export function toChartSummary(course: CourseDetail | null | undefined): ChartSummary | null {
  if (!course || (course.status !== 'ACTIVE' && course.status !== 'COMPLETED')) return null;
  const view = toChartViewModel(course);
  if (view.total === 0) return null;
  if (view.isFinished) {
    return {
      courseId: view.courseId,
      waypointNumber: view.total,
      total: view.total,
      waypointTitle: view.destination,
      oneMoveTitle: null,
      isFinished: true,
      destination: view.destination,
    };
  }
  if (!view.current) return null;
  return {
    courseId: view.courseId,
    waypointNumber: view.current.number,
    total: view.total,
    waypointTitle: view.current.title,
    oneMoveTitle: view.oneMove?.title ?? null,
    isFinished: false,
    destination: view.destination,
  };
}

/** Human date for journey summaries: "May 31, 2026". */
export function formatJourneyDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
