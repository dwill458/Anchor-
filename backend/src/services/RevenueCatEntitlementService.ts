import axios from 'axios';
import { logger } from '../utils/logger';

const REVENUECAT_API_BASE_URL = 'https://api.revenuecat.com/v1';
const REVENUECAT_CACHE_TTL_MS = 60_000;
const REVENUECAT_TIMEOUT_MS = 5_000;

interface RevenueCatEntitlement {
  expires_date?: string | null;
  product_identifier?: string | null;
  period_type?: string | null;
}

interface RevenueCatSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
  };
}

export interface RevenueCatAccessSnapshot {
  isActive: boolean;
  productIdentifier: string | null;
  isTrialPeriod?: boolean;
  expiresAt?: string | null;
  isStale?: boolean;
}

export interface RevenueCatAccessOptions {
  /** Bypass the short-lived cache after a store-confirmed purchase or restore. */
  forceRefresh?: boolean;
}

interface CachedSnapshot {
  value: RevenueCatAccessSnapshot;
  cachedAt: number;
  cachedUntil: number;
  staleUntil: number;
}

const REVENUECAT_STALE_ACCESS_GRACE_MS = 24 * 60 * 60 * 1000;

const cache = new Map<string, CachedSnapshot>();

function isEntitlementActive(entitlement: RevenueCatEntitlement | undefined, now: Date): boolean {
  if (!entitlement) return false;
  if (!entitlement.expires_date) return true;

  const expiresAt = new Date(entitlement.expires_date);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

/**
 * Returns null when RevenueCat is not configured or temporarily unavailable.
 * Callers can then fall back to the last server-persisted subscription state.
 */
export async function getRevenueCatAccess(
  appUserId: string,
  now: Date = new Date(),
  options: RevenueCatAccessOptions = {}
): Promise<RevenueCatAccessSnapshot | null> {
  const apiKey = process.env.REVENUECAT_API_KEY?.trim();
  if (!apiKey) return null;

  const cached = cache.get(appUserId);
  if (!options.forceRefresh && cached && cached.cachedUntil > now.getTime()) {
    return cached.value;
  }

  const entitlementId = process.env.REVENUECAT_ENTITLEMENT_ID?.trim() || 'pro';

  try {
    const response = await axios.get<RevenueCatSubscriberResponse>(
      `${REVENUECAT_API_BASE_URL}/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: REVENUECAT_TIMEOUT_MS,
      }
    );
    const entitlement = response.data.subscriber?.entitlements?.[entitlementId];
    const value = {
      isActive: isEntitlementActive(entitlement, now),
      productIdentifier: entitlement?.product_identifier ?? null,
      isTrialPeriod: entitlement?.period_type?.toLowerCase() === 'trial',
      expiresAt: entitlement?.expires_date ?? null,
    };

    cache.set(appUserId, {
      value,
      cachedAt: now.getTime(),
      cachedUntil: now.getTime() + REVENUECAT_CACHE_TTL_MS,
      staleUntil: now.getTime() + REVENUECAT_STALE_ACCESS_GRACE_MS,
    });
    return value;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      const value = { isActive: false, productIdentifier: null };
      cache.set(appUserId, {
        value,
        cachedAt: now.getTime(),
        cachedUntil: now.getTime() + REVENUECAT_CACHE_TTL_MS,
        staleUntil: now.getTime() + REVENUECAT_STALE_ACCESS_GRACE_MS,
      });
      return value;
    }

    if (cached && cached.value.isActive && cached.staleUntil > now.getTime()) {
      logger.warn(
        '[RevenueCat] Using bounded stale verified Pro entitlement after lookup failure',
        {
          appUserId,
          cachedAt: new Date(cached.cachedAt).toISOString(),
        }
      );
      return { ...cached.value, isStale: true };
    }

    logger.warn('[RevenueCat] Failed to resolve server entitlement; no verified access available', {
      appUserId,
      status: axios.isAxiosError(error) ? error.response?.status : undefined,
    });
    return null;
  }
}

export function clearRevenueCatAccessCache(): void {
  cache.clear();
}
