import { useMemo } from 'react';
import { useVisualizationSceneStore } from '@/stores/visualizationSceneStore';
import { useV2SelectedAnchor } from '@/hooks/v2/home/useV2SelectedAnchor';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { V2_PAYWALL_COPY, type V2PaywallContext } from '@/constants/v2/paywall';

export type V2PaywallArtifact =
  | { kind: 'anchor'; svg: string; category: string | null; categoryLabel: string; intention: string }
  | { kind: 'vision'; previewText: string | null; previewUri: string | null }
  | { kind: 'vision-placeholder' }
  | { kind: 'none' };

/**
 * Resolves the personal artifact shown at the top of the sheet.
 *
 *  - Practice / Deep Prime / Second Anchor → the user's active Anchor artwork.
 *  - Visualize / Vision premium action → the user's real Vision scene when one
 *    exists, otherwise the approved contextual placeholder. An Anchor is NEVER
 *    shown where a Vision preview is expected.
 *  - Everything else → no artifact (the sheet leads with copy).
 *
 * Nothing here is fabricated: a missing Anchor or Vision collapses the region.
 */
export function useV2PaywallArtifact(context: V2PaywallContext): V2PaywallArtifact {
  const { selectedAnchor } = useV2SelectedAnchor();
  const scenes = useVisualizationSceneStore((s) => s.scenes);

  const expected = V2_PAYWALL_COPY[context].artifact;

  return useMemo<V2PaywallArtifact>(() => {
    if (expected === 'anchor') {
      if (!selectedAnchor) return { kind: 'none' };
      return {
        kind: 'anchor',
        svg: anchorArtworkSvg(selectedAnchor),
        category: selectedAnchor.category ?? null,
        categoryLabel: categoryLabel(selectedAnchor.category),
        intention: selectedAnchor.intentionText,
      };
    }

    if (expected === 'vision') {
      const scene = selectedAnchor
        ? scenes[selectedAnchor.id] ?? (selectedAnchor.localId ? scenes[selectedAnchor.localId] : undefined)
        : undefined;
      const previewText = scene?.currentText?.trim() || scene?.originalSuggestion?.trim() || '';
      // The Vision domain has no image asset contract yet; `previewUri` is read
      // only if a real one is ever present and is never synthesised.
      const previewUri = (scene as { previewUri?: string } | undefined)?.previewUri ?? null;
      if (!previewText && !previewUri) return { kind: 'vision-placeholder' };
      return { kind: 'vision', previewText: previewText || null, previewUri };
    }

    return { kind: 'none' };
  }, [expected, selectedAnchor, scenes]);
}
