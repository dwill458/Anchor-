/**
 * Presentation-only contracts for the Thread Event ledger.
 * Event detection, event IDs, and Thread values belong to the server ledger.
 */
export const V2_THREAD_EVENT_TYPES = [
  'ANCHOR_CREATED', 'THREAD_STRENGTHENED', 'THREAD_STABILIZED', 'THREAD_RECOVERED',
  'THREAD_SOFTENED', 'THREAD_RETURNED', 'EVOLUTION_STAGE_REACHED',
  'PRACTICE_MILESTONE_REACHED', 'ONE_MOVE_COMPLETED', 'WAYPOINT_REACHED',
  'DESTINATION_REACHED', 'COURSE_RESUMED', 'ANCHOR_COMPLETED',
  'RELEASE_RECOMMENDED', 'ANCHOR_RELEASED',
] as const;

export type V2ThreadEventType = (typeof V2_THREAD_EVENT_TYPES)[number];
export type V2ThreadEventSignificance = 'LOW' | 'MEDIUM' | 'HIGH' | 'MAJOR';
export type V2ThreadEventChannel = 'PRIMARY_IMMEDIATE' | 'COMPLETION_INLINE' | 'HOME_CONTEXT' | 'TODAY_CONTEXT' | 'WEEKLY_INSIGHT' | 'ARCHIVE_TIMELINE';
export type V2ThreadEventSource = 'THREAD_ENGINE' | 'PRACTICE_COMPLETION' | 'COURSE_EVENT' | 'ANCHOR_LIFECYCLE' | 'RELEASE_PROJECTION' | 'BACKFILL';
export type V2ThreadEventReceiptStatus = 'CLAIMED' | 'PRESENTED' | 'ACKNOWLEDGED' | 'DISMISSED';
export type V2PracticeCompletionType = 'FOCUS_SESSION' | 'DEEP_PRIME_SESSION' | 'VISUALIZE_SESSION';

export const V2_EVOLUTION_MILESTONES = {
  10: 'Grounded',
  25: 'Rooted',
  50: 'Embedded',
  100: 'Sovereign',
} as const;

export type V2EvolutionStage = (typeof V2_EVOLUTION_MILESTONES)[keyof typeof V2_EVOLUTION_MILESTONES];
export const V2_PRACTICE_MILESTONE_COUNTS = [10, 25, 50] as const;

/** Server-provided threshold validation / display mapping; never use this to infer a transition. */
export function evolutionStageForPersistedThreshold(value: unknown): V2EvolutionStage | null {
  return typeof value === 'number' && value in V2_EVOLUTION_MILESTONES
    ? V2_EVOLUTION_MILESTONES[value as keyof typeof V2_EVOLUTION_MILESTONES]
    : null;
}

export const V2_THREAD_EVENT_PRIORITY: Record<V2ThreadEventType, number> = {
  DESTINATION_REACHED: 130,
  ANCHOR_RELEASED: 120,
  ANCHOR_COMPLETED: 110,
  EVOLUTION_STAGE_REACHED: 100,
  WAYPOINT_REACHED: 90,
  THREAD_RECOVERED: 80,
  PRACTICE_MILESTONE_REACHED: 70,
  RELEASE_RECOMMENDED: 60,
  THREAD_STABILIZED: 50,
  THREAD_RETURNED: 40,
  THREAD_STRENGTHENED: 30,
  THREAD_SOFTENED: 20,
  ONE_MOVE_COMPLETED: 10,
  COURSE_RESUMED: 15,
  ANCHOR_CREATED: 5,
};

export function channelForThreadEvent(event: Pick<{ eventType: V2ThreadEventType; significance: V2ThreadEventSignificance }, 'eventType' | 'significance'>): V2ThreadEventChannel {
  if (event.significance === 'LOW') return 'COMPLETION_INLINE';
  if (event.eventType === 'RELEASE_RECOMMENDED' || event.eventType === 'COURSE_RESUMED' || event.eventType === 'THREAD_SOFTENED') return 'HOME_CONTEXT';
  return event.significance === 'MEDIUM' ? 'COMPLETION_INLINE' : 'PRIMARY_IMMEDIATE';
}
