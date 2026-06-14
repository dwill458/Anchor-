import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionStatus } from '@/types';

const TRIAL_DURATION_DAYS = 7;
export type PreferredPlanId = 'monthly' | 'annual';

/** Derive days remaining from a stored ISO trialStartDate string. */
function computeDaysRemaining(trialStartDate: string | null): number {
    if (!trialStartDate) return 0;
    const trialStartMs = new Date(trialStartDate).getTime();
    if (Number.isNaN(trialStartMs)) return 0;

    const msElapsed = Date.now() - trialStartMs;
    const daysElapsed = Math.floor(msElapsed / 86_400_000);
    return Math.min(TRIAL_DURATION_DAYS, Math.max(0, TRIAL_DURATION_DAYS - daysElapsed));
}

function normalizeTrialStartDate(value: Date | string): string | null {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function isLocalTrialActive(trialStartDate: string | null): boolean {
    return computeDaysRemaining(trialStartDate) > 0;
}

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

    // Trial state (local, AsyncStorage-persisted)
    trialStartDate: string | null;
    subscriptionStatus: 'trial' | 'active' | 'expired';
    preferredPlanId: PreferredPlanId;

    // Developer override controls
    devOverrideEnabled: boolean;
    devTierOverride: 'free' | 'pro' | 'trial' | 'expired';

    // True once RevenueCat has returned at least one real response (not persisted — resets on reinstall)
    rcSynced: boolean;

    // Actions
    setRcTier: (tier: SubscriptionStatus) => void;
    setTrialStartDate: (date: string) => void;
    setSubscriptionStatus: (status: 'trial' | 'active' | 'expired') => void;
    setTrialState: (snapshot: TrialStatusSnapshot) => void;
    syncAccountTrial: (startDate: Date | string) => void;
    setPreferredPlanId: (planId: PreferredPlanId) => void;
    setRemoteCompedAccess: (enabled: boolean) => void;
    setDevOverrideEnabled: (enabled: boolean) => void;
    setDevTierOverride: (tier: 'free' | 'pro' | 'trial' | 'expired') => void;
    setRcSynced: (synced: boolean) => void;
    resetOverrides: () => void;

    // Computed values (accessed via selectors or the hook)
    getEffectiveTier: () => 'free' | 'pro';
}

export const useSubscriptionStore = create<SubscriptionState>()(
    persist(
        (set, get) => ({
            rcTier: 'free',
            remoteCompedAccess: false,
            trialStartDate: null,
            subscriptionStatus: 'expired',
            preferredPlanId: 'annual',
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
            setTrialStartDate: (date) => set({ trialStartDate: date }),
            setSubscriptionStatus: (status) => set({ subscriptionStatus: status }),
            setTrialState: (snapshot) => set(snapshot),
            syncAccountTrial: (startDate) => {
                const normalizedStartDate = normalizeTrialStartDate(startDate);
                if (!normalizedStartDate) {
                    return;
                }

                set((state) => {
                    if (state.subscriptionStatus === 'active') {
                        return {};
                    }

                    const existingStartDate = normalizeTrialStartDate(state.trialStartDate ?? '');
                    const effectiveStartDate =
                        existingStartDate &&
                        new Date(existingStartDate).getTime() < new Date(normalizedStartDate).getTime()
                            ? existingStartDate
                            : normalizedStartDate;

                    return {
                        trialStartDate: effectiveStartDate,
                        subscriptionStatus: isLocalTrialActive(effectiveStartDate) ? 'trial' : 'expired',
                    };
                });
            },
            setPreferredPlanId: (preferredPlanId) => set({ preferredPlanId }),
            setRemoteCompedAccess: (enabled) => set({ remoteCompedAccess: enabled }),
            setDevOverrideEnabled: (enabled) => set({ devOverrideEnabled: enabled }),
            setDevTierOverride: (tier) => set({ devTierOverride: tier }),
            setRcSynced: (synced) => set({ rcSynced: synced }),

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
                    trialStartDate,
                    hasActiveEntitlement,
                    rcSynced,
                } = get();
                const localTrialActive =
                    subscriptionStatus === 'trial' && isLocalTrialActive(trialStartDate);

                if (__DEV__ && devOverrideEnabled) {
                    if (devTierOverride === 'expired' || devTierOverride === 'free') return 'free';
                    // 'trial' and 'pro' both grant full access
                    return 'pro';
                }

                if (remoteCompedAccess) return 'pro';

                // Active paid subscription always wins
                if (rcTier.startsWith('pro') || subscriptionStatus === 'active') return 'pro';

                // After RC has confirmed state, paid entitlement or the account-bound
                // local trial may grant access. A null trial date never does.
                if (rcSynced) {
                    return hasActiveEntitlement || localTrialActive ? 'pro' : 'free';
                }

                // Before RC sync: fall back to local trial clock (offline UX cache)
                if (localTrialActive) return 'pro';

                return 'free';
            },
        }),
        {
            name: 'anchor-subscription-override-storage',
            storage: createJSONStorage(() => AsyncStorage),
            version: 3,
            migrate: (persistedState: any, version: number) => {
                let nextState = persistedState ?? {};

                // v1 → v2: add trialStartDate and subscriptionStatus
                if (version < 2) {
                    nextState = {
                        ...nextState,
                        trialStartDate: nextState.trialStartDate ?? null,
                        subscriptionStatus: nextState.subscriptionStatus ?? 'trial',
                    };
                }

                // v2 → v3: null trialStartDate no longer means active trial.
                if (version < 3) {
                    nextState = {
                        ...nextState,
                        preferredPlanId: nextState.preferredPlanId ?? 'annual',
                        subscriptionStatus:
                            nextState.subscriptionStatus === 'trial' &&
                            !isLocalTrialActive(nextState.trialStartDate ?? null)
                                ? 'expired'
                                : nextState.subscriptionStatus,
                    };
                }

                return nextState;
            },
            partialize: (state) => ({
                devOverrideEnabled: state.devOverrideEnabled,
                devTierOverride: state.devTierOverride,
                trialStartDate: state.trialStartDate,
                subscriptionStatus: state.subscriptionStatus,
                preferredPlanId: state.preferredPlanId,
            }),
        }
    )
);

export { computeDaysRemaining, isLocalTrialActive, TRIAL_DURATION_DAYS };
