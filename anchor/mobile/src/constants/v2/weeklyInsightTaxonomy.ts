/**
 * Canonical 18-rule Weekly Insight taxonomy, thresholds, and color mappings.
 *
 * Sourced directly from:
 * - Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx
 * - Anchor_2.0_Weekly_Insight_Prototype.html
 */

export type WeeklyInsightRuleType =
  | 'DESTINATION_REACHED'
  | 'COMPLETION_RELEASE'
  | 'EVOLUTION_MILESTONE'
  | 'WAYPOINT_REACHED'
  | 'PRACTICE_MILESTONE'
  | 'RECOVERY'
  | 'QUIET'
  | 'RETURN'
  | 'NEW_USER'
  | 'LOW_ACTIVITY'
  | 'CHART_EXECUTION'
  | 'CHART_ALIGNMENT'
  | 'DEPTH'
  | 'CONSISTENCY'
  | 'PRIMARY_ANCHOR'
  | 'VISUALIZATION'
  | 'SPLIT_ATTENTION'
  | 'GENERAL';

export type WeeklyInsightVisualType =
  | 'anchor'
  | 'evolution'
  | 'release'
  | 'thread'
  | 'chart'
  | 'chartReached'
  | 'activity';

/**
 * Versioned product tuning thresholds (V1).
 * All rules evaluate against these constants; changing them in future updates
 * will not rewrite historical snapshots.
 */
export const V1_INSIGHT_THRESHOLDS = {
  /** Days away to qualify as a Return */
  returnDaysInactive: 14,
  /** Minimum completed prior weeks to have comparable history */
  minWeeksForComparableHistory: 2,
  /** Net gain from weekly low point to qualify as strong recovery */
  strongRecoveryMinDelta: 10,
  /** Completed practices after low point */
  strongRecoveryMinPracticesAfterLow: 2,
  /** Chart execution One Moves completed */
  chartExecutionMinOneMoves: 2,
  /** Chart execution waypoint-linked practices */
  chartExecutionMinLinkedPractices: 1,
  /** Chart alignment minimum total practices */
  chartAlignmentMinPractices: 3,
  /** Chart alignment minimum linked practice ratio (65%) */
  chartAlignmentMinLinkedRatio: 0.65,
  /** Depth minimum practices */
  depthMinPractices: 3,
  /** Depth minimum Deep Prime sessions */
  depthMinDeepPrime: 2,
  /** Depth minimum Deep Prime percentage points gain vs prior week (or 50%+ Deep Prime) */
  depthMinShareGainVsPriorWeek: 20,
  /** Consistency minimum active days */
  consistencyMinActiveDays: 4,
  /** Consistency max allowed net thread decay (e.g. -2) */
  consistencyMaxThreadLoss: 2,
  /** Dominant Anchor minimum practices */
  dominantAnchorMinPractices: 4,
  /** Dominant Anchor share ratio (65%+) */
  dominantAnchorMinShareRatio: 0.65,
  /** Dominant Anchor lead over second anchor (25+ percentage points) */
  dominantAnchorMinShareLeadRatio: 0.25,
  /** Visualization minimum completed Visualize sessions */
  visualizationMinSessions: 2,
  /** Visualization minimum durable Vision revisits */
  visualizationMinRevisits: 2,
  /** Split attention minimum practices */
  splitAttentionMinPractices: 4,
  /** Split attention minimum unique anchors */
  splitAttentionMinAnchors: 3,
  /** Split attention maximum top anchor share (no anchor > 50%) */
  splitAttentionMaxAnchorShare: 0.50,
} as const;

/**
 * Editorial accent colors matching the prototype & spec.
 */
export const WEEKLY_INSIGHT_COLORS = {
  career: '#3157D8',
  health: '#2FA879',
  ambition: '#E85D32',
  focus: '#8B5CF6',
  prime: '#E0A038',
  visualize: '#3B82C4',
  release: '#DD5F2C',
  neutral: '#62666D',
} as const;

export type WeeklyInsightColorKey = keyof typeof WEEKLY_INSIGHT_COLORS;
