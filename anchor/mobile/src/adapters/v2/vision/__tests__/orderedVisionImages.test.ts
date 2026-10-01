import { compareVisionScenes, getOrderedVisionImages, orderedActiveScenes } from '../orderedVisionImages';
import { toV2VisionCompactState, toV2VisionPresentationState, toVisualizeHandoff } from '../visionAdapter';
import type { VisionReadModel, VisionSceneReadModel } from '../types';

const scene = (id: string, sortOrder: number, overrides: Partial<VisionSceneReadModel> = {}): VisionSceneReadModel => ({
  id, visionId: 'v', sourceType: 'AI_GENERATED', assetId: `asset-${id}`, resolvedImageUrl: `https://cdn.example.com/${id}.jpg`,
  prompt: null, sortOrder, isArchived: false, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', ...overrides,
});
const vision = (scenes: VisionSceneReadModel[]): VisionReadModel => ({
  id: 'v', anchorId: 'a', title: null, description: 'My Vision', status: 'ACTIVE', scenes, seenToday: false,
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
});

describe('getOrderedVisionImages', () => {
  it('orders by the arrangement the person made and names the first the hero', () => {
    const tiles = getOrderedVisionImages(vision([scene('c', 2), scene('a', 0), scene('b', 1)]));
    expect(tiles.map(tile => tile.sceneId)).toEqual(['a', 'b', 'c']);
    expect(tiles.map(tile => tile.isHero)).toEqual([true, false, false]);
  });

  it('is identical however the server happens to return tied scenes', () => {
    // A replacement takes its predecessor's place, and older Visions can hold duplicates.
    const dashboard = scene('dashboard', 0, { createdAt: '2026-09-01T10:00:00.000Z' });
    const appStore = scene('app-store', 0, { createdAt: '2026-09-01T10:05:00.000Z' });
    const family = scene('family', 1);
    const forward = getOrderedVisionImages(vision([dashboard, appStore, family])).map(tile => tile.sceneId);
    const reversed = getOrderedVisionImages(vision([family, appStore, dashboard])).map(tile => tile.sceneId);
    expect(forward).toEqual(['dashboard', 'app-store', 'family']);
    expect(reversed).toEqual(forward);
  });

  it('breaks a full tie by id so the order never depends on the read', () => {
    const a = scene('a', 0);
    const b = scene('b', 0);
    expect(compareVisionScenes(a, b)).toBeLessThan(0);
    expect(orderedActiveScenes(vision([b, a])).map(item => item.id)).toEqual(['a', 'b']);
  });

  it('skips archived scenes, and with requireImage skips pictureless ones without reordering the rest', () => {
    const v = vision([scene('a', 0, { resolvedImageUrl: null }), scene('b', 1), scene('x', 2, { isArchived: true }), scene('c', 3)]);
    expect(getOrderedVisionImages(v).map(tile => tile.sceneId)).toEqual(['a', 'b', 'c']);
    const shown = getOrderedVisionImages(v, { requireImage: true });
    expect(shown.map(tile => tile.sceneId)).toEqual(['b', 'c']);
    expect(shown[0].isHero).toBe(true);
    expect(getOrderedVisionImages(v, { requireImage: true, limit: 1 })).toHaveLength(1);
  });

  it('handles no Vision, an empty Vision, a one-image Vision and a mixed Vision', () => {
    expect(getOrderedVisionImages(null)).toEqual([]);
    expect(getOrderedVisionImages(vision([]))).toEqual([]);
    expect(getOrderedVisionImages(vision([scene('only', 0)]))).toHaveLength(1);
    const mixed = getOrderedVisionImages(vision([
      scene('g', 0, { sourceType: 'AI_GENERATED' }), scene('u', 1, { sourceType: 'USER_UPLOAD' }), scene('c', 2, { sourceType: 'USER_CAMERA' }),
    ]));
    expect(mixed.map(tile => tile.sourceType)).toEqual(['AI_GENERATED', 'USER_UPLOAD', 'USER_CAMERA']);
  });
});

describe('every surface reads the same first image', () => {
  it('Vision, Home, setup and session agree on the hero, even when the server returns scenes out of order', () => {
    const raw = vision([scene('app-store', 2), scene('family', 1), scene('dashboard', 0)]);
    const presentation = toV2VisionPresentationState(raw, 'a');
    expect(presentation.state).toBe('ready');
    if (presentation.state !== 'ready') return;
    const visionScreenHero = presentation.tiles[0];
    expect(visionScreenHero.sceneId).toBe('dashboard');
    expect(presentation.featuredTileId).toBe('dashboard');
    expect(toV2VisionCompactState(raw)).toEqual(expect.objectContaining({ heroImageUrl: 'https://cdn.example.com/dashboard.jpg' }));
    expect(toVisualizeHandoff(raw).activeVisionAsset).toBe('https://cdn.example.com/dashboard.jpg');
    expect(getOrderedVisionImages(raw, { requireImage: true })[0].sceneId).toBe(visionScreenHero.sceneId);
  });
});
