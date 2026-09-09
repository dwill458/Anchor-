import type {
  CourseDetail,
  WaypointSummary,
  WaypointState,
  CourseStatus,
} from '@/types/chart';

export type ChartRouteTemplate =
  | 'gentle-s'
  | 'wide-zigzag'
  | 'rising-arc'
  | 'double-bend';

export type V2WaypointDisplayState = 'completed' | 'current' | 'upcoming';

export interface V2WaypointMove {
  id: string;
  waypointId: string;
  text: string;
  context?: string;
  done: boolean;
}

export interface V2WaypointPresentation {
  id: string;
  value: string;
  description: string;
  state: V2WaypointDisplayState;
  isCurrent: boolean;
  isDestination: boolean;
  reached: boolean;
  reachedAt: string | null;
  moves: V2WaypointMove[];
  doneMoveCount: number;
  totalMoveCount: number;
  raw: WaypointSummary;
}

export interface V2ChartPresentationState {
  courseId: string;
  destinationText: string;
  status: CourseStatus;
  template: ChartRouteTemplate;
  waypoints: V2WaypointPresentation[];
  currentWaypoint: V2WaypointPresentation | null;
  currentWaypointIndex: number;
  isFinished: boolean;
  reachedCount: number;
  totalWaypoints: number;
  oneMove: V2WaypointMove | null;
  connectedVisionId?: string | null;
  hasConnectedVision: boolean;
  raw: CourseDetail;
}

export type V2ChartCompactState =
  | { state: 'none' }
  | {
      state: 'ready';
      courseId: string;
      destinationText: string;
      nextMove: string | null;
      reachedCount: number;
      waypointCount: number;
      isFinished: boolean;
    };
