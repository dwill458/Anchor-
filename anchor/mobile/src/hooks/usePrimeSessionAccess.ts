import { useMemo } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import {
  getPrimeSessionAllowance,
  type PrimeSessionAllowance,
} from '@/utils/primeSessionAccess';

export interface PrimeSessionAccessSnapshot {
  limitsActive: boolean;
  tier: 'free' | 'pro';
  focus: PrimeSessionAllowance;
  deep: PrimeSessionAllowance;
}

export function usePrimeSessionAccess(): PrimeSessionAccessSnapshot {
  const tier = useSubscriptionStore((state) => state.getEffectiveTier());
  const rcSynced = useSubscriptionStore((state) => state.rcSynced);
  const devOverrideEnabled = useSubscriptionStore((state) => state.devOverrideEnabled);
  const primingHistory = useSessionStore((state) => state.primingHistory);

  return useMemo(() => {
    const limitsActive = tier === 'free' && (rcSynced || (__DEV__ && devOverrideEnabled));

    return {
      limitsActive,
      tier,
      focus: getPrimeSessionAllowance({
        tier,
        kind: 'focus',
        primingHistory,
        enforceLimits: limitsActive,
      }),
      deep: getPrimeSessionAllowance({
        tier,
        kind: 'deep',
        primingHistory,
        enforceLimits: limitsActive,
      }),
    };
  }, [devOverrideEnabled, primingHistory, rcSynced, tier]);
}
