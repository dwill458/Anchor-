import { toV2HomeVisionState } from '../visionAdapter';
import type { V2VisionPresentationState, VisionNote } from '@/adapters/v2/vision';

it('passes existing note records to Home without copying or replacing their selected styles', () => {
  const notes: VisionNote[] = [{
    id: 'n1', visionId: 'v1', content: { text: 'My own words' }, createdAt: '', updatedAt: '',
    presentation: { styleId: 'sticky_blush_pink', x: 0.5, y: 0.5, width: 0.3, height: 0.2, rotation: 2, scale: 1, layerOrder: 1 },
  }];
  const presentation: V2VisionPresentationState = {
    state: 'ready', anchorId: 'a1', visionId: 'v1', title: null, description: '', tiles: [], featuredTileId: '', seenToday: false,
    raw: { id: 'v1', anchorId: 'a1', status: 'ACTIVE', title: null, description: '', scenes: [], notes, seenToday: false, createdAt: '', updatedAt: '' },
  };
  const result = toV2HomeVisionState(presentation);
  expect(result.state).toBe('ready');
  if (result.state === 'ready') expect(result.notes).toBe(notes);
});
