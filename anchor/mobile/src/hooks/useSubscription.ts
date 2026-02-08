/**
 * useSubscription Hook
 *
 * Centralized subscription and entitlements management.
 * Provides clean API for checking Pro features without direct RevenueCat dependencies.
 * Includes developer override for testing Free vs Pro flows.
 *
 * @example
 * const { isPro, features } = useSubscription();
 * if (!features.canUseManualForge) {
 *   // Show paywall
 * }
 */

import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { getEntitlements, Entitlements } from '@/utils/entitlements';

/**
 * Main subscription hook
 * Returns Pro status and feature flags
 */
export function useSubscription() {
  const store = useSubscriptionStore();
  const effectiveTier = store.getEffectiveTier();
  const entitlements = getEntitlements(effectiveTier);

  return {
    isPro: effectiveTier === 'pro',
    isFree: effectiveTier === 'free',
    tier: effectiveTier,
    features: entitlements,
  };
}

/**
 * Check if a specific Pro feature is available
 * @param feature - The feature to check
 */
export function useFeatureAccess(feature: keyof Entitlements): boolean {
  const { features } = useSubscription();
  return features[feature] as boolean;
}

