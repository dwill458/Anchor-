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

/**
 * The one hero image Home ever shows for a Vision: the featured tile if one is
 * marked and has an image, else the first tile that has an image. Shared by
 * the Vision section itself and by Today (which borrows it only when the
 * active recommendation is Visualize), so the two surfaces can never disagree
 * about which photograph is "the" Vision cover.
 */
export function resolveVisionHeroImage(vision: HomeVisionState): string | null {
  if (vision.state !== 'ready') return null;
  const tiles = vision.tiles ?? [];
  const featured = tiles.find((tile) => tile.id === vision.featuredTileId) ?? tiles.find((tile) => tile.imageUrl) ?? tiles[0];
  return featured?.imageUrl?.trim() || null;
}

/**
 * A second, distinct Vision photograph for Today's Visualize hero — never the
 * same image object Home already shows in the Vision section below. `null`
 * when the Vision has only one image (or none), so Today falls back to
 * reusing the hero image itself with a different focus/crop instead.
 */
export function resolveVisionAlternateImage(vision: HomeVisionState): string | null {
  if (vision.state !== 'ready') return null;
  const heroUri = resolveVisionHeroImage(vision);
  const tiles = vision.tiles ?? [];
  const alternate = tiles.find((tile) => {
    const uri = tile.imageUrl?.trim();
    return Boolean(uri) && uri !== heroUri;
  });
  return alternate?.imageUrl?.trim() || null;
}

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
