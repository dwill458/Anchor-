import { useMemo } from 'react';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import {
  canStartV2Trial,
  resolveV2TrialState,
  v2TrialDaysRemaining,
  type V2TrialState,
} from '@/adapters/v2/paywall';

export type V2TrialSnapshot = {
  /** Server-derived classification of the local trial window. */
  trialState: V2TrialState;
  /** Holds any active entitlement (trial OR paid). */
  hasEntitlement: boolean;
  /** Holds a *paid* subscription (not a trial). */
  isActiveSubscriber: boolean;
  /** The explicit "Start 7-Day Free Trial" CTA is meaningful. */
  canStartTrial: boolean;
  /** Whole days left in the trial, else 0. */
  daysRemaining: number;
  /** RevenueCat / server has produced at least one real answer. */
  entitlementReady: boolean;
};

/**
 * Read-only view of trial + entitlement state for the paywall. It reads the
 * server-owned `trialStartDate` from the shared subscription store and never
 * writes it.
 */
export function useV2TrialState(now: Date = new Date()): V2TrialSnapshot {
  const trialStartDate = useSubscriptionStore((s) => s.trialStartDate);
  const { isSubscribed, hasActiveEntitlement, entitlementReady } = useTrialStatus();

  return useMemo(() => {
    const trialState = resolveV2TrialState(trialStartDate, now);
    return {
      trialState,
      hasEntitlement: hasActiveEntitlement,
      isActiveSubscriber: isSubscribed,
      canStartTrial: canStartV2Trial(trialState, isSubscribed),
      daysRemaining: v2TrialDaysRemaining(trialStartDate, now),
      entitlementReady,
    };
    // `now` is intentionally excluded — a new Date() each render must not thrash memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialStartDate, isSubscribed, hasActiveEntitlement, entitlementReady]);
}
