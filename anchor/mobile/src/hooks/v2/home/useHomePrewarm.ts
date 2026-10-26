import { useEffect, useRef } from 'react';
import { Image } from 'react-native';
import { prefetchV2RecommendationContext } from '@/adapters/v2/practice/recommendationClient';
import { hydrateV2RecommendationContext } from '@/adapters/v2/practice/recommendationCache';
import { prefetchV2Vision } from '@/hooks/v2/vision';
import { loadAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { useAuthStore } from '@/stores/authStore';
import type { PerformanceTier } from '@/hooks/useAppPerformanceTier';
import type { Anchor } from '@/types';

/** Warm the carousel's actual mounted window: five on medium/high, three on low. */
export function useHomePrewarm(
  anchors: Array<Anchor | { anchor: Anchor }>,
  centerIndex: number,
  tier: PerformanceTier = 'high',
): void {
  const accountId = useAuthStore(state => state.user?.id ?? null);
  const offsets = tier === 'low' ? [0, 1, -1] : [0, 1, -1, 2, -2];
  const window: Anchor[] = [];
  const seen = new Set<string>();
  if (centerIndex >= 0 && centerIndex < anchors.length) {
    for (const offset of offsets) {
      const item = anchors[(centerIndex + offset + anchors.length) % anchors.length];
      const anchor = 'anchor' in item ? item.anchor : item;
      if (!seen.has(anchor.id)) {
        seen.add(anchor.id);
        window.push(anchor);
      }
    }
  }
  // Cache publications replace summary objects. Only a changed account, ID or
  // artwork URL should restart warming, not each completed recommendation read.
  const windowKey = JSON.stringify([accountId, window.map(anchor => [anchor.id, anchor.enhancedImageUrl])]);
  const latestWindow = useRef(window);
  latestWindow.current = window;

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    for (const anchor of latestWindow.current) {
      const id = anchor.id;
      if (anchor.enhancedImageUrl) void Image.prefetch(anchor.enhancedImageUrl).catch(() => undefined);
      void hydrateV2RecommendationContext(id, accountId).catch(() => null);
      // Home joins this account-scoped request after selection commits. Moving
      // the mounted window must not cancel that shared read.
      void prefetchV2RecommendationContext(id).catch(() => undefined);
      void prefetchV2Vision(id, signal).then(vision => {
        if (signal.aborted || !vision) return;
        const heroScene = [...vision.scenes]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .find(scene => scene.resolvedImageUrl);
        if (heroScene?.resolvedImageUrl) void Image.prefetch(heroScene.resolvedImageUrl).catch(() => undefined);
      }).catch(() => undefined);
      void loadAnchorChart(id).catch(() => undefined);
    }
    return () => controller.abort();
  }, [accountId, windowKey]);
}