import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionStatus } from '@/types';

const TRIAL_DURATION_DAYS = 7;

/** Derive days remaining from a stored ISO trialStartDate string. */
function computeDaysRemaining(trialStartDate: string | null): number {
    if (!trialStartDate) return 0;
    const msElapsed = Date.now() - new Date(trialStartDate).getTime();
    const daysElapsed = Math.floor(msElapsed / 86_400_000);
    return Math.max(0, TRIAL_DURATION_DAYS - daysElapsed);
}

interface SubscriptionState {
    // Real state from RevenueCat (synced via hook/service)
    rcTier: SubscriptionStatus;

    // Trial state (local, AsyncStorage-persisted)
    trialStartDate: string | null;
    subscriptionStatus: 'trial' | 'active' | 'expired';

    // Developer override controls
    devOverrideEnabled: boolean;
    devTierOverride: 'free' | 'pro' | 'trial' | 'expired';

    // Actions
    setRcTier: (tier: SubscriptionStatus) => void;
    setTrialStartDate: (date: string) => void;
    setSubscriptionStatus: (status: 'trial' | 'active' | 'expired') => void;
    setDevOverrideEnabled: (enabled: boolean) => void;
    setDevTierOverride: (tier: 'free' | 'pro' | 'trial' | 'expired') => void;
    resetOverrides: () => void;

    // Computed values (accessed via selectors or the hook)
    getEffectiveTier: () => 'free' | 'pro';
}

export const useSubscriptionStore = create<SubscriptionState>()(
    persist(
        (set, get) => ({
            rcTier: 'free',
            trialStartDate: null,
            subscriptionStatus: 'trial',
            devOverrideEnabled: false,
            devTierOverride: 'pro',

            setRcTier: (tier) => set({ rcTier: tier }),
            setTrialStartDate: (date) => set({ trialStartDate: date }),
            setSubscriptionStatus: (status) => set({ subscriptionStatus: status }),
            setDevOverrideEnabled: (enabled) => set({ devOverrideEnabled: enabled }),
            setDevTierOverride: (tier) => set({ devTierOverride: tier }),

            resetOverrides: () => set({
                devOverrideEnabled: false,
                devTierOverride: 'pro',
            }),

            getEffectiveTier: () => {
                const { devOverrideEnabled, devTierOverride, rcTier, subscriptionStatus, trialStartDate } = get();

                if (__DEV__ && devOverrideEnabled) {
                    if (devTierOverride === 'expired' || devTierOverride === 'free') return 'free';
                    // 'trial' and 'pro' both grant full access
                    return 'pro';
                }

                // Active paid subscription always wins
                if (rcTier.startsWith('pro') || subscriptionStatus === 'active') return 'pro';

                // Trial grants full access while days remain
                if (subscriptionStatus === 'trial' && computeDaysRemaining(trialStartDate) > 0) return 'pro';

                return 'free';
            },
        }),
        {
            name: 'anchor-subscription-override-storage',
            storage: createJSONStorage(() => AsyncStorage),
            version: 2,
            migrate: (persistedState: any, version: number) => {
                // v1 → v2: add trialStartDate and subscriptionStatus
                if (version < 2) {
                    return {
                        ...persistedState,
                        trialStartDate: persistedState.trialStartDate ?? null,
                        subscriptionStatus: persistedState.subscriptionStatus ?? 'trial',
                    };
                }
                return persistedState;
            },
            partialize: (state) => ({
                devOverrideEnabled: state.devOverrideEnabled,
                devTierOverride: state.devTierOverride,
                trialStartDate: state.trialStartDate,
                subscriptionStatus: state.subscriptionStatus,
            }),
        }
    )
);

export { computeDaysRemaining, TRIAL_DURATION_DAYS };
