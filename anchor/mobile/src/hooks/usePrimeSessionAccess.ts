import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import {
  isNoAccountSanctuaryUser,
  NO_ACCOUNT_DEEP_PRIMES_PER_WEEK,
  NO_ACCOUNT_FOCUS_SESSIONS_PER_WEEK,
} from '@/utils/noAccountAccess';
import {
  getPrimeSessionAllowance,
  type PrimeSessionAllowance,
} from '@/utils/primeSessionAccess';

export interface PrimeSessionAccessSnapshot {
  limitsActive: boolean;
  tier: 'free' | 'pro';
  isNoAccountSanctuaryUser: boolean;
  focus: PrimeSessionAllowance;
  deep: PrimeSessionAllowance;
}

export function usePrimeSessionAccess(): PrimeSessionAccessSnapshot {
  const tier = useSubscriptionStore((state) => state.getEffectiveTier());
  const rcSynced = useSubscriptionStore((state) => state.rcSynced);
  const devOverrideEnabled = useSubscriptionStore((state) => state.devOverrideEnabled);
  const primingHistory = useSessionStore((state) => state.primingHistory);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const pendingFirstAnchorDraft = useAuthStore((state) => state.pendingFirstAnchorDraft);
  const anchors = useAnchorStore((state) => state.anchors ?? []);
  const sanctuaryAnchorCount = useMemo(
    () => anchors.filter((anchor) => !anchor.isReleased).length,
    [anchors]
  );
  const noAccountSanctuaryUser = isNoAccountSanctuaryUser({
    isAuthenticated,
    pendingFirstAnchorDraft,
    sanctuaryAnchorCount,
  });

  return useMemo(() => {
    const limitsActive =
      noAccountSanctuaryUser ||
      (tier === 'free' && (rcSynced || (__DEV__ && devOverrideEnabled)));

    return {
      limitsActive,
      tier,
      isNoAccountSanctuaryUser: noAccountSanctuaryUser,
      focus: getPrimeSessionAllowance({
        tier,
        kind: 'focus',
        primingHistory,
        enforceLimits: limitsActive,
        limitOverride: noAccountSanctuaryUser
          ? NO_ACCOUNT_FOCUS_SESSIONS_PER_WEEK
          : undefined,
      }),
      deep: getPrimeSessionAllowance({
        tier,
        kind: 'deep',
        primingHistory,
        enforceLimits: limitsActive,
        limitOverride: noAccountSanctuaryUser
          ? NO_ACCOUNT_DEEP_PRIMES_PER_WEEK
          : undefined,
      }),
    };
  }, [devOverrideEnabled, noAccountSanctuaryUser, primingHistory, rcSynced, tier]);
}
