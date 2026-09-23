import { apiClient, ApiClientError } from '@/services/ApiClient';
import type { CourseDetail, CourseSummary, WaypointKind } from '@/types/chart';

/**
 * Anchor 2.0 Chart endpoints (/api/v2). Waypoint completion, edits, reorder
 * and removal stay on the canonical /api/courses client (ChartApiClient).
 */

export type ChartAnchorSummary = {
  id: string;
  intentionText: string;
  category: string;
  enhancedImageUrl: string | null;
  released: boolean;
};

export type ChartForAnchor = {
  anchor: ChartAnchorSummary;
  chart: CourseDetail | null;
  history: CourseSummary[];
  stats: { completedMoveCount: number; practiceCount: number } | null;
};

export type ChartComplexity = 'SIMPLE' | 'MODERATE' | 'COMPLEX';

export type ChartProposalWaypoint = {
  clientKey: string;
  title: string;
  rationale: string | null;
  kind: WaypointKind;
  metricLabel: string | null;
  metricTarget: number | null;
  metricBaseline: number | null;
};

export type ChartProposal = {
  proposalId: string;
  kind: 'CREATE' | 'ADJUST';
  anchorId: string | null;
  courseId: string | null;
  baseCourseVersion: number | null;
  destination: string;
  complexity: ChartComplexity;
  waypoints: ChartProposalWaypoint[];
  suggestedOneMove: { title: string; rationale: string | null } | null;
  guidance: string | null;
  generation: { source: 'ai' | 'template'; fallbackUsed: boolean; needsNaming: boolean };
  createdAt: string;
  expiresAt: string;
};

export type ChartPlanResponse =
  | { status: 'needs_context'; followUpQuestion: string }
  | { status: 'proposal'; proposal: ChartProposal };

export type ChartAdjustmentReason =
  | 'TOO_MANY_STEPS'
  | 'TOO_FEW_STEPS'
  | 'DIFFERENT_MILESTONES'
  | 'FURTHER_ALONG'
  | 'CHANGE_DESTINATION'
  | 'OTHER';

export type RouteWaypointInput = {
  id?: string | null;
  title: string;
  rationale?: string | null;
  kind?: WaypointKind;
  metricLabel?: string | null;
  metricBaseline?: number | null;
  metricTarget?: number | null;
};

export type MoveCompletionResult = {
  chart: CourseDetail;
  completedMoveId: string;
  nextMoveId: string | null;
  replayed: boolean;
};

/** Failure categories the UI can speak to. Never carries provider detail. */
export type ChartFailureKind =
  | 'offline'
  | 'unavailable'
  | 'disabled'
  | 'conflict'
  | 'not_found'
  | 'anchor_released'
  | 'rate_limited'
  | 'confirmation_required'
  | 'invalid'
  | 'unknown';

export class ChartRequestError extends Error {
  constructor(
    readonly kind: ChartFailureKind,
    readonly code: string | undefined,
    readonly details?: Record<string, unknown>
  ) {
    super(`chart_request_${kind}`);
    this.name = 'ChartRequestError';
  }
}

export function classifyChartError(error: unknown): ChartRequestError {
  if (error instanceof ChartRequestError) return error;
  if (error instanceof ApiClientError) {
    const code = error.code;
    const details = error.details;
    if (code === 'FEATURE_DISABLED') return new ChartRequestError('disabled', code, details);
    if (code === 'ROUTE_REWRITE_CONFIRMATION_REQUIRED') return new ChartRequestError('confirmation_required', code, details);
    if (code === 'ANCHOR_UNAVAILABLE') return new ChartRequestError('anchor_released', code, details);
    if (code === 'CHART_PLAN_RATE_LIMITED' || error.status === 429) return new ChartRequestError('rate_limited', code, details);
    if (code === 'CHART_ADJUST_UNAVAILABLE' || (error.status ?? 0) >= 500) return new ChartRequestError('unavailable', code, details);
    // A 404 from an endpoint that does not exist (older backend, Chart not
    // deployed) is NOT a missing Anchor: only the domain codes mean that.
    if (error.status === 404) {
      const missingEntity = code === 'ANCHOR_NOT_FOUND' || code === 'COURSE_NOT_FOUND' || code === 'WAYPOINT_NOT_FOUND' || code === 'MOVE_NOT_FOUND' || code === 'USER_NOT_FOUND';
      return new ChartRequestError(missingEntity ? 'not_found' : 'unavailable', code, details);
    }
    if (error.status === 409) return new ChartRequestError('conflict', code, details);
    if (error.status === 400 || error.status === 422) return new ChartRequestError('invalid', code, details);
    return new ChartRequestError('unknown', code, details);
  }
  if (error instanceof Error && /network|timeout|connection/i.test(error.message)) {
    return new ChartRequestError('offline', undefined);
  }
  return new ChartRequestError('unknown', undefined);
}

type Envelope<T> = { success: boolean; data: T };

async function call<T>(operation: () => Promise<{ data: Envelope<T> }>): Promise<T> {
  try {
    const response = await operation();
    return response.data.data;
  } catch (error) {
    throw classifyChartError(error);
  }
}

const enc = encodeURIComponent;
/** Route generation waits on a model; the client allows the full server chain. */
const PLAN_TIMEOUT_MS = 60_000;

export const chartV2Api = {
  getForAnchor(anchorId: string, signal?: AbortSignal): Promise<ChartForAnchor> {
    return call(() => apiClient.get(`/api/v2/anchors/${enc(anchorId)}/chart`, { signal }));
  },

  plan(
    anchorId: string,
    body: {
      idempotencyKey: string;
      startingContext?: string | null;
      followUp?: { question: string; answer: string } | null;
    }
  ): Promise<ChartPlanResponse> {
    return call(() =>
      apiClient.post(`/api/v2/anchors/${enc(anchorId)}/chart/plan`, body, { timeout: PLAN_TIMEOUT_MS })
    );
  },

  adjust(
    anchorId: string,
    body: {
      idempotencyKey: string;
      reason: ChartAdjustmentReason;
      detail?: string | null;
      courseId?: string | null;
      startingContext?: string | null;
      draft?: { destination: string; waypoints: Array<Pick<RouteWaypointInput, 'title' | 'kind' | 'metricTarget' | 'metricLabel'>> } | null;
    }
  ): Promise<ChartPlanResponse> {
    return call(() =>
      apiClient.post(`/api/v2/anchors/${enc(anchorId)}/chart/plan/adjust`, body, { timeout: PLAN_TIMEOUT_MS })
    );
  },

  create(
    anchorId: string,
    body: {
      idempotencyKey: string;
      destinationText: string;
      startingContext?: string | null;
      proposalId?: string | null;
      complexity?: ChartComplexity | null;
      waypoints: Omit<RouteWaypointInput, 'id'>[];
      oneMove?: { title: string; rationale?: string | null } | null;
    }
  ): Promise<CourseDetail> {
    return call(() => apiClient.post(`/api/v2/anchors/${enc(anchorId)}/chart`, body));
  },

  applyRoute(
    courseId: string,
    body: {
      expectedCourseVersion: number;
      idempotencyKey: string;
      destinationText?: string | null;
      waypoints: RouteWaypointInput[];
      proposalId?: string | null;
      adjustmentReason?: string | null;
      confirmRewrite?: boolean;
    }
  ): Promise<CourseDetail> {
    return call(() => apiClient.put(`/api/v2/charts/${enc(courseId)}/route`, body));
  },

  addMove(
    courseId: string,
    body: { idempotencyKey: string; waypointId: string; title: string; rationale?: string | null; makeCurrent?: boolean }
  ): Promise<CourseDetail> {
    return call(() => apiClient.post(`/api/v2/charts/${enc(courseId)}/moves`, body));
  },

  updateMove(
    courseId: string,
    moveId: string,
    body: { title?: string; rationale?: string | null; accept?: boolean; makeCurrent?: boolean }
  ): Promise<CourseDetail> {
    return call(() => apiClient.patch(`/api/v2/charts/${enc(courseId)}/moves/${enc(moveId)}`, body));
  },

  completeMove(courseId: string, moveId: string): Promise<MoveCompletionResult> {
    return call(() => apiClient.post(`/api/v2/charts/${enc(courseId)}/moves/${enc(moveId)}/complete`));
  },

  dismissMove(courseId: string, moveId: string): Promise<CourseDetail> {
    return call(() => apiClient.post(`/api/v2/charts/${enc(courseId)}/moves/${enc(moveId)}/dismiss`));
  },

  suggestMoves(courseId: string, waypointId: string): Promise<{ available: boolean; chart: CourseDetail | null }> {
    return call(() =>
      apiClient.post(`/api/v2/charts/${enc(courseId)}/waypoints/${enc(waypointId)}/suggest-moves`, undefined, {
        timeout: PLAN_TIMEOUT_MS,
      })
    );
  },

  updateProgress(
    courseId: string,
    waypointId: string,
    body: { expectedCourseVersion: number; metricCurrent: number | null }
  ): Promise<CourseDetail> {
    return call(() => apiClient.patch(`/api/v2/charts/${enc(courseId)}/waypoints/${enc(waypointId)}/progress`, body));
  },
};

/** Stable per-action key: the same user action retried maps to one server write. */
export function chartActionKey(...parts: string[]): string {
  return ['chart2', ...parts].join(':').slice(0, 190);
}

export function freshKey(prefix: string): string {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}
