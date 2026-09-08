import { prisma } from '../lib/prisma';
import { getRevenueCatAccess, type RevenueCatAccessOptions } from './RevenueCatEntitlementService';

export type MonetizationAccessSource =
  | 'revenuecat'
  | 'revenuecat_cache'
  | 'comped'
  | 'legacy_migration'
  | 'free';

export interface MonetizationAccess {
  hasProAccess: boolean;
  /** True when the result came from a verified store lookup or an explicit server policy. */
  entitlementVerified: boolean;
  isTrialPeriod: boolean;
  isComped: boolean;
  legacyMigrationAccess: boolean;
  source: MonetizationAccessSource;
  productIdentifier: string | null;
  expiresAt: Date | null;
}

export type MonetizationUser = {
  id: string;
  isComped?: boolean;
  trialStartedAt?: Date | null;
};

const LEGACY_TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getLegacyMigrationCutoff(): Date | null {
  const raw = process.env.MONETIZATION_MODEL_ACTIVATED_AT?.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Migration-only bridge for accounts that were promised the old, internal
 * seven-day trial before the store-backed model went live. It is intentionally
 * unavailable when the rollout cutoff is not configured, and never applies to
 * a newly-created account after that cutoff.
 */
export function hasLegacyMigrationAccess(user: MonetizationUser, now = new Date()): boolean {
  const cutoff = getLegacyMigrationCutoff();
  const startedAt = user.trialStartedAt;
  if (!cutoff || !startedAt) return false;
  if (startedAt.getTime() >= cutoff.getTime()) return false;
  return now.getTime() < startedAt.getTime() + LEGACY_TRIAL_DURATION_MS;
}

export async function resolveMonetizationAccess(
  user: MonetizationUser,
  now = new Date(),
  options: RevenueCatAccessOptions = {}
): Promise<MonetizationAccess> {
  if (user.isComped === true) {
    return {
      hasProAccess: true,
      entitlementVerified: true,
      isTrialPeriod: false,
      isComped: true,
      legacyMigrationAccess: false,
      source: 'comped',
      productIdentifier: null,
      expiresAt: null,
    };
  }

  const revenueCatAccess = await getRevenueCatAccess(user.id, now, options);
  const revenueCatExpiry = revenueCatAccess?.expiresAt
    ? new Date(revenueCatAccess.expiresAt)
    : null;
  const revenueCatIsActive = Boolean(
    revenueCatAccess?.isActive &&
    (!revenueCatExpiry ||
      (Number.isFinite(revenueCatExpiry.getTime()) && revenueCatExpiry.getTime() > now.getTime()))
  );

  if (revenueCatIsActive && revenueCatAccess) {
    return {
      hasProAccess: true,
      entitlementVerified: true,
      isTrialPeriod: revenueCatAccess.isTrialPeriod === true,
      isComped: false,
      legacyMigrationAccess: false,
      source: revenueCatAccess.isStale ? 'revenuecat_cache' : 'revenuecat',
      productIdentifier: revenueCatAccess.productIdentifier,
      expiresAt: revenueCatAccess.expiresAt ? new Date(revenueCatAccess.expiresAt) : null,
    };
  }

  if (hasLegacyMigrationAccess(user, now)) {
    const expiresAt = new Date(user.trialStartedAt!.getTime() + LEGACY_TRIAL_DURATION_MS);
    return {
      hasProAccess: true,
      entitlementVerified: true,
      isTrialPeriod: true,
      isComped: false,
      legacyMigrationAccess: true,
      source: 'legacy_migration',
      productIdentifier: null,
      expiresAt,
    };
  }

  return {
    hasProAccess: false,
    entitlementVerified: revenueCatAccess !== null,
    isTrialPeriod: false,
    isComped: false,
    legacyMigrationAccess: false,
    source: 'free',
    productIdentifier: revenueCatAccess?.productIdentifier ?? null,
    expiresAt: revenueCatAccess?.expiresAt ? new Date(revenueCatAccess.expiresAt) : null,
  };
}

/** Central backend monetization decision used by every premium gate. */
export async function getMonetizationAccess(
  userId: string,
  now = new Date(),
  options: RevenueCatAccessOptions = {}
): Promise<MonetizationAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isComped: true, trialStartedAt: true },
  });
  if (!user) {
    throw new Error('User not found');
  }
  return resolveMonetizationAccess(user, now, options);
}
