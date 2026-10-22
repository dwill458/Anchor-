import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { useV2Vision } from '@/hooks/v2/vision';
import { resolveAnchorCategory } from '@/utils/categoryDetection';
import type { ChartIdentity } from '@/components/v2/chart/ChartChrome';
import type { ChartAnchorArt } from '@/components/v2/chart/ChartLandscape';
import type { ChartVisionPreview } from '@/components/v2/chart/ChartActiveView';
import type { ChartForAnchor } from '@/services/v2/chartV2Api';

/**
 * Anchor identity + real Vision for every Chart screen. The Anchor comes from
 * the local store (so the mark renders offline); the server read model fills
 * in when the Anchor is no longer in the store (e.g. released).
 */
export function useChartContext(anchorId: string, server: ChartForAnchor | null) {
  const anchor = useAnchorStore((state) => state.anchors.find((item) => item.id === anchorId || item.localId === anchorId));
  const vision = useV2Vision(anchor || server ? anchorId : '');

  const identity: ChartIdentity | null = useMemo(() => {
    if (anchor) {
      const art = anchorRenderProps(anchor);
      return {
        intention: anchor.intentionText,
        category: resolveAnchorCategory(anchor.category),
        art,
        imageUrl: anchor.enhancedImageUrl,
      };
    }
    if (server) {
      return {
        intention: server.anchor.intentionText,
        category: resolveAnchorCategory(server.anchor.category),
        art: null,
        imageUrl: server.anchor.enhancedImageUrl,
      };
    }
    return null;
  }, [anchor, server]);

  const anchorArt: ChartAnchorArt | null = useMemo(() => {
    if (!anchor) return null;
    const art = anchorRenderProps(anchor);
    return { svg: art.svg, imageUrl: art.imageUrl, category: art.category, expression: art.expression };
  }, [anchor]);

  const visionPreview: ChartVisionPreview | null = useMemo(() => {
    const model = vision.vision;
    if (!model) return null;
    const tiles = vision.tiles ?? [];
    const imageUrl =
      tiles.find((tile) => tile.isHero && tile.imageUrl)?.imageUrl ??
      tiles.find((tile) => tile.imageUrl)?.imageUrl ??
      model.scenes?.find((scene) => scene.resolvedImageUrl)?.resolvedImageUrl ??
      null;
    if (!imageUrl && !model.description) return null;
    return { imageUrl: imageUrl ?? null, description: model.description ?? null, title: model.title ?? null };
  }, [vision.vision, vision.tiles]);

  return { anchor, identity, anchorArt, vision: visionPreview, visionLoading: vision.loading };
}
