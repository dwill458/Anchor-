/**
 * Entitlements Mapping
 * Drives feature gates across the app based on active tier.
 */

export interface Entitlements {
    tier: 'free' | 'pro';
    maxAnchors: number;
    aiStyleCount: number;
    aiVariationCount: number;
    canTraceAnchor: boolean;
    canForgeAnchor: boolean;
    canUseArchivedFilter: boolean;
    canExportHD: boolean;
}

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
            canTraceAnchor: true,
            canForgeAnchor: true,
            canUseArchivedFilter: true,
            canExportHD: true,
        };
    }

    // DEFERRED: freemium tier removed, replaced by trial model
    return {
        tier: 'free',
        maxAnchors: Infinity,
        aiStyleCount: 12,
        aiVariationCount: 4,
        canTraceAnchor: true,
        canForgeAnchor: true,
        canUseArchivedFilter: true,
        canExportHD: true,
    };
}
