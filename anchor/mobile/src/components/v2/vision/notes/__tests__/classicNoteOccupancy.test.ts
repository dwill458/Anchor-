import type { V2VisionTile, VisionNote } from '@/adapters/v2/vision';
import { classicVisionNoteOccupancy } from '../classicNoteOccupancy';
import { nextVisionNotePresentation, visionBoardAspectForCount, type VisionNoteOccupiedRect } from '../visionNotePlacement';

const tile = (i: number): V2VisionTile => ({ sceneId: `sc-${i}`, imageUrl: `https://example.com/${i}.jpg`, sourceType: 'AI_GENERATED', sortOrder: i } as V2VisionTile);

/** Share of the note's area that sits on a rect. */
function covered(p: { x: number; y: number; width: number; height: number; scale: number }, rect: VisionNoteOccupiedRect) {
  const w = p.width * p.scale, h = p.height * p.scale;
  const ix = Math.max(0, Math.min(p.x + w / 2, rect.x + rect.width / 2) - Math.max(p.x - w / 2, rect.x - rect.width / 2));
  const iy = Math.max(0, Math.min(p.y + h / 2, rect.y + rect.height / 2) - Math.max(p.y - h / 2, rect.y - rect.height / 2));
  return (ix * iy) / (w * h);
}

function boardWith(slots: number[]) {
  const tiles = slots.map(tile);
  const slotMap: (string | null)[] = Array(8).fill(null);
  slots.forEach((slot, i) => { slotMap[slot] = tiles[i].sceneId; });
  return { tiles, slotMap };
}

function place(slots: number[], notes: VisionNote[] = []) {
  const { tiles, slotMap } = boardWith(slots);
  const rects = classicVisionNoteOccupancy(tiles, notes, slotMap);
  const p = nextVisionNotePresentation('sticky_blush_pink', notes, rects, visionBoardAspectForCount(tiles.length), { wholePrints: true });
  return { p, rects };
}

describe('Classic note placement', () => {
  it('lists every occupied print, hero first, and the Anchor last', () => {
    const { tiles, slotMap } = boardWith([0, 1, 2, 4]);
    const rects = classicVisionNoteOccupancy(tiles, [], slotMap);
    expect(rects).toHaveLength(5);
    // The hero spans nearly the whole board width and sits at the top.
    expect(rects[0].width).toBeGreaterThan(0.9);
    expect(rects[0].y).toBeLessThan(rects[1].y);
  });

  it.each([[[0]], [[0, 1]], [[0, 1, 2]], [[0, 1, 2, 4]], [[0, 1, 2, 3, 4]], [[1, 2]]])(
    'keeps a new note off the hero and off the middle of every print for slots %j', slots => {
      const { p, rects } = place(slots);
      if (slots.includes(0)) expect(covered(p, rects[0])).toBeLessThan(0.05);
      // A small board can be all print inside a note's envelope; then the note may only take a print's edge or corner.
      for (const rect of rects) {
        expect(covered(p, rect)).toBeLessThan(0.5);
        expect(covered(p, { ...rect, width: rect.width * 0.6, height: rect.height * 0.6 })).toBeLessThan(0.15);
      }
    });

  it('uses the open slot on a board like Regal (hero, second row, lower right)', () => {
    const { p, rects } = place([0, 1, 2, 4]);
    const onPrints = rects.reduce((sum, rect) => sum + covered(p, rect), 0);
    expect(onPrints).toBeLessThan(0.35);
  });

  it('puts a second note somewhere else', () => {
    const first = place([0, 1, 2, 4]).p;
    const note = { id: 'n1', isArchived: false, content: { text: 'Keys in hand' }, presentation: first } as unknown as VisionNote;
    const second = place([0, 1, 2, 4], [note]).p;
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThan(0.15);
  });
});
