import { useMemo } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useEntitlements } from '@/hooks/useEntitlements';
import {
  getPrimeSessionAllowance,
  type PrimeSessionAllowance,
} from '@/utils/primeSessionAccess';

export interface PrimeSessionAccessSnapshot {
  limitsActive: boolean;
  tier: 'free' | 'trial' | 'pro';
  focus: PrimeSessionAllowance;
  deep: PrimeSessionAllowance;
}

export function usePrimeSessionAccess(): PrimeSessionAccessSnapshot {
  const primingHistory = useSessionStore((state) => state.primingHistory);
  const entitlements = useEntitlements();

  return useMemo(() => {
    const limitsActive = entitlements.isFree;

    return {
      limitsActive,
      tier: entitlements.tier,
      focus: getPrimeSessionAllowance({
        tier: entitlements.tier,
        kind: 'focus',
        primingHistory,
        enforceLimits: limitsActive,
      }),
      deep: getPrimeSessionAllowance({
        tier: entitlements.tier,
        kind: 'deep',
        primingHistory,
        enforceLimits: limitsActive,
      }),
    };
  }, [entitlements.isFree, entitlements.tier, primingHistory]);
}
