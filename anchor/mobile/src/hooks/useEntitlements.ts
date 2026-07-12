import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { computeEntitlements, type Entitlements } from '@/utils/entitlements';

export function useEntitlements(now?: Date): Entitlements {
  const anchors = useAnchorStore((state) => state.anchors);
  const primingHistory = useSessionStore((state) => state.primingHistory);
  const trialStartDate = useSubscriptionStore((state) => state.trialStartDate);
  const { isTrialActive, isSubscribed, trialExpired } = useTrialStatus();

  return useMemo(
    () =>
      computeEntitlements({
        anchors,
        primingHistory,
        isSubscribed,
        isTrialActive,
        trialExpired,
        trialStartDate,
        now,
      }),
    [anchors, isSubscribed, isTrialActive, now, primingHistory, trialExpired, trialStartDate]
  );
}
