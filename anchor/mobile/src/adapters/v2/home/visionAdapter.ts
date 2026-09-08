import type { VisualizationScene } from '@/types/practice';

/**
 * Honest Vision state for Home. The Vision domain currently persists only a
 * text scene (no image assets), so `ready` carries `previewText`. `previewUri`
 * is declared for a future Vision-asset contract but is never fabricated.
 */
export type HomeVisionState =
  | { state: 'none' }
  | { state: 'ready'; visionId: string; previewText: string; previewUri?: string };

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
