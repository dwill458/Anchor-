import { composeVisionBoard, unprojectClassicNote } from '../visionBoardComposition';
import { selectSlotBoardLayout, slotBoardHeightRatio, toSceneRect } from '../visionBoardLayouts';
import type { V2VisionTile, VisionNote } from '@/adapters/v2/vision';

const tiles = (count: number, caption = ''): V2VisionTile[] => Array.from({ length: count }, (_, i) => ({ id: `p${i}`, sceneId: `p${i}`, imageUrl: `https://real/${i}`, caption, prompt: null, sortOrder: i, slotIndex: i, isHero: i === 0 }));
const note: VisionNote = { id: 'n', visionId: 'v', content: { text: 'My actual note' }, presentation: { styleId: 'sticky_butter_yellow', x: .5, y: .8, width: .2, height: .12, rotation: 0, scale: 1, layerOrder: 2 }, createdAt: '', updatedAt: '' };

describe('shared Vision board composition', () => {
  it.each(['CLASSIC', 'EDITORIAL', 'SCRAPBOOK'] as const)('%s supports 1-8 photographs, captions and real notes', boardLayout => {
    for (let count = 1; count <= 8; count++) for (const width of [336, 366, 406]) for (const fontScale of [1, 1.3]) {
      const input = tiles(count, 'Every ordinary day I choose a life with room for what matters most to me.');
      const result = composeVisionBoard({ tiles: input, notes: [note], boardLayout, width, fontScale });
      expect(result.slotMap.filter(Boolean)).toHaveLength(count);
      expect(result.layout.photos).toHaveLength(8);
      for (let i = 0; i < count; i++) {
        const rect = toSceneRect(result.layout.photos[i], result.size);
        expect([rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)).toBe(true);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.height).toBeLessThan(result.size.height);
        expect(result.layout.photos[i].caption?.fontSize! * width / fontScale + 1e-8).toBeGreaterThanOrEqual(boardLayout === 'EDITORIAL' ? 10.5 : 13);
      }
      expect(input).toEqual(tiles(count, input[0].caption!));
      expect(result.notes[0].content.text).toBe(note.content.text);
    }
  });
  it('keeps the uncaptioned Classic composition unchanged', () => {
    const expected = selectSlotBoardLayout(slotBoardHeightRatio(7));
    const result = composeVisionBoard({ tiles: tiles(8), width: 366 });
    expect(result.layout.photos.map(({ caption, ...slot }) => slot)).toEqual(
      expected.photos.map((slot, index) => ({ ...slot, apertureBottom: index === 3 ? .7 : .78 })),
    );
    expect(result.layout.card).toEqual(expected.card);
  });
  it('uses measured caption heights and offsets notes without writing their saved coordinates', () => {
    const input = { tiles: tiles(8, 'Long caption'), notes: [note], width: 366 };
    const base = composeVisionBoard(input);
    const measured = Object.fromEntries(base.measurements.map(m => [m.key, 140]));
    const expanded = composeVisionBoard({ ...input, measured });
    expect(expanded.size.height).toBeGreaterThan(base.size.height);
    expect(expanded.notes[0].presentation.y * expanded.size.height).toBeGreaterThan(base.notes[0].presentation.y * base.size.height);
    expect(unprojectClassicNote(expanded.notes[0].presentation, expanded).y).toBeCloseTo(note.presentation.y);
    expect(note.presentation.y).toBe(.8);
  });
  it('restores layout-specific slot identities without changing canonical order or focal points', () => {
    const input = tiles(2);
    const result = composeVisionBoard({ tiles: input, width: 366, boardLayout: 'EDITORIAL', slotMap: ['p1', 'p0', null, null, null, null, null, null] });
    expect(result.slotMap.slice(0, 2)).toEqual(['p1', 'p0']);
    expect(input.map(p => p.sceneId)).toEqual(['p0', 'p1']);
  });

  it('limits row shifts on boards with notes to avoid excessive vertical space', () => {
    const fourTiles = tiles(4, 'A lovely caption here');
    const note1: VisionNote = {
      id: 'n1', visionId: 'v', content: { text: 'I am so grateful...' },
      presentation: { styleId: 'sticky_butter_yellow', x: 0.8, y: 0.65, width: 0.2, height: 0.12, rotation: 3, scale: 1, layerOrder: 2 },
      createdAt: '', updatedAt: '',
    };
    const note2: VisionNote = {
      id: 'n2', visionId: 'v', content: { text: 'I love my beautiful home' },
      presentation: { styleId: 'sticky_butter_yellow', x: 0.4, y: 0.75, width: 0.22, height: 0.14, rotation: -2, scale: 1, layerOrder: 3 },
      createdAt: '', updatedAt: '',
    };
    const result = composeVisionBoard({ tiles: fourTiles, notes: [note1, note2], width: 366, boardLayout: 'CLASSIC' });
    expect(result.shifts[2] - result.shifts[1]).toBeLessThanOrEqual(0.5);
    expect(result.ratio).toBeLessThan(3.0);
  });
});
