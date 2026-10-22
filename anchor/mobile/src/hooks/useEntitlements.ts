import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useAuthStore } from '@/stores/authStore';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { computeEntitlements, type Entitlements } from '@/utils/entitlements';

export function useEntitlements(now?: Date): Entitlements {
  const anchors = useAnchorStore((state) => state.anchors);
  const primingHistory = useSessionStore((state) => state.primingHistory);
  const trialStartDate = useSubscriptionStore((state) => state.trialStartDate);
  const freeAnchorConsumed = useAuthStore((state) =>
    state.user?.freeAnchorConsumed === true || (state.user?.totalAnchorsCreated ?? 0) >= 1
  );
  const { isTrialActive, isSubscribed, trialExpired, entitlementReady } = useTrialStatus();

  return useMemo(
    () =>
      computeEntitlements({
        anchors,
        primingHistory,
        isSubscribed,
        isTrialActive,
        trialExpired,
        trialStartDate,
        freeAnchorConsumed,
        entitlementReady,
        now,
      }),
    [anchors, entitlementReady, freeAnchorConsumed, isSubscribed, isTrialActive, now, primingHistory, trialExpired, trialStartDate]
  );
}
