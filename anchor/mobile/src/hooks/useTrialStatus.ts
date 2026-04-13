import { useSubscriptionStore } from '@/stores/subscriptionStore';

export interface TrialStatus {
  isInTrial: boolean;
  isSubscribed: boolean;
  hasActiveEntitlement: boolean;
  daysRemaining: number | null;
  trialExpired: boolean;
}

export function useTrialStatus(): TrialStatus {
  return useSubscriptionStore((state) => ({
    isInTrial: state.isInTrial,
    isSubscribed: state.isSubscribed,
    hasActiveEntitlement: state.hasActiveEntitlement,
    daysRemaining: state.daysRemaining,
    trialExpired: state.trialExpired,
  }));
}
