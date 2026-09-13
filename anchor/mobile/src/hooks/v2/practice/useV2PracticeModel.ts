import { useEffect, useMemo, useState } from 'react';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { toThreadPresentation, toV2HomeVisionState } from '@/adapters/v2/home';
import { fetchV2RecommendationContext, type V2RecommendationContext } from '@/adapters/v2/practice';
import { useV2Vision } from '@/hooks/v2/vision';
import type { Anchor } from '@/types';

export type V2PracticeCapabilities = { focus: boolean; deep_prime: boolean; visualize: boolean; release: boolean };

export function useV2PracticeModel(anchor: Anchor | null, suppliedRecommendation?: V2RecommendationContext | null) {
  const entitlementReady = useSubscriptionStore((state) => state.entitlementReady);
  const hasActiveEntitlement = useSubscriptionStore((state) => state.getEffectiveTier() === 'pro');
  const [recommendation, setRecommendation] = useState<V2RecommendationContext | null>(suppliedRecommendation ?? null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(!suppliedRecommendation && !!anchor);
  const visionModel = useV2Vision(anchor?.id ?? '');

  useEffect(() => {
    if (suppliedRecommendation) { setRecommendation(suppliedRecommendation); setLoadingRecommendation(false); return; }
    if (!anchor) { setRecommendation(null); setLoadingRecommendation(false); return; }
    const controller = new AbortController();
    setLoadingRecommendation(true);
    setRecommendationError(null);
    void fetchV2RecommendationContext(anchor.id, controller.signal)
      .then(setRecommendation)
      .catch((error: unknown) => { if (!controller.signal.aborted) setRecommendationError(error instanceof Error ? error.message : 'Recommendation is unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingRecommendation(false); });
    return () => controller.abort();
  }, [anchor?.id, suppliedRecommendation]);

  return useMemo(() => {
    const capability: V2PracticeCapabilities = {
      focus: entitlementReady,
      deep_prime: entitlementReady && hasActiveEntitlement,
      visualize: entitlementReady && hasActiveEntitlement,
      release: true,
    };
    return { anchor, thread: anchor ? toThreadPresentation(anchor) : null, vision: anchor ? toV2HomeVisionState(visionModel.state) : { state: 'none' as const }, recommendation, recommendationError, loadingRecommendation, capability };
  }, [anchor, entitlementReady, hasActiveEntitlement, loadingRecommendation, recommendation, recommendationError, visionModel.state]);
}
