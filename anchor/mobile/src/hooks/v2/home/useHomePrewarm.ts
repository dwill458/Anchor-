import { useEffect } from 'react';
import { Image } from 'react-native';
import { prefetchV2RecommendationContext } from '@/adapters/v2/practice/recommendationClient';
import { prefetchV2Vision } from '@/hooks/v2/vision';
import { loadAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import type { Anchor } from '@/types';

/**
 * Sliding window pre-warming for Home Anchors.
 *
 * Switching between Anchors must be instantaneous and local-first. This hook
 * ensures that for the active Anchor index `i`, lightweight state and critical
 * artwork for [i - 1, i, i + 1] are fetched into memory *before* the user
 * swipes. After settling for 400ms, it warms i + 2.
 *
 * Memory safe: strictly bounded to 3-4 items, never warming an entire vault.
 */
export function useHomePrewarm(
  anchors: Array<Anchor | { anchor: Anchor }>,
  selectedIndex: number,
): void {
  useEffect(() => {
    if (!anchors || anchors.length === 0 || selectedIndex < 0 || selectedIndex >= anchors.length) {
      return undefined;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    const total = anchors.length;
    const getAnchor = (idx: number): Anchor | null => {
      const item = anchors[idx];
      if (!item) return null;
      return 'anchor' in item ? item.anchor : item;
    };

    // Calculate immediate window: current, previous, next
    const current = getAnchor(selectedIndex);
    const prev = total > 1 ? getAnchor((selectedIndex - 1 + total) % total) : null;
    const next = total > 1 ? getAnchor((selectedIndex + 1) % total) : null;

    const warmAnchor = (anchor: Anchor | null) => {
      if (!anchor || signal.aborted) return;
      const id = anchor.id;

      // 1. Artwork bitmap prefetch
      if (anchor.enhancedImageUrl) {
        void Image.prefetch(anchor.enhancedImageUrl).catch(() => undefined);
      }

      // 2. Server recommendation context
      void prefetchV2RecommendationContext(id, signal).catch(() => undefined);

      // 3. Vision read model & cover photograph
      void prefetchV2Vision(id, signal).then((vision) => {
        if (signal.aborted || !vision) return;
        const heroScene = [...vision.scenes]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .find((scene) => scene.resolvedImageUrl);
        if (heroScene?.resolvedImageUrl) {
          void Image.prefetch(heroScene.resolvedImageUrl).catch(() => undefined);
        }
      }).catch(() => undefined);

      // 4. Chart route data
      void loadAnchorChart(id).catch(() => undefined);
    };

    // Warm immediate window (current first, then adjacent neighbours)
    warmAnchor(current);
    if (next && next.id !== current?.id) warmAnchor(next);
    if (prev && prev.id !== current?.id && prev.id !== next?.id) warmAnchor(prev);

    // Warm i + 2 after the user settles on this Anchor
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    if (total > 3) {
      settleTimer = setTimeout(() => {
        if (signal.aborted) return;
        const nextPlus2 = getAnchor((selectedIndex + 2) % total);
        if (nextPlus2 && nextPlus2.id !== current?.id && nextPlus2.id !== next?.id && nextPlus2.id !== prev?.id) {
          warmAnchor(nextPlus2);
        }
      }, 400);
    }

    return () => {
      if (settleTimer) clearTimeout(settleTimer);
      controller.abort();
    };
  }, [anchors, selectedIndex]);
}
