import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionStatus } from '@/types';

interface SubscriptionState {
    // Real state from RevenueCat (synced via hook/service)
    rcTier: SubscriptionStatus;

    // Developer override controls
    devOverrideEnabled: boolean;
    devTierOverride: 'free' | 'pro';

    // Actions
    setRcTier: (tier: SubscriptionStatus) => void;
    setDevOverrideEnabled: (enabled: boolean) => void;
    setDevTierOverride: (tier: 'free' | 'pro') => void;
    resetOverrides: () => void;

    // Computed values (accessed via selectors or the hook)
    getEffectiveTier: () => 'free' | 'pro';
}

export const useSubscriptionStore = create<SubscriptionState>()(
    persist(
        (set, get) => ({
            rcTier: 'free',
            devOverrideEnabled: false,
            devTierOverride: 'pro',

            setRcTier: (tier) => set({ rcTier: tier }),
            setDevOverrideEnabled: (enabled) => set({ devOverrideEnabled: enabled }),
            setDevTierOverride: (tier) => set({ devTierOverride: tier }),

            resetOverrides: () => set({
                devOverrideEnabled: false,
                devTierOverride: 'pro'
            }),

            getEffectiveTier: () => {
                const { devOverrideEnabled, devTierOverride, rcTier } = get();
                if (__DEV__ && devOverrideEnabled) {
                    return devTierOverride;
                }
                return rcTier.startsWith('pro') ? 'pro' : 'free';
            },
        }),
        {
            name: 'anchor-subscription-override-storage',
            storage: createJSONStorage(() => AsyncStorage),
            version: 1,
            // Only persist developer override settings
            partialize: (state) => ({
                devOverrideEnabled: state.devOverrideEnabled,
                devTierOverride: state.devTierOverride,
            }),
        }
    )
);
