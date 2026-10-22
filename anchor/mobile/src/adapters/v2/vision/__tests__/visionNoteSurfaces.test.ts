import { toV2VisionCompactState, toV2VisionPresentationState, toVisualizeHandoff } from '../visionAdapter';
import type { VisionReadModel } from '../types';

const noteOnly: VisionReadModel = {
  id: 'v1', anchorId: 'a1', title: null, description: null, status: 'ACTIVE', scenes: [], seenToday: false,
  createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z',
  notes: [{ id: 'n1', visionId: 'v1', content: { text: 'A life with time to create.' },
    presentation: { styleId: 'sticky_blush_pink', x: .3, y: .3, width: .3, height: .2, rotation: -2, scale: 1, layerOrder: 1 },
    createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z' }],
};

describe('note-only Vision surfaces', () => {
  it('shows a persisted note board without requiring a photograph', () => {
    expect(toV2VisionPresentationState(noteOnly, 'a1')).toMatchObject({ state: 'ready', tiles: [], featuredTileId: '', raw: noteOnly });
    expect(toV2VisionCompactState(noteOnly)).toMatchObject({ state: 'ready', tileCount: 0, heroImageUrl: null });
  });
  it('keeps empty, archived and other-Anchor reads empty', () => {
    expect(toV2VisionPresentationState({ ...noteOnly, notes: [] }, 'a1').state).toBe('none');
    expect(toV2VisionPresentationState({ ...noteOnly, status: 'ARCHIVED' }, 'a1').state).toBe('none');
    expect(toV2VisionPresentationState(noteOnly, 'other').state).toBe('none');
  });
  it('does not begin a photographic Visualize session without images', () => {
    expect(toVisualizeHandoff(noteOnly).hasVision).toBe(false);
  });
  it('does not treat archived notes as visible board content', () => {
    const archived = { ...noteOnly, notes: noteOnly.notes!.map(note => ({ ...note, isArchived: true })) };
    expect(toV2VisionPresentationState(archived, 'a1').state).toBe('none');
    expect(toV2VisionCompactState(archived).state).toBe('none');
  });
});
