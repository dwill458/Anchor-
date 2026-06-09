import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionStatus } from '@/types';

interface TrialStatusSnapshot {
    isInTrial: boolean;
    isSubscribed: boolean;
    hasActiveEntitlement: boolean;
    daysRemaining: number | null;
    trialExpired: boolean;
}

interface SubscriptionState extends TrialStatusSnapshot {
    // Real state from RevenueCat (synced via hook/service)
    rcTier: SubscriptionStatus;
    remoteCompedAccess: boolean;

    // Account-backed entitlement cache (persisted for cold starts)
    subscriptionStatus: 'trial' | 'active' | 'expired';

    // Developer override controls
    devOverrideEnabled: boolean;
    devTierOverride: 'free' | 'pro' | 'trial' | 'expired';

    // True once RevenueCat has returned at least one real response (not persisted — resets on reinstall)
    rcSynced: boolean;

    // Actions
    setRcTier: (tier: SubscriptionStatus) => void;
    setSubscriptionStatus: (status: 'trial' | 'active' | 'expired') => void;
    setTrialState: (snapshot: TrialStatusSnapshot) => void;
    setRemoteCompedAccess: (enabled: boolean) => void;
    setDevOverrideEnabled: (enabled: boolean) => void;
    setDevTierOverride: (tier: 'free' | 'pro' | 'trial' | 'expired') => void;
    setRcSynced: (synced: boolean) => void;
    resetEntitlementState: () => void;
    resetOverrides: () => void;

    // Computed values (accessed via selectors or the hook)
    getEffectiveTier: () => 'free' | 'pro';
}

export const useSubscriptionStore = create<SubscriptionState>()(
    persist(
        (set, get) => ({
            rcTier: 'free',
            remoteCompedAccess: false,
            subscriptionStatus: 'expired',
            devOverrideEnabled: false,
            devTierOverride: 'pro',
            rcSynced: false,

            // RevenueCat-derived trial status fields
            isInTrial: false,
            isSubscribed: false,
            hasActiveEntitlement: false,
            daysRemaining: null,
            trialExpired: false,

            setRcTier: (tier) => set({ rcTier: tier }),
            setSubscriptionStatus: (status) => set({ subscriptionStatus: status }),
            setTrialState: (snapshot) => set(snapshot),
            setRemoteCompedAccess: (enabled) => set({ remoteCompedAccess: enabled }),
            setDevOverrideEnabled: (enabled) => set({ devOverrideEnabled: enabled }),
            setDevTierOverride: (tier) => set({ devTierOverride: tier }),
            setRcSynced: (synced) => set({ rcSynced: synced }),
            resetEntitlementState: () => set({
                rcTier: 'free',
                subscriptionStatus: 'expired',
                rcSynced: false,
                isInTrial: false,
                isSubscribed: false,
                hasActiveEntitlement: false,
                daysRemaining: null,
                trialExpired: false,
            }),

            resetOverrides: () => set({
                devOverrideEnabled: false,
                devTierOverride: 'pro',
            }),

            getEffectiveTier: () => {
                const {
                    devOverrideEnabled,
                    devTierOverride,
                    rcTier,
                    remoteCompedAccess,
                    subscriptionStatus,
                    hasActiveEntitlement,
                } = get();

                if (__DEV__ && devOverrideEnabled) {
                    if (devTierOverride === 'expired' || devTierOverride === 'free') return 'free';
                    // 'trial' and 'pro' both grant full access
                    return 'pro';
                }

                if (remoteCompedAccess) return 'pro';

                if (
                    rcTier.startsWith('pro') ||
                    subscriptionStatus === 'active' ||
                    subscriptionStatus === 'trial' ||
                    hasActiveEntitlement
                ) {
                    return 'pro';
                }

                return 'free';
            },
        }),
        {
            name: 'anchor-subscription-override-storage',
            storage: createJSONStorage(() => AsyncStorage),
            version: 3,
            migrate: (persistedState: any, version: number) => {
                if (version < 3) {
                    const nextStatus =
                        persistedState?.subscriptionStatus === 'active' ? 'active' : 'expired';

                    return {
                        ...persistedState,
                        subscriptionStatus: nextStatus,
                        isInTrial: false,
                        isSubscribed: nextStatus === 'active',
                        hasActiveEntitlement: nextStatus === 'active',
                        daysRemaining: null,
                        trialExpired: nextStatus === 'expired',
                    };
                }
                return persistedState;
            },
            partialize: (state) => ({
                devOverrideEnabled: state.devOverrideEnabled,
                devTierOverride: state.devTierOverride,
                subscriptionStatus: state.subscriptionStatus,
                isInTrial: state.isInTrial,
                isSubscribed: state.isSubscribed,
                hasActiveEntitlement: state.hasActiveEntitlement,
                daysRemaining: state.daysRemaining,
                trialExpired: state.trialExpired,
            }),
        }
    )
);
