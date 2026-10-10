import { toV2VisionPresentationState, toVisualizeHandoff, type VisionReadModel } from '@/adapters/v2/vision';

const baseVision: VisionReadModel = {
  id: 'v1', anchorId: 'a1', title: 'A note-like title', description: 'A real Vision description.', status: 'ACTIVE',
  seenToday: false, createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z',
  scenes: [{ id: 's1', visionId: 'v1', sourceType: 'USER_UPLOAD', assetId: 'asset-1',
    resolvedImageUrl: 'https://example.test/vision.jpg', prompt: 'A real scene', caption: null,
    sortOrder: 0, isArchived: false, createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' }],
};

describe('Vision note read compatibility', () => {
  it('keeps old responses without notes on the same ready tile and handoff path', () => {
    const state = toV2VisionPresentationState(baseVision, 'a1');
    expect(state.state).toBe('ready');
    if (state.state !== 'ready') return;
    expect(state.raw.notes).toBeUndefined();
    expect(state.tiles.map(tile => tile.sceneId)).toEqual(['s1']);
    expect(state.title).toBe('A note-like title');
    expect(state.description).toBe('A real Vision description.');
    expect(toVisualizeHandoff(baseVision)).toMatchObject({ visionId: 'v1', hasVision: true });
  });

  it('preserves optional note content and board presentation without changing tile or Vision fields', () => {
    const vision: VisionReadModel = { ...baseVision, notes: [{ id: 'n1', visionId: 'v1',
      content: { text: 'A thought worth keeping.' },
      presentation: { styleId: 'paper_ivory_torn', x: 0.5, y: 0.5, width: 0.3, height: 0.2, rotation: -2, scale: 1, layerOrder: 3 },
      createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' }] };
    const state = toV2VisionPresentationState(vision, 'a1');
    expect(state.state).toBe('ready');
    if (state.state !== 'ready') return;
    expect(state.raw.notes?.[0].content.text).toBe('A thought worth keeping.');
    expect(state.tiles.map(tile => tile.sceneId)).toEqual(['s1']);
    expect(state.title).toBe(baseVision.title);
    expect(state.description).toBe(baseVision.description);
    expect(toVisualizeHandoff(vision)).toMatchObject({ visionId: 'v1', hasVision: true });
  });
});
