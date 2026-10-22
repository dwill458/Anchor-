/**
 * Safe, account-authoritative Chart capability projection for /auth/me and
 * request enforcement. It intentionally exposes decisions, never RevenueCat
 * records, billing identifiers, rollout secrets, or provider configuration.
 */
import { getChartFeatureFlags, isAccountInChartRollout } from '../config/chartFlags';
import { prisma } from '../lib/prisma';
import { resolvePlannerApiKey, resolvePlannerQuotaConfig } from '../config/plannerPolicy';
import {
  evaluatePlannerQuota,
  type PlannerEntitlementUser,
  type PlannerQuotaState,
} from './PlannerEntitlementService';

export interface ChartCapabilityUser extends PlannerEntitlementUser {
  chartSchemaVersion: number;
}

export interface ChartCapabilities {
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
  plannerQuota: Pick<PlannerQuotaState, 'eligible' | 'limit' | 'remaining' | 'resetAt' | 'reason'>;
}

const unavailableQuota: ChartCapabilities['plannerQuota'] = {
  eligible: false,
  limit: 0,
  remaining: 0,
  resetAt: null,
  reason: 'planner_disabled',
};

function safeQuota(quota: PlannerQuotaState): ChartCapabilities['plannerQuota'] {
  return {
    eligible: quota.eligible,
    limit: quota.limit,
    remaining: quota.remaining,
    resetAt: quota.resetAt,
    reason: quota.reason,
  };
}

export async function getChartCapabilities(user: ChartCapabilityUser): Promise<ChartCapabilities> {
  const flags = getChartFeatureFlags();
  const chartEnabled = flags.chart_enabled && isAccountInChartRollout(user.id);
  const canViewChart = chartEnabled && user.chartSchemaVersion === 1;
  const canWrite = canViewChart && flags.chart_write_enabled;
  const plannerConfigured = resolvePlannerQuotaConfig() !== null && Boolean(resolvePlannerApiKey());
  const plannerEligible = canViewChart && flags.chart_ai_planner_enabled && plannerConfigured;
  const quota = plannerEligible
    ? // `evaluatePlannerQuota` also returns the resolved entitlement and the raw
      // usage counter. Those are server-side inputs to the decision, not part of
      // it, so narrow to the display-only fields before this reaches /auth/me.
      safeQuota(await evaluatePlannerQuota(prisma, user))
    : unavailableQuota;

  return {
    chartEnabled,
    chartReflectionsEnabled: canViewChart && flags.chart_reflections_enabled,
    chartAiPlannerEnabled: canViewChart && flags.chart_ai_planner_enabled && plannerConfigured,
    canViewChart,
    canCreateManualCourse: canWrite,
    canEditCourse: canWrite,
    // Existing owned work stays available after an entitlement expires.
    canCompleteExistingCourse: canWrite,
    canGenerateChartPlan: plannerEligible && quota.eligible,
    canRetrieveOwnedChartPlan: canViewChart,
    canAcceptExistingChartPlan: canWrite,
    canCreateAnchor: canWrite,
    canCreateOrEditReflections: canWrite && flags.chart_reflections_enabled,
    canViewOwnedCourseHistory: canViewChart,
    plannerQuota: quota,
  };
}
