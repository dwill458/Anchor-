/**
 * Entitlements Mapping
 * Drives feature gates across the app based on active tier.
 */

export interface Entitlements {
    tier: 'free' | 'pro';
    maxAnchors: number;
    aiStyleCount: number;
    aiVariationCount: number;
    focusSessionsPerWeek: number;
    deepPrimeSessionsPerWeek: number;
    canTraceAnchor: boolean;
    canForgeAnchor: boolean;
    canUseArchivedFilter: boolean;
    canExportHD: boolean;
}

export const FREE_TIER_FOCUS_SESSIONS_PER_WEEK = 5;
export const FREE_TIER_DEEP_PRIMES_PER_WEEK = 2;

/**
 * Returns feature access flags based on the provided tier.
 */
export function getEntitlements(tier: 'free' | 'pro'): Entitlements {
    if (tier === 'pro') {
        return {
            tier: 'pro',
            maxAnchors: Infinity,
            aiStyleCount: 12,
            aiVariationCount: 4,
            focusSessionsPerWeek: Infinity,
            deepPrimeSessionsPerWeek: Infinity,
            canTraceAnchor: true,
            canForgeAnchor: true,
            canUseArchivedFilter: true,
            canExportHD: true,
        };
    }

    // DEFERRED: freemium tier removed — replaced by trial model
    return {
        tier: 'free',
        maxAnchors: Infinity,
        aiStyleCount: 12,
        aiVariationCount: 4,
        focusSessionsPerWeek: FREE_TIER_FOCUS_SESSIONS_PER_WEEK,
        deepPrimeSessionsPerWeek: FREE_TIER_DEEP_PRIMES_PER_WEEK,
        canTraceAnchor: true,
        canForgeAnchor: true,
        canUseArchivedFilter: true,
        canExportHD: true,
    };
}
