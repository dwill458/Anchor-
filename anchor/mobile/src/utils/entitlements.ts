/**
 * Central entitlement rules for Free, Trial, and paid Pro.
 *
 * Screens should ask this layer for computed access instead of branching on
 * subscription or RevenueCat state directly.
 */

import type { Anchor } from '@/types';
import { isoWeekKey, type PrimingHistoryEntry } from './primingAnalytics';

export const PAID_PRO_DAILY_ANCHOR_LIMIT = 10;
export const FREE_WEEKLY_SESSION_LIMIT = 5;

export type EntitlementTier = 'free' | 'trial' | 'pro';
export type AnchorCreationLimitReason =
  | 'create_anchor_free_locked'
  | 'pro_daily_anchor_cap_reached'
  | null;
export type PracticeLimitReason = 'free_weekly_sessions_used' | 'premium_practice_locked' | null;

export interface Entitlements {
  tier: EntitlementTier;
  entitlementReady: boolean;
  isPro: boolean;
  isPaidPro: boolean;
  isInTrial: boolean;
  isTrialExpired: boolean;
  isFree: boolean;
  canCreateAnchor: boolean;
  canStartPracticeSession: boolean;
  canUseUnlimitedSessions: boolean;
  canUseProPracticeModes: boolean;
  anchorsCreatedToday: number;
  anchorsCreatedDuringTrial: number;
  remainingTrialAnchors: number;
  remainingDailyProAnchors: number;
  remainingWeeklyFreeSessions: number;
  anchorCreationLimitReason: AnchorCreationLimitReason;
  practiceLimitReason: PracticeLimitReason;

  // Compatibility fields used by older UI code.
  maxAnchors: number;
  aiStyleCount: number;
  aiVariationCount: number;
  focusSessionsPerWeek: number;
  deepPrimeSessionsPerWeek: number;
  canTraceAnchor: boolean;
  canForgeAnchor: boolean;
  canUseArchivedFilter: boolean;
  canExportHD: boolean;
}

export interface EntitlementInput {
  anchors?: Array<Pick<Anchor, 'createdAt'> | { createdAt?: Date | string | null }>;
  primingHistory?: PrimingHistoryEntry[];
  isSubscribed: boolean;
  isTrialActive: boolean;
  trialExpired?: boolean;
  trialStartDate?: Date | string | null;
  freeAnchorConsumed?: boolean;
  entitlementReady?: boolean;
  now?: Date;
}

export interface LimitCopy {
  title: string;
  body: string;
  cta: string;
  secondary?: string;
}

const FREE_FEATURES = {
  aiStyleCount: 0,
  aiVariationCount: 0,
  canTraceAnchor: false,
  canForgeAnchor: false,
  canUseArchivedFilter: true,
  canExportHD: true,
};

const PRO_FEATURES = {
  aiStyleCount: 20,
  aiVariationCount: 4,
  canTraceAnchor: true,
  canForgeAnchor: true,
  canUseArchivedFilter: true,
  canExportHD: true,
};

function toDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSameUtcDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function countAnchorsCreatedToday(
  anchors: EntitlementInput['anchors'],
  now: Date
): number {
  return (anchors ?? []).reduce((count, anchor) => {
    const createdAt = toDate(anchor.createdAt);
    return createdAt && isSameUtcDay(createdAt, now) ? count + 1 : count;
  }, 0);
}

function countWeeklyPracticeSessions(
  primingHistory: PrimingHistoryEntry[] | undefined,
  now: Date
): number {
  const currentWeekKey = isoWeekKey(now);
  return (primingHistory ?? []).reduce((count, entry) => {
    return entry?.weekKey === currentWeekKey ? count + 1 : count;
  }, 0);
}

export function getAnchorCreationLimitCopy(reason: AnchorCreationLimitReason): LimitCopy | null {
  switch (reason) {
    case 'create_anchor_free_locked':
      return {
        title: 'Create more anchors with Pro',
        body:
          'Your first anchors are yours to keep. Upgrade to Anchor Pro to shape new intentions into symbols and practice without weekly limits.',
        cta: 'Unlock Anchor Pro',
        secondary: 'Maybe later',
      };
    case 'pro_daily_anchor_cap_reached':
      return {
        title: 'Daily creation limit reached',
        body:
          "You've created 10 anchors today. Anchor works best when each symbol has room to mean something. You can create more tomorrow.",
        cta: 'Return to Sanctuary',
      };
    default:
      return null;
  }
}

export function getPracticeLimitCopy(reason: PracticeLimitReason): LimitCopy | null {
  switch (reason) {
    case 'free_weekly_sessions_used':
      return {
        title: 'Weekly sessions complete',
        body:
          "You've used your free practice sessions for the week. Upgrade to Anchor Pro to keep practicing without limits.",
        cta: 'Unlock Unlimited Sessions',
        secondary: 'Return to Sanctuary',
      };
    case 'premium_practice_locked':
      return {
        title: 'Unlock this practice with Pro',
        body:
          'Pro unlocks continued creation, unlimited practice, and deeper practice modes.',
        cta: 'Unlock Anchor Pro',
        secondary: 'Return to Sanctuary',
      };
    default:
      return null;
  }
}

export function computeEntitlements(input: EntitlementInput): Entitlements {
  const now = input.now ?? new Date();
  const isPaidPro = input.isSubscribed;
  const isInTrial = !isPaidPro && input.isTrialActive;
  const isTrialExpired = !isPaidPro && !isInTrial && input.trialExpired === true;
  const isFree = !isPaidPro && !isInTrial;
  const tier: EntitlementTier = isPaidPro ? 'pro' : isInTrial ? 'trial' : 'free';

  const anchorsCreatedToday = countAnchorsCreatedToday(input.anchors, now);
  const anchorsCreatedDuringTrial = 0;
  const freeWeeklySessionsUsed = countWeeklyPracticeSessions(input.primingHistory, now);

  const remainingTrialAnchors = 0;
  const remainingDailyProAnchors = isPaidPro
    ? Math.max(0, PAID_PRO_DAILY_ANCHOR_LIMIT - anchorsCreatedToday)
    : 0;
  const remainingWeeklyFreeSessions = isFree
    ? Math.max(0, FREE_WEEKLY_SESSION_LIMIT - freeWeeklySessionsUsed)
    : Infinity;

  const entitlementReady = input.entitlementReady !== false;
  const freeAnchorConsumed = input.freeAnchorConsumed === true;
  const anchorCreationLimitReason: AnchorCreationLimitReason =
    !entitlementReady
      ? null
      : isPaidPro && remainingDailyProAnchors <= 0
      ? 'pro_daily_anchor_cap_reached'
      : isFree && freeAnchorConsumed
          ? 'create_anchor_free_locked'
          : null;

  const practiceLimitReason: PracticeLimitReason =
    !entitlementReady
      ? null
      : isFree && remainingWeeklyFreeSessions <= 0
        ? 'free_weekly_sessions_used'
        : null;

  const canCreateAnchor = entitlementReady && anchorCreationLimitReason == null;
  const canStartPracticeSession = entitlementReady && practiceLimitReason == null;
  const canUseUnlimitedSessions = isPaidPro || isInTrial;
  const canUseProPracticeModes = isPaidPro || isInTrial;
  const legacyFeatures = isFree ? FREE_FEATURES : PRO_FEATURES;

  return {
    tier,
    entitlementReady,
    isPro: isPaidPro || isInTrial,
    isPaidPro,
    isInTrial,
    isTrialExpired,
    isFree,
    canCreateAnchor,
    canStartPracticeSession,
    canUseUnlimitedSessions,
    canUseProPracticeModes,
    anchorsCreatedToday,
    anchorsCreatedDuringTrial,
    remainingTrialAnchors,
    remainingDailyProAnchors,
    remainingWeeklyFreeSessions,
    anchorCreationLimitReason,
    practiceLimitReason,
    maxAnchors: isFree && freeAnchorConsumed ? 1 : Infinity,
    focusSessionsPerWeek: isFree ? FREE_WEEKLY_SESSION_LIMIT : Infinity,
    deepPrimeSessionsPerWeek: isFree ? FREE_WEEKLY_SESSION_LIMIT : Infinity,
    ...legacyFeatures,
  };
}

/**
 * Backward-compatible static feature lookup. Prefer `computeEntitlements` or
 * the `useEntitlements` hook when user/session counts are available.
 */
export function getEntitlements(tier: 'free' | 'pro' | 'trial'): Entitlements {
  return computeEntitlements({
    isSubscribed: tier === 'pro',
    isTrialActive: tier === 'trial',
    trialExpired: tier === 'free',
  });
}
