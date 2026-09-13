import type { Anchor } from '@/types';
import type { CourseDetail, WaypointSummary } from '@/types/chart';

/**
 * Chart context for Home, derived from the existing Course/Waypoint domain.
 * Read-only: it never advances waypoints, completes destinations, or writes
 * to CourseService.
 */
export type HomeChartState =
  | { state: 'none' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | {
      state: 'ready';
      courseId: string;
      destinationText: string;
      nextMove: string | null;
      reachedCount: number;
      waypointCount: number;
      currentWaypointId: string | null;
      currentWaypointIndex: number;
      isFinished: boolean;
      waypoints: Array<{
        id: string;
        title: string;
        state: WaypointSummary['state'];
        reached: boolean;
        isCurrent: boolean;
        isDestination: boolean;
      }>;
    };

function nextMoveTitle(course: CourseDetail): string | null {
  // currentWaypointId is authoritative whenever it is present. Do not replace
  // an unresolved server id with a guessed waypoint from the local array.
  if (course.currentWaypointId) {
    return course.waypoints.find((wp: WaypointSummary) => wp.id === course.currentWaypointId)?.title ?? null;
  }
  return course.waypoints.find((wp) => wp.state === 'CURRENT')?.title ?? null;
}

export function courseMatchesAnchor(
  course: CourseDetail,
  anchor: Anchor,
  options?: { isOnlyActiveAnchor?: boolean },
): boolean {
  const anchorIds = new Set([anchor.id, anchor.localId].filter((value): value is string => Boolean(value)));
  const links = [
    course.destinationAnchorLink,
    ...course.waypoints.map((waypoint) => waypoint.anchorLink),
  ].filter((link): link is NonNullable<typeof link> => Boolean(link));

  // Courses created before Anchor linking are account-level. They remain
  // visible because there is no persisted anchor relationship to scope them by.
  if (links.length === 0) return options?.isOnlyActiveAnchor === true;
  return links.some((link) => link.anchorId !== null && anchorIds.has(link.anchorId));
}

export function toHomeChartState(course: CourseDetail | null | undefined): HomeChartState {
  if (!course || course.status !== 'ACTIVE') return { state: 'none' };
  const waypoints = [...course.waypoints].sort((a, b) => a.position - b.position);
  const currentWaypointIndex = course.currentWaypointId
    ? waypoints.findIndex((wp) => wp.id === course.currentWaypointId)
    : waypoints.findIndex((wp) => wp.state === 'CURRENT');
  const isFinished = waypoints.length > 0 && waypoints.every(
    (wp) => Boolean(wp.reachedAt) || wp.state === 'REACHED',
  );

  return {
    state: 'ready',
    courseId: course.id,
    destinationText: course.destinationText,
    nextMove: nextMoveTitle(course),
    reachedCount: course.reachedCount,
    waypointCount: waypoints.length,
    currentWaypointId: course.currentWaypointId,
    currentWaypointIndex: isFinished ? -1 : currentWaypointIndex,
    isFinished,
    waypoints: waypoints.map((wp, index) => ({
      id: wp.id,
      title: wp.title,
      state: wp.state,
      reached: Boolean(wp.reachedAt) || wp.state === 'REACHED',
      isCurrent: !isFinished && index === currentWaypointIndex,
      isDestination: index === waypoints.length - 1,
    })),
  };
}
