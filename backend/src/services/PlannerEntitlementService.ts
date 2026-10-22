/**
 * Server-authoritative entitlement and quota for the AI Course Planner
 * (Phase 0 amendment F1).
 *
 * Entitlement is derived from the mechanism the product already treats as
 * authoritative — RevenueCat plus the persisted subscription columns and the
 * 7-day trial window frozen in `PracticeAccessService` — so the planner does
 * not invent a second notion of "paid". Nothing here trusts client input.
 */

import type { Prisma } from '@prisma/client';
import {
  capForEntitlement,
  resolvePlannerQuotaConfig,
  type PlannerEntitlementState,
  type PlannerQuotaConfig,
} from '../config/plannerPolicy';
import { getRevenueCatAccess } from './RevenueCatEntitlementService';

/** Same window as `PracticeAccessService.TRIAL_DURATION_MS`. */
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type PlannerDenialReason =
  | 'planner_disabled'
  | 'provider_unavailable'
  | 'quota_config_unavailable'
  | 'entitlement_unavailable'
  | 'not_entitled'
  | 'entitlement_expired'
  | 'quota_exhausted';

export interface PlannerEntitlementUser {
  id: string;
  isComped: boolean;
  subscriptionStatus: string;
  subscriptionId: string | null;
  trialStartedAt: Date | null;
}

/** Only safe, non-identifying state. Returned to the client as-is. */
export interface PlannerQuotaState {
  eligible: boolean;
  entitlement: PlannerEntitlementState | null;
  limit: number;
  remaining: number;
  used: number;
  /** ISO timestamp for windowed caps; null for lifetime and zero caps. */
  resetAt: string | null;
  reason: PlannerDenialReason | null;
}

/** Minimal surface so quota can be counted inside or outside a transaction. */
export interface ProposalCounter {
  aIPlanProposal: { count: (args: { where: Prisma.AIPlanProposalWhereInput }) => Promise<number> };
}

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function nextUtcDayStart(now: Date): Date {
  const start = startOfUtcDay(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Returns null when entitlement cannot be established, which callers must treat
 * as a denial rather than as "free but allowed".
 */
export async function resolvePlannerEntitlement(
  user: PlannerEntitlementUser,
  now: Date = new Date()
): Promise<PlannerEntitlementState | null> {
  if (!user?.id) return null;
  if (user.isComped) return 'pro';

  // Null means RevenueCat is unconfigured or temporarily unavailable; the
  // persisted server-side status is then authoritative. Client input never is.
  const liveAccess = await getRevenueCatAccess(user.id, now);
  const paidFromServer = liveAccess
    ? liveAccess.isActive
    : user.subscriptionStatus === 'pro' || user.subscriptionStatus === 'pro_annual';
  if (paidFromServer) return 'pro';

  const trialStartedAt = user.trialStartedAt;
  if (!(trialStartedAt instanceof Date) || Number.isNaN(trialStartedAt.getTime())) {
    // No resolvable trial anchor: fail closed instead of assuming a fresh trial.
    return null;
  }
  return now.getTime() < trialStartedAt.getTime() + TRIAL_DURATION_MS ? 'trial' : 'expired';
}

/**
 * Counts only successfully persisted proposals for this account.
 *
 * Trial uses a lifetime count and Pro a rolling UTC day, per F1. Counting every
 * persisted proposal for the trial window is deliberately conservative: it can
 * never over-grant.
 */
export async function countPersistedProposals(
  client: ProposalCounter,
  userId: string,
  entitlement: PlannerEntitlementState,
  now: Date
): Promise<number> {
  if (entitlement === 'pro') {
    return client.aIPlanProposal.count({
      where: { userId, createdAt: { gte: startOfUtcDay(now) } },
    });
  }
  if (entitlement === 'trial') {
    return client.aIPlanProposal.count({ where: { userId } });
  }
  // free and expired carry a zero cap; no count can make them eligible.
  return 0;
}

function denied(
  reason: PlannerDenialReason,
  entitlement: PlannerEntitlementState | null,
  limit = 0,
  used = 0,
  resetAt: string | null = null
): PlannerQuotaState {
  return { eligible: false, entitlement, limit, remaining: 0, used, resetAt, reason };
}

/**
 * Evaluates the full generation gate. Callers must not invoke the provider or
 * persist anything when `eligible` is false.
 */
export async function evaluatePlannerQuota(
  client: ProposalCounter,
  user: PlannerEntitlementUser,
  now: Date = new Date(),
  config: PlannerQuotaConfig | null = resolvePlannerQuotaConfig()
): Promise<PlannerQuotaState> {
  if (!config) return denied('quota_config_unavailable', null);

  const entitlement = await resolvePlannerEntitlement(user, now);
  if (!entitlement) return denied('entitlement_unavailable', null);

  const limit = capForEntitlement(config, entitlement);
  const resetAt = entitlement === 'pro' ? nextUtcDayStart(now).toISOString() : null;

  if (limit <= 0) {
    return denied(
      entitlement === 'expired' ? 'entitlement_expired' : 'not_entitled',
      entitlement,
      limit
    );
  }

  const used = await countPersistedProposals(client, user.id, entitlement, now);
  const remaining = Math.max(0, limit - used);
  if (remaining <= 0) {
    return denied('quota_exhausted', entitlement, limit, used, resetAt);
  }

  return { eligible: true, entitlement, limit, remaining, used, resetAt, reason: null };
}
