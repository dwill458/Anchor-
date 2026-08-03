import type { WaypointSummary } from '@/types/chart';

/**
 * Prop contract for CourseMap. Fully data-driven — no store reads, no API
 * calls, no derivation of server-authoritative state. `waypoint.state` from
 * the backend projection is the only source of truth for lifecycle state.
 */
export type CourseMapProps = {
  courseId: string;
  destinationText: string;
  waypoints: WaypointSummary[];
  currentWaypointId: string | null;
  reachedCount: number;
  completed: boolean;
  reducedMotion?: boolean;
  onWaypointPress: (waypointId: string) => void;
  /**
   * Committed server transition. Supplied by later integration work once a
   * mutation succeeds; CourseMap never infers this from a local tap. Absent
   * or unchanged eventId means "no animation this render."
   */
  advancement?: RouteAdvancement | null;
};

export type RouteAdvancement = {
  completedWaypointId: string;
  nextWaypointId: string | null;
  courseCompleted: boolean;
  eventId: string;
};

export type MiniRouteWaypoint = Pick<WaypointSummary, 'id' | 'state'>;

export type MiniRouteProps = {
  waypoints: MiniRouteWaypoint[];
  completed?: boolean;
  size?: 'small' | 'medium';
  testID?: string;
};
