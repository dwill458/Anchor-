import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionStatus } from '@/types';

interface SubscriptionState {
    // Real state from RevenueCat (synced via hook/service)
    rcTier: SubscriptionStatus;
    isInTrial: boolean;
    isSubscribed: boolean;
    hasActiveEntitlement: boolean;
    daysRemaining: number | null;
    trialExpired: boolean;

    // Developer override controls
    devOverrideEnabled: boolean;
    devTierOverride: 'free' | 'pro' | 'trial';

    // Actions
    setRcTier: (tier: SubscriptionStatus) => void;
    setTrialState: (state: {
        isInTrial: boolean;
        isSubscribed: boolean;
        hasActiveEntitlement: boolean;
        daysRemaining: number | null;
        trialExpired: boolean;
    }) => void;
    clearTrialState: () => void;
    setDevOverrideEnabled: (enabled: boolean) => void;
    setDevTierOverride: (tier: 'free' | 'pro' | 'trial') => void;
    resetOverrides: () => void;

    // Computed values (accessed via selectors or the hook)
    getEffectiveTier: () => 'free' | 'pro';
}

export const useSubscriptionStore = create<SubscriptionState>()(
    persist(
        (set, get) => ({
            rcTier: 'free',
            isInTrial: false,
            isSubscribed: false,
            hasActiveEntitlement: false,
            daysRemaining: null,
            trialExpired: false,
            devOverrideEnabled: false,
            devTierOverride: 'pro',

            setRcTier: (tier) => set({ rcTier: tier }),
            setTrialState: (state) => set({ ...state }),
            clearTrialState: () => set({
                rcTier: 'free',
                isInTrial: false,
                isSubscribed: false,
                hasActiveEntitlement: false,
                daysRemaining: null,
                trialExpired: false,
            }),
            setDevOverrideEnabled: (enabled) => set({ devOverrideEnabled: enabled }),
            setDevTierOverride: (tier) => set({ devTierOverride: tier }),

            resetOverrides: () => set({
                devOverrideEnabled: false,
                devTierOverride: 'pro'
            }),

            getEffectiveTier: () => {
                const {
                    devOverrideEnabled,
                    devTierOverride,
                    rcTier,
                    hasActiveEntitlement,
                } = get();
                if (__DEV__ && devOverrideEnabled) {
                    return devTierOverride === 'trial' ? 'pro' : devTierOverride;
                }
                if (hasActiveEntitlement) {
                    return 'pro';
                }
                return rcTier.startsWith('pro') ? 'pro' : 'free';
            },
        }),
        {
            name: 'anchor-subscription-override-storage',
            storage: createJSONStorage(() => AsyncStorage),
            version: 2,
            partialize: (state) => ({
                rcTier: state.rcTier,
                isInTrial: state.isInTrial,
                isSubscribed: state.isSubscribed,
                hasActiveEntitlement: state.hasActiveEntitlement,
                daysRemaining: state.daysRemaining,
                trialExpired: state.trialExpired,
                devOverrideEnabled: state.devOverrideEnabled,
                devTierOverride: state.devTierOverride,
            }),
        }
    )
);
