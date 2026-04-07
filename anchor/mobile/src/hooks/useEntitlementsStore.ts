import { useMemo } from 'react';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { getEntitlements } from '@/utils/entitlements';

export interface EntitlementsSnapshot {
  tier: 'free' | 'pro';
  maxAnchors: number;
  aiStyleCount: number;
  aiVariationCount: number;
  canTraceAnchor: boolean;
  canForgeAnchor: boolean;
  canUseArchivedFilter: boolean;
  canExportHD: boolean;
}

interface EntitlementsViewState {
  tier: 'free' | 'pro';
  isPro: boolean;
  isFree: boolean;
  getEntitlements: () => EntitlementsSnapshot;
}

export function useEntitlementsStore<T>(selector: (state: EntitlementsViewState) => T): T {
  const effectiveTier = useSubscriptionStore((state) => state.getEffectiveTier());

  const snapshot = useMemo<EntitlementsSnapshot>(() => {
    const entitlements = getEntitlements(effectiveTier);
    return {
      ...entitlements,
      tier: effectiveTier,
    };
  }, [effectiveTier]);

  const viewState = useMemo<EntitlementsViewState>(
    () => ({
      tier: effectiveTier,
      isPro: effectiveTier === 'pro',
      isFree: effectiveTier === 'free',
      getEntitlements: () => snapshot,
    }),
    [effectiveTier, snapshot]
  );

  return selector(viewState);
}
