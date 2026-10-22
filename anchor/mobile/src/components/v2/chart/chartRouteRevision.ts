import { liveWaypoints } from '@/adapters/v2/chart/chartV2Model';
import type { CourseDetail } from '@/types/chart';

/**
 * What makes a route "the same": the live waypoints, in order, with everything Adjust Route can edit. Reached
 * waypoints are included (they are locked, so they only differ if the server changed them). Moves and progress are not
 * part of the route.
 */
export function routeSignature(course: CourseDetail | null | undefined): string {
  if (!course) return '';
  return JSON.stringify(
    liveWaypoints(course).map((waypoint) => [
      waypoint.id,
      waypoint.title.trim(),
      waypoint.description ?? null,
      waypoint.kind ?? null,
      waypoint.progressMode ?? null,
      waypoint.metric?.label ?? null,
      waypoint.metric?.target ?? null,
      waypoint.metric?.baseline ?? null,
    ]),
  );
}

/** A saved revision that actually changed the route. A no-op apply, or a response that matches the old route, is not one. */
export function routeWasRevised(before: CourseDetail | null | undefined, after: CourseDetail | null | undefined): boolean {
  if (!before || !after) return false;
  return routeSignature(before) !== routeSignature(after);
}
