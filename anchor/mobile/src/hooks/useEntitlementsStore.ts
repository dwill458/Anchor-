import { useMemo } from 'react';
import { Entitlements } from '@/utils/entitlements';
import { useEntitlements } from '@/hooks/useEntitlements';

export type EntitlementsSnapshot = Entitlements;

interface EntitlementsViewState {
  tier: 'free' | 'trial' | 'pro';
  isPro: boolean;
  isFree: boolean;
  getEntitlements: () => EntitlementsSnapshot;
}

export function useEntitlementsStore<T>(selector: (state: EntitlementsViewState) => T): T {
  const snapshot = useEntitlements();

  const viewState = useMemo<EntitlementsViewState>(
    () => ({
      tier: snapshot.tier,
      isPro: snapshot.isPro,
      isFree: snapshot.isFree,
      getEntitlements: () => snapshot,
    }),
    [snapshot]
  );

  return selector(viewState);
}
