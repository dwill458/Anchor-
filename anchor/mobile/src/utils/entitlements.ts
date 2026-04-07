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
            aiStyleCount: 12, // All available styles
            aiVariationCount: 4, // 4 variations for Pro
            canTraceAnchor: true,
            canForgeAnchor: true,
            canUseArchivedFilter: true,
            canExportHD: true,
        };
    }

    // default: Free tier
    return {
        tier: 'free',
        maxAnchors: 2, // As requested: Free users get 2 anchors
        aiStyleCount: 4, // Limit to basic styles
        aiVariationCount: 2, // 2 variations for Free
        canTraceAnchor: true,
        canForgeAnchor: false, // Gated feature
        canUseArchivedFilter: false, // Gated feature
        canExportHD: false,
    };
}
