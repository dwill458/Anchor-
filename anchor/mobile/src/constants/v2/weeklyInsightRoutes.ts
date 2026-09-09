/**
 * Route, continuation, and review window timing contracts for Anchor 2.0 Weekly Insight.
 *
 * UI-J does not edit central navigation files. A host that wires Weekly Insight into the
 * V2 navigator registers this route name with these params and honours the continuation contract.
 * See `REQUIRED_INTEGRATION_CHANGES` in `ANCHOR_2_UI_J_WEEKLY_INSIGHT.md`.
 */

/** Canonical route name for the Weekly Insight screen. */
export const V2_WEEKLY_INSIGHT_ROUTE = 'V2WeeklyInsight' as const;

/** Reflection feedback ratings matching the locked prototype. */
export type WeeklyInsightFeedbackRating = 'Yes' | 'Mostly' | 'Not really';

/**
 * Route params for `V2_WEEKLY_INSIGHT_ROUTE`.
 */
export interface V2WeeklyInsightRouteParams {
  /** Optional anchor filter if navigated from anchor context (e.g. Anchor Details or Progress). */
  anchorId?: string;
  /** Optional historical snapshot ID to display directly on launch. */
  snapshotId?: string;
  /** Optional week offset (0 = latest completed week, 1 = prior week, etc.). */
  weekOffset?: number;
}

/**
 * Callbacks supplied by the navigation host or parent container.
 */
export interface V2WeeklyInsightIntegrationCallbacks {
  /** Called when the user taps back. */
  onBack?: () => void;
  /** Called when the user navigates to an Anchor (e.g. from hero visual or activity detail). */
  onNavigateToAnchor?: (anchorId: string) => void;
  /** Called when the user navigates to Chart from connected activity. */
  onNavigateToChart?: (anchorId?: string) => void;
  /** Called when the user navigates to Vision from connected activity. */
  onNavigateToVision?: (anchorId?: string) => void;
  /** Called when the user rates the weekly insight. */
  onFeedbackSubmit?: (snapshotId: string, rating: WeeklyInsightFeedbackRating) => void;
}

/**
 * Weekly Review Window Timing Constants:
 * Sunday evening (19:00 local) through Tuesday morning/midday (12:00 local).
 */
export const WEEKLY_INSIGHT_WINDOW_START_DAY = 0; // Sunday
export const WEEKLY_INSIGHT_WINDOW_START_HOUR = 19; // 19:00 (7:00 PM)
export const WEEKLY_INSIGHT_WINDOW_END_DAY = 2; // Tuesday
export const WEEKLY_INSIGHT_WINDOW_END_HOUR = 12; // 12:00 PM (noon)
