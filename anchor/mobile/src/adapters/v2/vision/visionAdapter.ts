import type {
  VisionReadModel,
  VisionSceneReadModel,
  V2VisionPresentationState,
  V2VisionTile,
  V2VisionCompactState,
  V2VisualizeHandoff,
} from './types';

/**
 * Normalizes backend VisionReadModel into the client V2 presentation state.
 * Degrades gracefully on empty scenes or offline/error states.
 */
export function toV2VisionPresentationState(
  raw: VisionReadModel | null | undefined,
  anchorId: string,
  options?: { isOffline?: boolean; error?: string },
): V2VisionPresentationState {
  if (options?.error) {
    return {
      state: 'error',
      anchorId,
      message: options.error,
      isOffline: options.isOffline,
    };
  }

  if (!raw || raw.status === 'ARCHIVED') {
    return { state: 'none', anchorId };
  }

  const activeScenes = (raw.scenes ?? [])
    .filter((scene: VisionSceneReadModel) => !scene.isArchived)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (activeScenes.length === 0) {
    return { state: 'none', anchorId };
  }

  const tiles: V2VisionTile[] = activeScenes.map((scene, index) => ({
    id: scene.id,
    sceneId: scene.id,
    imageUrl: scene.resolvedImageUrl,
    prompt: scene.prompt,
    sortOrder: scene.sortOrder,
    isHero: index === 0,
  }));

  const description =
    raw.description?.trim() ||
    activeScenes[0]?.prompt?.trim() ||
    'A clear picture of where this Anchor is taking you.';

  return {
    state: 'ready',
    anchorId,
    visionId: raw.id,
    title: raw.title ?? null,
    description,
    tiles,
    featuredTileId: tiles[0].id,
    seenToday: Boolean(raw.seenToday),
    raw,
  };
}

/**
 * Read-only compact adapter for Home and external summary cards.
 * Never triggers view tracking or writes to backend.
 */
export function toV2VisionCompactState(
  raw: VisionReadModel | null | undefined,
): V2VisionCompactState {
  if (!raw || raw.status === 'ARCHIVED') {
    return { state: 'none' };
  }

  const activeScenes = (raw.scenes ?? []).filter((s) => !s.isArchived);
  if (activeScenes.length === 0) {
    return { state: 'none' };
  }

  const previewText =
    raw.description?.trim() ||
    activeScenes[0]?.prompt?.trim() ||
    'Vision set';

  return {
    state: 'ready',
    visionId: raw.id,
    previewText,
    heroImageUrl: activeScenes[0]?.resolvedImageUrl ?? null,
    seenToday: Boolean(raw.seenToday),
    tileCount: activeScenes.length,
  };
}

/**
 * Handoff contract for UI-F Visualize practice mode.
 * Exposes active Vision asset, ID, and seen state.
 */
export function toVisualizeHandoff(
  raw: VisionReadModel | null | undefined,
): V2VisualizeHandoff {
  const hasVision = Boolean(
    raw && raw.status === 'ACTIVE' && raw.scenes && raw.scenes.some((s) => !s.isArchived),
  );
  if (!hasVision || !raw) {
    return {
      visionId: null,
      activeVisionAsset: null,
      seenToday: false,
      hasVision: false,
    };
  }

  const firstScene = raw.scenes.find((s) => !s.isArchived);
  return {
    visionId: raw.id,
    activeVisionAsset: firstScene?.resolvedImageUrl ?? firstScene?.assetId ?? null,
    seenToday: Boolean(raw.seenToday),
    hasVision: true,
  };
}
