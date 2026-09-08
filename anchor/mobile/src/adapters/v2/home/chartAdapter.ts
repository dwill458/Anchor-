import type { CourseDetail, WaypointSummary } from '@/types/chart';

/**
 * Chart context for Home, derived from the existing Course/Waypoint domain.
 * Read-only: it never advances waypoints, completes destinations, or writes
 * to CourseService.
 */
export type HomeChartState =
  | { state: 'none' }
  | {
      state: 'ready';
      courseId: string;
      destinationText: string;
      nextMove: string | null;
      reachedCount: number;
      waypointCount: number;
    };

function nextMoveTitle(course: CourseDetail): string | null {
  const byId = course.currentWaypointId
    ? course.waypoints.find((wp: WaypointSummary) => wp.id === course.currentWaypointId)
    : undefined;
  const active = byId ?? course.waypoints.find((wp) => wp.state === 'CURRENT' || wp.state === 'UPCOMING');
  return active?.title ?? null;
}

export function toHomeChartState(course: CourseDetail | null | undefined): HomeChartState {
  if (!course || course.status !== 'ACTIVE') return { state: 'none' };
  return {
    state: 'ready',
    courseId: course.id,
    destinationText: course.destinationText,
    nextMove: nextMoveTitle(course),
    reachedCount: course.reachedCount,
    waypointCount: course.waypointCount,
  };
}
