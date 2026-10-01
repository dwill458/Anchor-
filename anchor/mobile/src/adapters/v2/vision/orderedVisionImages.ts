import type { V2VisionTile, VisionReadModel, VisionSceneReadModel } from './types';

/**
 * The one order a Vision's images are ever shown in: the Vision board, Home,
 * the Visualize setup collage and the Visualize session all read it, so the
 * first image on the Vision is the first image in the session.
 *
 * `sortOrder` is the person's arrangement. It is not guaranteed unique (a
 * replacement takes its predecessor's place, and older Visions may hold
 * duplicates), so ties fall back to when the image was added and then to its
 * id, which keeps the order identical on every read and every device.
 */
export function compareVisionScenes(a: VisionSceneReadModel, b: VisionSceneReadModel): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  const createdA = Date.parse(a.createdAt);
  const createdB = Date.parse(b.createdAt);
  if (Number.isFinite(createdA) && Number.isFinite(createdB) && createdA !== createdB) return createdA - createdB;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Active (not archived) scenes in display order. Does not require a picture. */
export function orderedActiveScenes(raw: VisionReadModel | null | undefined): VisionSceneReadModel[] {
  return (raw?.scenes ?? []).filter(scene => !scene.isArchived).sort(compareVisionScenes);
}

export function toVisionTile(scene: VisionSceneReadModel, index: number): V2VisionTile {
  return {
    id: scene.id,
    sceneId: scene.id,
    imageUrl: scene.resolvedImageUrl,
    prompt: scene.prompt,
    sortOrder: scene.sortOrder,
    isHero: index === 0,
    sourceType: scene.sourceType,
  };
}

/**
 * The Vision's images in display order. With `requireImage` (what the setup
 * collage and the session use) scenes without a picture are skipped, which
 * never reorders the rest: the hero is the first image that can be shown.
 */
export function getOrderedVisionImages(
  raw: VisionReadModel | null | undefined,
  options: { requireImage?: boolean; limit?: number } = {},
): V2VisionTile[] {
  const scenes = orderedActiveScenes(raw);
  const shown = options.requireImage ? scenes.filter(scene => Boolean(scene.resolvedImageUrl?.trim())) : scenes;
  const tiles = shown.map(toVisionTile);
  return typeof options.limit === 'number' ? tiles.slice(0, options.limit) : tiles;
}
