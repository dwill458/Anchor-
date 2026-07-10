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

import { Entitlements } from '@/utils/entitlements';
import { useEntitlements } from '@/hooks/useEntitlements';

/**
 * Main subscription hook
 * Returns Pro status and feature flags
 */
export function useSubscription() {
  const entitlements = useEntitlements();

  return {
    isPro: entitlements.isPro,
    isFree: entitlements.isFree,
    tier: entitlements.tier,
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
