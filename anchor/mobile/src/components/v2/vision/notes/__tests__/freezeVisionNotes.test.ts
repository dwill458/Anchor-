import { freezeVisionNotes } from '../freezeVisionNotes';
import type { VisionNote } from '@/adapters/v2/vision';

it('freezes note content and geometry against live cache updates during Visualize', () => {
  const note: VisionNote = { id: 'n', visionId: 'v', content: { text: 'Time to create' },
    presentation: { styleId: 'sticky_blush_pink', x: .4, y: .3, width: .3, height: .2, rotation: 2, scale: 1, layerOrder: 1 },
    createdAt: 'now', updatedAt: 'now' };
  const snapshot = freezeVisionNotes([note]);
  note.content.text = 'Changed during practice';
  note.presentation.x = .8;
  expect(snapshot[0].content.text).toBe('Time to create');
  expect(snapshot[0].presentation.x).toBe(.4);
  expect(freezeVisionNotes()).toEqual([]);
});
