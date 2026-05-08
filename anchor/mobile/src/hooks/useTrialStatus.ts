/**
 * useTrialStatus Hook
 *
 * Derives trial/subscription state from subscriptionStore.
 * Single source of truth for "can this user access the app" decisions.
 *
 * @example
 * const { isTrialActive, daysRemaining, hasExpired, isSubscribed } = useTrialStatus();
 * if (hasExpired && !isSubscribed) { // show paywall }
 */

import { useSubscriptionStore, computeDaysRemaining } from '@/stores/subscriptionStore';
import { useSettingsStore } from '@/stores/settingsStore';

export interface TrialStatus {
    /** Trial is active and days remain. */
    isTrialActive: boolean;
    /** User has a paid active subscription. */
    isSubscribed: boolean;
    /** Trial has expired and no active subscription. */
    hasExpired: boolean;
    /** Trial has expired (alias for hasExpired). */
    trialExpired: boolean;
    /** User has an active trial or subscription entitlement. */
    hasActiveEntitlement: boolean;
    /** Days remaining in the trial (0 when expired or no trial started). */
    daysRemaining: number;
    /** Raw subscriptionStatus field. */
    subscriptionStatus: 'trial' | 'active' | 'expired';
}

export function useTrialStatus(): TrialStatus {
    const subscriptionStatus = useSubscriptionStore((s) => s.subscriptionStatus);
    const trialStartDate = useSubscriptionStore((s) => s.trialStartDate);
    const remoteCompedAccess = useSubscriptionStore((s) => s.remoteCompedAccess);
    const devOverrideEnabled = useSubscriptionStore((s) => s.devOverrideEnabled);
    const devTierOverride = useSubscriptionStore((s) => s.devTierOverride);
    const developerMasterAccountEnabled = useSettingsStore(
        (s) => s.developerMasterAccountEnabled
    );

    if (__DEV__ && developerMasterAccountEnabled) {
        return {
            isTrialActive: false,
            isSubscribed: true,
            hasExpired: false,
            trialExpired: false,
            hasActiveEntitlement: true,
            daysRemaining: 0,
            subscriptionStatus: 'active',
        };
    }

    if (remoteCompedAccess) {
        return {
            isTrialActive: false,
            isSubscribed: true,
            hasExpired: false,
            trialExpired: false,
            hasActiveEntitlement: true,
            daysRemaining: 0,
            subscriptionStatus: 'active',
        };
    }

    // Dev override: simulate expired state
    if (__DEV__ && devOverrideEnabled && (devTierOverride === 'expired' || devTierOverride === 'free')) {
        return {
            isTrialActive: false,
            isSubscribed: false,
            hasExpired: true,
            trialExpired: true,
            hasActiveEntitlement: false,
            daysRemaining: 0,
            subscriptionStatus: 'expired',
        };
    }

    // Dev override: simulate active subscription
    if (__DEV__ && devOverrideEnabled && devTierOverride === 'pro') {
        return {
            isTrialActive: false,
            isSubscribed: true,
            hasExpired: false,
            trialExpired: false,
            hasActiveEntitlement: true,
            daysRemaining: 0,
            subscriptionStatus: 'active',
        };
    }

    // Dev override: simulate trial
    if (__DEV__ && devOverrideEnabled && devTierOverride === 'trial') {
        return {
            isTrialActive: true,
            isSubscribed: false,
            hasExpired: false,
            trialExpired: false,
            hasActiveEntitlement: true,
            daysRemaining: 7,
            subscriptionStatus: 'trial',
        };
    }

    const daysRemaining = computeDaysRemaining(trialStartDate);
    const isSubscribed = subscriptionStatus === 'active';
    const isTrialActive = subscriptionStatus === 'trial' && daysRemaining > 0;
    const hasExpired =
        subscriptionStatus === 'expired' ||
        (subscriptionStatus === 'trial' && daysRemaining === 0);

    return {
        isTrialActive,
        isSubscribed,
        hasExpired,
        trialExpired: hasExpired,
        hasActiveEntitlement: isSubscribed || isTrialActive,
        daysRemaining,
        subscriptionStatus,
    };
}
