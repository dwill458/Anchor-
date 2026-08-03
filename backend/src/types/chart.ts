import type {
  CourseAnchorRole,
  CourseEventType,
  CourseStatus,
  ReflectionMood,
  ReflectionPromptType,
  ReflectionSource,
} from '@prisma/client';

export type WaypointState =
  | 'UPCOMING'
  | 'CURRENT'
  | 'REACHED'
  | 'BLOCKED'
  | 'SKIPPED'
  | 'CANCELLED';

export type BlockedReason = 'ANCHOR_RELEASED' | 'ANCHOR_UNLINKED' | 'ANCHOR_DELETED';

export type PracticeEntrySource =
  | 'practice_hero'
  | 'practice_deep_prime_card'
  | 'practice_focus_card'
  | 'practice_visualize_card'
  | 'practice_release_card'
  | 'anchor_detail'
  | 'sanctuary_prime_anchor'
  | 'widget'
  | 'shortcut'
  | 'evolve'
  | 'chart'
  | 'chart_waypoint_detail';

export const PRACTICE_ENTRY_SOURCES: readonly PracticeEntrySource[] = [
  'practice_hero',
  'practice_deep_prime_card',
  'practice_focus_card',
  'practice_visualize_card',
  'practice_release_card',
  'anchor_detail',
  'sanctuary_prime_anchor',
  'widget',
  'shortcut',
  'evolve',
  'chart',
  'chart_waypoint_detail',
];

export type AnchorSnapshot = {
  snapshotVersion: 1;
  anchorId: string;
  intentionText: string;
  category: string;
  planetaryTier: string | null;
  enhancedImageUrl: string | null;
  releasedAtUnlink: boolean;
  capturedAt: string;
};

export type AnchorLinkSummary = {
  id: string;
  role: CourseAnchorRole;
  anchorId: string | null;
  anchorAvailable: boolean;
  snapshot: AnchorSnapshot;
  linkedAt: string;
};

export type WaypointSummary = {
  id: string;
  courseId: string;
  position: number;
  title: string;
  description: string | null;
  state: WaypointState;
  blockedReason: BlockedReason | null;
  reachedAt: string | null;
  skippedAt: string | null;
  cancelledAt: string | null;
  anchorLink: AnchorLinkSummary | null;
};

export type CourseObservation = {
  type:
    | 'PRACTICE_COUNT_WEEK'
    | 'PRACTICE_STREAK'
    | 'THEME_REPEAT'
    | 'WAYPOINT_DURATION'
    | 'REFLECTION_GAP';
  text: string;
};

export type CourseSummary = {
  id: string;
  destinationText: string;
  status: CourseStatus;
  version: number;
  currentWaypointId: string | null;
  waypointCount: number;
  reachedCount: number;
  plottedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  destinationAnchorLink: AnchorLinkSummary | null;
  observations?: CourseObservation[];
  needsRepair?: true;
};

export type CourseDetail = CourseSummary & {
  waypoints: WaypointSummary[];
  migrationRequired?: boolean;
};

export type CourseLogEntry = {
  id: string;
  eventType: CourseEventType;
  message: string;
  waypointId: string | null;
  occurredAt: string;
  recordedAt: string;
  snapshot: Record<string, string | number> | null;
  reflection: {
    id: string;
    promptType: string;
    body: string | null;
    structuredContent: object | null;
    moodAfter: string | null;
  } | null;
  practiceSession: {
    id: string;
    practiceMode: string;
    completedDurationSeconds: number;
  } | null;
  anchorLink: AnchorLinkSummary | null;
};

export type CreateCourseRequest = {
  idempotencyKey: string;
  destinationText: string;
  waypoints?: Array<{ title: string; description?: string }>;
  fromProposalId?: string;
};

export type UpdateCourseRequest = {
  expectedCourseVersion: number;
  destinationText?: string;
  status?: 'ACTIVE';
};

export type AddWaypointRequest = {
  idempotencyKey: string;
  expectedCourseVersion: number;
  title: string;
  description?: string;
  afterWaypointId?: string | null;
};

export type ReorderWaypointsRequest = {
  expectedCourseVersion: number;
  orderedWaypointIds: string[];
};

export type SkipWaypointRequest = {
  idempotencyKey: string;
  expectedCourseVersion: number;
  reason?: string;
};

export type CancelWaypointRequest = {
  idempotencyKey: string;
  expectedCourseVersion: number;
};

export type LinkAnchorRequest = {
  idempotencyKey: string;
  expectedCourseVersion: number;
  anchorId: string;
  role: CourseAnchorRole;
  waypointId?: string;
  replaceLinkId?: string;
  acknowledgedReuse?: boolean;
};

export type CreateReflectionRequest = {
  idempotencyKey: string;
  source: ReflectionSource;
  promptType: ReflectionPromptType;
  promptVersion: number;
  body?: string;
  structuredContent?: { whatHelped?: string; whatLearned?: string };
  moodBefore?: ReflectionMood;
  moodAfter?: ReflectionMood;
  practiceSessionId?: string;
  anchorId?: string;
  courseId?: string;
  waypointId?: string;
};

export type UpdateReflectionRequest = {
  body?: string;
  structuredContent?: { whatHelped?: string; whatLearned?: string };
  moodAfter?: ReflectionMood;
  aiConsentGranted?: boolean;
};

export type CompleteWaypointRequest = {
  idempotencyKey: string;
  expectedCourseVersion: number;
  reflection?: {
    body?: string;
    structuredContent?: { whatHelped?: string; whatLearned?: string };
    moodAfter?: ReflectionMood;
    promptType: 'WAYPOINT_COMPLETION';
    promptVersion: number;
    idempotencyKey: string;
  };
  supportingPracticeSessionId?: string;
};

export type CompleteWaypointResponse = {
  course: CourseSummary;
  completedWaypoint: WaypointSummary;
  nextWaypoint: WaypointSummary | null;
  courseCompleted: boolean;
  completionEventId: string;
  replayed: boolean;
  reflectionId?: string;
};

export type CoursePlanProposal = {
  proposalId: string;
  courseId: string | null;
  baseCourseVersion: number | null;
  plannerVersion: string;
  modelVersion: string;
  inputHash: string;
  generationSource: 'gemini' | 'deterministic_fallback';
  fallbackReason: string | null;
  destinationInterpretation: string;
  waypoints: Array<{
    clientKey: string;
    title: string;
    description: string;
    suggestedAnchorIntention?: string;
  }>;
  createdAt: string;
  expiresAt: string;
};

export type CoursePlanProposalBoundary = {
  acceptPlanProposal: (args: {
    userId: string;
    courseId: string;
    proposalId: string;
    acceptedClientKeys: string[];
    idempotencyKey: string;
    expectedCourseVersion: number;
  }) => Promise<CourseDetail>;
};

export type ChartFeatureFlags = {
  chart_enabled: boolean;
  chart_write_enabled: boolean;
  chart_ai_planner_enabled: boolean;
  chart_reflections_enabled: boolean;
  chart_notifications_enabled: boolean;
  chart_existing_user_intro_enabled: boolean;
};
