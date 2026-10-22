import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Client-side mirror of the server's Pro check, for gates the server would
 * otherwise be the only one to enforce (e.g. Vision generation). Reads the same
 * effective tier as the practice gates, so a dev tier override reaches every
 * gate alike.
 *
 * Until RevenueCat has answered, it defers to the server (returns false) so a
 * real Pro user is never paywalled by a cold start. A dev override is always
 * authoritative.
 */
export function isProFeatureLocked(): boolean {
  const state = useSubscriptionStore.getState();
  const simulating = __DEV__ && state.devOverrideEnabled;
  if (!simulating && !state.entitlementReady) return false;
  return state.getEffectiveTier() !== 'pro';
}

/**
 * Reactive form of `isProFeatureLocked` for render-time gates: re-renders when
 * the entitlement, a dev override or the dev master account changes.
 */
export function useProFeatureLocked(): boolean {
  useSubscriptionStore((s) => s.entitlementReady);
  useSubscriptionStore((s) => s.hasActiveEntitlement);
  useSubscriptionStore((s) => s.remoteCompedAccess);
  useSubscriptionStore((s) => s.legacyMigrationAccess);
  useSubscriptionStore((s) => s.devOverrideEnabled);
  useSubscriptionStore((s) => s.devTierOverride);
  useSettingsStore((s) => s.developerMasterAccountEnabled);
  return isProFeatureLocked();
}
