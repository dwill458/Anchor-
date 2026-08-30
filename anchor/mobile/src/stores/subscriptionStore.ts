import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionStatus } from '@/types';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';

/** Store intro length; entitlement eligibility comes from RevenueCat/store. */
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
    // Kept as a compatibility export for older callers. Local dates never
    // grant access after the RevenueCat migration.
    return false;
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
    legacyMigrationAccess: boolean;

    // Trial state (local, AsyncStorage-persisted)
    trialStartDate: string | null;
    subscriptionStatus: 'trial' | 'active' | 'expired';
    preferredPlanId: PreferredPlanId;

    // Developer override controls
    devOverrideEnabled: boolean;
    devTierOverride: 'free' | 'pro' | 'trial' | 'expired';

    // True once RevenueCat has returned at least one real response (not persisted — resets on reinstall)
    rcSynced: boolean;
    entitlementReady: boolean;

    // Actions
    setRcTier: (tier: SubscriptionStatus) => void;
    setTrialStartDate: (date: string) => void;
    setSubscriptionStatus: (status: 'trial' | 'active' | 'expired') => void;
    setTrialState: (snapshot: TrialStatusSnapshot) => void;
    applyServerEntitlement: (hasActiveEntitlement: boolean) => void;
    syncAccountTrial: (startDate: Date | string) => void;
    applyServerTrial: (startDate: Date | string, serverExpired?: boolean) => void;
    confirmServerExpiry: () => void;
    setPreferredPlanId: (planId: PreferredPlanId) => void;
    setRemoteCompedAccess: (enabled: boolean) => void;
    setLegacyMigrationAccess: (enabled: boolean) => void;
    setDevOverrideEnabled: (enabled: boolean) => void;
    setDevTierOverride: (tier: 'free' | 'pro' | 'trial' | 'expired') => void;
    setRcSynced: (synced: boolean) => void;
    setEntitlementReady: (ready: boolean) => void;
    resetForAccount: () => void;
    resetOverrides: () => void;

    // Computed values (accessed via selectors or the hook)
    getEffectiveTier: () => 'free' | 'pro';
}

export const useSubscriptionStore = create<SubscriptionState>()(
    persist(
        (set, get) => ({
            rcTier: 'free',
            remoteCompedAccess: false,
            legacyMigrationAccess: false,
            trialStartDate: null,
            subscriptionStatus: 'expired',
            preferredPlanId: 'annual',
            devOverrideEnabled: false,
            devTierOverride: 'pro',
            rcSynced: false,
            entitlementReady: false,

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
            applyServerEntitlement: (hasActiveEntitlement) =>
                set({
                    rcTier: hasActiveEntitlement ? 'pro' : 'free',
                    isInTrial: false,
                    isSubscribed: hasActiveEntitlement,
                    hasActiveEntitlement,
                    daysRemaining: null,
                    trialExpired: !hasActiveEntitlement,
                    subscriptionStatus: hasActiveEntitlement ? 'active' : 'expired',
                    rcSynced: true,
                    entitlementReady: true,
                }),
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

                    return { trialStartDate: effectiveStartDate };
                });
            },
            applyServerTrial: (startDate, serverExpired) => {
                // The server owns the trial anchor (trialStartedAt). Unlike
                // syncAccountTrial — which keeps the EARLIEST date as an
                // anti-tamper guard against cleared local storage — here we
                // trust and REPLACE the local clock with the server value,
                // because only the backend can mutate it. This is what lets a
                // reset (e.g. migrating beta accounts to a fresh trial) actually
                // take effect on devices that still hold a stale start date.
                const normalizedStartDate = normalizeTrialStartDate(startDate);
                if (!normalizedStartDate) {
                    return;
                }

                set((state) => {
                    return { trialStartDate: normalizedStartDate };
                });
            },
            confirmServerExpiry: () => {
                set({ trialExpired: true });
            },
            setPreferredPlanId: (preferredPlanId) => set({ preferredPlanId }),
            setRemoteCompedAccess: (enabled) => set({ remoteCompedAccess: enabled }),
            setLegacyMigrationAccess: (enabled) => set({ legacyMigrationAccess: enabled }),
            setDevOverrideEnabled: (enabled) => set({ devOverrideEnabled: enabled }),
            setDevTierOverride: (tier) => set({ devTierOverride: tier }),
            setRcSynced: (synced) => set({ rcSynced: synced }),
            setEntitlementReady: (ready) => set({ entitlementReady: ready }),
            resetForAccount: () => set({
                rcTier: 'free',
                remoteCompedAccess: false,
                legacyMigrationAccess: false,
                isInTrial: false,
                isSubscribed: false,
                hasActiveEntitlement: false,
                daysRemaining: null,
                trialExpired: false,
                subscriptionStatus: 'expired',
                trialStartDate: null,
                rcSynced: false,
                entitlementReady: false,
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
                    hasActiveEntitlement,
                } = get();

                if (__DEV__ && devOverrideEnabled) {
                    if (devTierOverride === 'expired' || devTierOverride === 'free') return 'free';
                    // 'trial' and 'pro' both grant full access
                    return 'pro';
                }

                if (remoteCompedAccess) return 'pro';

                return hasActiveEntitlement ? 'pro' : 'free';
            },
        }),
        {
            name: 'anchor-subscription-override-storage',
            storage: createJSONStorage(() => AsyncStorage),
            version: 5,
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

                if (version < 4) {
                    nextState = { ...nextState, entitlementReady: false };
                }

                if (version < 5) {
                    // Legacy trial timestamps remain readable in old builds,
                    // but are not persisted into the RevenueCat-era store.
                    nextState = {
                        ...nextState,
                        trialStartDate: null,
                        subscriptionStatus: 'expired',
                    };
                }

                return nextState;
            },
            partialize: (state) => ({
                devOverrideEnabled: state.devOverrideEnabled,
                devTierOverride: state.devTierOverride,
                preferredPlanId: state.preferredPlanId,
            }),
        }
    )
);

export { computeDaysRemaining, isLocalTrialActive, TRIAL_DURATION_DAYS };
