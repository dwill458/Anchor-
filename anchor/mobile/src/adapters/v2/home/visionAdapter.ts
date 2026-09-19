import type { VisualizationScene } from '@/types/practice';
import type { V2VisionPresentationState, V2VisionTile } from '@/adapters/v2/vision';

/**
 * Honest Vision state for Home. The Vision domain currently persists only a
 * text scene (no image assets), so `ready` carries `previewText`. `previewUri`
 * is declared for a future Vision-asset contract but is never fabricated.
 */
export type HomeVisionState =
  | { state: 'none' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | {
      state: 'ready';
      visionId: string;
      previewText: string;
      previewUri?: string;
      title?: string | null;
      tiles?: V2VisionTile[];
      featuredTileId?: string;
      /**
       * Server-computed against the client's IANA timezone, so it is a real
       * local day rather than a UTC one. Home reads it; it never derives it.
       */
      seenToday?: boolean;
    };

export function toHomeVisionState(scene: VisualizationScene | undefined | null): HomeVisionState {
  if (!scene) return { state: 'none' };
  const text = scene.currentText?.trim() || scene.originalSuggestion?.trim() || '';
  if (!text) return { state: 'none' };
  return {
    state: 'ready',
    visionId: scene.id ?? scene.anchorId,
    previewText: text,
  };
}

/**
 * Home's Vision preview is sourced from the V2 Vision read model. Empty text
 * is preserved as empty; this adapter never invents a description for a real
 * record. A Vision with neither usable copy nor a usable scene is omitted.
 */
export function toV2HomeVisionState(
  presentation: V2VisionPresentationState,
): HomeVisionState {
  if (presentation.state === 'loading') return { state: 'loading' };
  if (presentation.state === 'error') return { state: 'error', message: presentation.message };
  if (presentation.state === 'none') return { state: 'none' };

  const tiles = presentation.tiles.filter((tile) => Boolean(tile.imageUrl || tile.prompt?.trim()));
  const previewText = presentation.description.trim();
  if (!previewText && tiles.length === 0) return { state: 'none' };

  return {
    state: 'ready',
    visionId: presentation.visionId,
    previewText,
    title: presentation.title,
    tiles,
    featuredTileId: tiles.some((tile) => tile.id === presentation.featuredTileId)
      ? presentation.featuredTileId
      : tiles[0]?.id,
    seenToday: presentation.seenToday,
  };
}
