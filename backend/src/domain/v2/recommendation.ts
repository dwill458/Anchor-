import { z } from 'zod';

export const RECOMMENDATION_SIGNAL_TYPES = [
  'destination_reached',
  'waypoint_reached',
  'intention_completed',
] as const;
export type RecommendationSignalType = (typeof RECOMMENDATION_SIGNAL_TYPES)[number];

export const RECOMMENDATION_ACTIONS = ['Release', 'Visualize', 'Deep Prime', 'Focus'] as const;
export type RecommendationAction = (typeof RECOMMENDATION_ACTIONS)[number];

export interface BaseRecommendationSignal {
  id: string;
  type: RecommendationSignalType;
  occurredAt: string;
}

export interface DestinationReachedSignal extends BaseRecommendationSignal {
  type: 'destination_reached';
  courseId: string;
  destinationTitle: string;
}

export interface WaypointReachedSignal extends BaseRecommendationSignal {
  type: 'waypoint_reached';
  courseId: string;
  waypointId: string;
  waypointTitle: string;
}

export interface IntentionCompletedSignal extends BaseRecommendationSignal {
  type: 'intention_completed';
  anchorId: string;
  intentionText: string;
}

export type RecommendationSignal =
  | DestinationReachedSignal
  | WaypointReachedSignal
  | IntentionCompletedSignal;

export interface RecommendationVisionContext {
  exists: boolean;
  seenToday: boolean;
  visionId?: string | null;
}

export interface RecommendationThreadContext {
  delta7d: number | null;
  delta7dStatus: 'AVAILABLE' | 'UNAVAILABLE';
  /** Backward-compatible alias retained for the existing V2 response shape. */
  status: 'AVAILABLE' | 'UNAVAILABLE';
  blockerReason?: string;
}

export interface RecommendationEvaluation {
  action: RecommendationAction;
  reason: string;
}

export interface RecommendationContextResponse {
  anchorId: string;
  completionSignal: RecommendationSignal | null;
  vision: RecommendationVisionContext;
  thread: RecommendationThreadContext;
  recommendation: RecommendationEvaluation;
}

export const AcknowledgeSignalSchema = z.object({
  signalType: z.enum(RECOMMENDATION_SIGNAL_TYPES).optional(),
});
