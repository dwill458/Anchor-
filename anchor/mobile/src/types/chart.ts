/**
 * Mobile Chart contract.
 *
 * These types intentionally mirror backend/src/types/chart.ts. The server's
 * derived `state` is display data; the client does not derive or persist its
 * own waypoint lifecycle.
 */

export type CourseStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type CourseAnchorRole = 'DESTINATION' | 'WAYPOINT_PRIMARY';

export type ReflectionSource = 'POST_PRACTICE' | 'MANUAL_COURSE' | 'WAYPOINT_COMPLETION' | 'COURSE_COMPLETION' | 'ANCHOR_RELEASE';

export type ReflectionPromptType = 'HOW_DO_YOU_FEEL_NOW' | 'WHAT_CAME_UP' | 'WHAT_STOOD_OUT' | 'WHAT_FELT_STRONGEST' | 'COURSE_STATUS' | 'WAYPOINT_COMPLETION' | 'FINAL_REFLECTION';

export type ReflectionMood = 'CALM' | 'FOCUSED' | 'ENERGIZED' | 'UNCHANGED' | 'DISTRACTED';

export type ReflectionStructuredContent = {
  whatHelped?: string;
  whatLearned?: string;
};

/** Canonical Reflection shape returned by the Workstream A API. */
export type ReflectionRecord = {
  id: string;
  source: ReflectionSource;
  promptType: ReflectionPromptType;
  promptVersion: number;
  body: string | null;
  structuredContent: ReflectionStructuredContent | null;
  moodBefore: ReflectionMood | null;
  moodAfter: ReflectionMood | null;
  practiceSessionId: string | null;
  anchorId: string | null;
  courseId: string | null;
  waypointId: string | null;
  aiConsentGrantedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  idempotencyKey: string;
  schemaVersion: number;
};

export type CreateReflectionRequest = {
  idempotencyKey: string;
  source: ReflectionSource;
  promptType: ReflectionPromptType;
  promptVersion: number;
  body?: string;
  structuredContent?: ReflectionStructuredContent;
  moodBefore?: ReflectionMood;
  moodAfter?: ReflectionMood;
  practiceSessionId?: string;
  anchorId?: string;
  courseId?: string;
  waypointId?: string;
};

export type UpdateReflectionRequest = Pick<Partial<CreateReflectionRequest>, 'body' | 'structuredContent' | 'moodAfter'> & { aiConsentGranted?: boolean };

export type WaypointState = 'UPCOMING' | 'CURRENT' | 'REACHED' | 'BLOCKED' | 'SKIPPED' | 'CANCELLED';

export type BlockedReason = 'ANCHOR_RELEASED' | 'ANCHOR_UNLINKED' | 'ANCHOR_DELETED';

export type CourseEventType =
  | 'COURSE_CREATED'
  | 'DESTINATION_CHANGED'
  | 'WAYPOINT_ADDED'
  | 'WAYPOINT_REORDERED'
  | 'DESTINATION_ANCHOR_LINKED'
  | 'WAYPOINT_ANCHOR_LINKED'
  | 'PRACTICE_COMPLETED'
  | 'REFLECTION_ADDED'
  | 'WAYPOINT_REACHED'
  | 'WAYPOINT_SKIPPED'
  | 'WAYPOINT_CANCELLED'
  | 'WAYPOINT_BLOCKED'
  | 'WAYPOINT_UNBLOCKED'
  | 'COURSE_COMPLETED'
  | 'COURSE_ARCHIVED'
  | 'COURSE_RESTORED';

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
  type: 'PRACTICE_COUNT_WEEK' | 'PRACTICE_STREAK' | 'THEME_REPEAT' | 'WAYPOINT_DURATION' | 'REFLECTION_GAP';
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
  reflection: Pick<ReflectionRecord, 'id' | 'promptType' | 'body' | 'structuredContent' | 'moodAfter'> | null;
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

/** A server-validated, review-only Course suggestion. */
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
  waypoints: Array<{ clientKey: string; title: string; description: string }>;
  createdAt: string;
  expiresAt: string;
};

export type GenerateCoursePlanRequest = {
  destinationText: string;
  idempotencyKey: string;
};

/** Safe denial reasons returned by the server (Phase 0 amendment F1). */
export type CoursePlanDenialReason =
  | 'planner_disabled'
  | 'quota_config_unavailable'
  | 'entitlement_unavailable'
  | 'not_entitled'
  | 'entitlement_expired'
  | 'quota_exhausted';

/**
 * Display-only quota state. The server alone authorizes generation; this
 * describes a decision the server already made and never stands in for it.
 */
export type CoursePlanQuota = {
  eligible: boolean;
  limit: number;
  remaining: number;
  /** ISO timestamp for windowed caps; null for lifetime and zero caps. */
  resetAt: string | null;
  reason: CoursePlanDenialReason | null;
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

export type EditWaypointRequest = {
  expectedCourseVersion: number;
  title?: string;
  description?: string | null;
};

export type ReorderWaypointsRequest = {
  expectedCourseVersion: number;
  orderedWaypointIds: string[];
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

export type ChartFeatureFlags = {
  chart_enabled: boolean;
  chart_write_enabled: boolean;
  chart_ai_planner_enabled: boolean;
  chart_reflections_enabled: boolean;
  chart_notifications_enabled: boolean;
  chart_existing_user_intro_enabled: boolean;
};

/** Safe server capability projection from /api/auth/me. Never authorize from a cached value. */
export type ChartCapabilities = {
  chartEnabled: boolean;
  chartReflectionsEnabled: boolean;
  chartAiPlannerEnabled: boolean;
  canViewChart: boolean;
  canCreateManualCourse: boolean;
  canEditCourse: boolean;
  canCompleteExistingCourse: boolean;
  canGenerateChartPlan: boolean;
  canRetrieveOwnedChartPlan: boolean;
  canAcceptExistingChartPlan: boolean;
  canCreateAnchor: boolean;
  canCreateOrEditReflections: boolean;
  canViewOwnedCourseHistory: boolean;
  plannerQuota: Pick<CoursePlanQuota, 'eligible' | 'limit' | 'remaining' | 'resetAt' | 'reason'>;
};

export type ChartResponseEnvelope<T> = {
  success: boolean;
  data?: T;
  migrationRequired?: boolean;
  pagination?: { nextCursor: string | null; hasMore: boolean };
  error?: { code: string; message: string; details?: Record<string, unknown> };
};

export type ChartStackParamList = {
  ChartHome: undefined;
  CourseSetup: { fromProposalId?: string } | undefined;
  CourseEditor: { courseId: string };
  AIPlanReview: { courseId: string | null; proposalId: string };
  WaypointDetail: { courseId: string; waypointId: string };
  CourseLog: { courseId: string; waypointId?: string };
  ReflectionComposer: {
    source: ReflectionSource;
    promptType: ReflectionPromptType;
    courseId?: string;
    waypointId?: string;
    practiceSessionId?: string;
    anchorId?: string;
    promptVersion?: number;
    draftKey?: string;
    reflectionId?: string;
  };
  CourseDetails: { courseId: string };
  CourseCompletion: { courseId: string };
  CompletedJourney: { courseId: string };
};

export type ChartErrorCode =
  | 'COURSE_NOT_FOUND'
  | 'ACTIVE_COURSE_EXISTS'
  | 'COURSE_VERSION_CONFLICT'
  | 'WAYPOINT_NOT_FOUND'
  | 'ANCHOR_LINK_INVALID'
  | 'ANCHOR_UNAVAILABLE'
  | 'FEATURE_DISABLED'
  | 'MIGRATION_REQUIRED'
  | 'ENTITLEMENT_REQUIRED'
  | 'VALIDATION_ERROR'
  | 'NETWORK'
  | 'OFFLINE';

export const CHART_CACHE_KEY_PREFIX = 'anchor:chart:course:';
export const CHART_LOG_CACHE_KEY_PREFIX = 'anchor:chart:log:';
export const CHART_REFLECTION_DRAFTS_KEY_PREFIX = 'anchor:chart:reflection-drafts:';
export const CHART_STALE_AFTER_MS = 5 * 60 * 1000;

export const DEFAULT_CHART_FEATURE_FLAGS: ChartFeatureFlags = {
  chart_enabled: false,
  chart_write_enabled: false,
  chart_ai_planner_enabled: false,
  chart_reflections_enabled: false,
  chart_notifications_enabled: false,
  chart_existing_user_intro_enabled: false,
};

export function resolveChartFeatureFlags(serverFlags?: Partial<ChartFeatureFlags> | null, buildEnabled = process.env.EXPO_PUBLIC_ENABLE_CHART === 'true'): ChartFeatureFlags {
  const server = serverFlags ?? DEFAULT_CHART_FEATURE_FLAGS;
  return {
    chart_enabled: buildEnabled && server.chart_enabled === true,
    chart_write_enabled: buildEnabled && server.chart_write_enabled === true,
    chart_ai_planner_enabled: buildEnabled && server.chart_ai_planner_enabled === true,
    chart_reflections_enabled: buildEnabled && server.chart_reflections_enabled === true,
    chart_notifications_enabled: buildEnabled && server.chart_notifications_enabled === true,
    chart_existing_user_intro_enabled: buildEnabled && server.chart_existing_user_intro_enabled === true,
  };
}

/** A missing capability projection is deliberately denied, including during refresh failures. */
export function canViewChart(
  serverFlags?: Partial<ChartFeatureFlags> | null,
  capabilities?: Partial<ChartCapabilities> | null,
  buildEnabled = process.env.EXPO_PUBLIC_ENABLE_CHART === 'true'
): boolean {
  return resolveChartFeatureFlags(serverFlags, buildEnabled).chart_enabled && capabilities?.canViewChart === true;
}
