import type { CourseDetail, WaypointSummary } from '@/types/chart';
import type {
  ChartRouteTemplate,
  V2ChartCompactState,
  V2ChartPresentationState,
  V2WaypointDisplayState,
  V2WaypointMove,
  V2WaypointPresentation,
} from './types';

/**
 * Derives presentation state for a waypoint without mutating or fabricating domain data.
 */
export function deriveWaypointDisplayState(
  wp: WaypointSummary,
  index: number,
  currentIndex: number,
): V2WaypointDisplayState {
  if (wp.reachedAt !== null || wp.state === 'REACHED') {
    return 'completed';
  }
  if (index === currentIndex) {
    return 'current';
  }
  return 'upcoming';
}

/**
 * Parses or synthesizes moves from waypoint data cleanly.
 * If waypoint description has structured lines or steps, extracts them,
 * otherwise provides default action steps based on the waypoint title.
 */
export function extractWaypointMoves(
  wp: WaypointSummary,
  savedMoves?: V2WaypointMove[],
): V2WaypointMove[] {
  if (savedMoves && savedMoves.length > 0) {
    return savedMoves;
  }

  const isReached = wp.reachedAt !== null || wp.state === 'REACHED';

  // If description contains newline-separated steps, parse them
  if (wp.description && wp.description.includes('\n')) {
    const lines = wp.description
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    return lines.map((line, idx) => ({
      id: `${wp.id}-m${idx}`,
      waypointId: wp.id,
      text: line.replace(/^[-*•]\s*/, ''),
      done: isReached,
    }));
  }

  // Baseline micro-moves anchored to this waypoint
  return [
    {
      id: `${wp.id}-m0`,
      waypointId: wp.id,
      text: wp.description?.trim() || `Complete next step toward ${wp.title}`,
      done: isReached,
    },
  ];
}

/**
 * Normalizes authoritative CourseDetail into the UI-G Chart presentation state.
 * Preserves backend authority for Destination, Course, Waypoints, and current Waypoint.
 */
export function toV2ChartPresentationState(
  course: CourseDetail | null | undefined,
  options?: {
    template?: ChartRouteTemplate;
    connectedVisionId?: string | null;
    movesMap?: Record<string, V2WaypointMove[]>;
  },
): V2ChartPresentationState | null {
  if (!course) return null;

  const rawWaypoints = [...course.waypoints].sort((a, b) => a.position - b.position);
  const total = rawWaypoints.length;

  // Determine authoritative current waypoint index
  let currentIndex = -1;
  if (course.currentWaypointId) {
    currentIndex = rawWaypoints.findIndex((w) => w.id === course.currentWaypointId);
  }
  if (currentIndex < 0) {
    currentIndex = rawWaypoints.findIndex((w) => w.reachedAt === null && w.state !== 'REACHED');
  }

  const isFinished =
    course.status === 'COMPLETED' ||
    (currentIndex < 0 && total > 0 && rawWaypoints.every((w) => w.reachedAt !== null || w.state === 'REACHED'));

  const waypoints: V2WaypointPresentation[] = rawWaypoints.map((wp, index) => {
    const isDestination = index === total - 1;
    const isReached = wp.reachedAt !== null || wp.state === 'REACHED';
    const displayState = deriveWaypointDisplayState(wp, index, currentIndex);
    const moves = extractWaypointMoves(wp, options?.movesMap?.[wp.id]);
    const doneMoves = moves.filter((m) => m.done).length;

    return {
      id: wp.id,
      value: wp.title,
      description: wp.description ?? '',
      state: displayState,
      isCurrent: index === currentIndex && !isFinished,
      isDestination,
      reached: isReached,
      reachedAt: wp.reachedAt,
      moves,
      doneMoveCount: doneMoves,
      totalMoveCount: moves.length,
      raw: wp,
    };
  });

  const currentWaypoint = currentIndex >= 0 ? waypoints[currentIndex] : null;
  const pendingMove = currentWaypoint?.moves.find((m) => !m.done) ?? null;

  return {
    courseId: course.id,
    destinationText: course.destinationText,
    status: course.status,
    template: options?.template ?? 'gentle-s',
    waypoints,
    currentWaypoint: isFinished ? null : currentWaypoint,
    currentWaypointIndex: currentIndex,
    isFinished,
    reachedCount: course.reachedCount,
    totalWaypoints: total,
    oneMove: isFinished ? null : pendingMove,
    connectedVisionId: options?.connectedVisionId ?? null,
    hasConnectedVision: Boolean(options?.connectedVisionId),
    raw: course,
  };
}

/**
 * Compact read adapter for Home. Read-only; performs NO mutations.
 */
export function toV2ChartCompactState(
  course: CourseDetail | null | undefined,
): V2ChartCompactState {
  if (!course || (course.status !== 'ACTIVE' && course.status !== 'COMPLETED')) {
    return { state: 'none' };
  }

  const rawWaypoints = [...course.waypoints].sort((a, b) => a.position - b.position);
  let activeWp: WaypointSummary | undefined;

  if (course.currentWaypointId) {
    activeWp = rawWaypoints.find((w) => w.id === course.currentWaypointId);
  }
  if (!activeWp) {
    activeWp = rawWaypoints.find((w) => w.state === 'CURRENT' || w.state === 'UPCOMING');
  }

  const isFinished =
    course.status === 'COMPLETED' ||
    (rawWaypoints.length > 0 && rawWaypoints.every((w) => w.reachedAt !== null || w.state === 'REACHED'));

  return {
    state: 'ready',
    courseId: course.id,
    destinationText: course.destinationText,
    nextMove: activeWp?.title ?? null,
    reachedCount: course.reachedCount,
    waypointCount: course.waypointCount,
    isFinished,
  };
}
