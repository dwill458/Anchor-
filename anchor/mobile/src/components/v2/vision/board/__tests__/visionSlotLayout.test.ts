import {
  BOARD_FRAME_ASPECT, selectDetailBoardLayout, selectSlotBoardLayout, slotBoardHeightRatio, slotBoardSizeForWidth, slotPrintBottomWidths, toSceneRect,
} from '../visionBoardLayouts';
import { VISION_SLOT_COUNT } from '../visionBoardSlots';

describe('slot layout', () => {
  it('has eight fixed positions, each at the same place on the sheet whatever the board height', () => {
    const tall = selectSlotBoardLayout(1.93), short = selectSlotBoardLayout(1.4);
    expect(tall.photos).toHaveLength(VISION_SLOT_COUNT);
    for (let slot = 0; slot < VISION_SLOT_COUNT; slot += 1) {
      const a = toSceneRect(tall.photos[slot], slotBoardSizeForWidth(374, 1.93)), b = toSceneRect(short.photos[slot], slotBoardSizeForWidth(374, 1.4));
      expect(a.x).toBeCloseTo(b.x, 5); expect(a.y).toBeCloseTo(b.y, 5); expect(a.width).toBeCloseTo(b.width, 5); expect(a.rotation).toBe(b.rotation);
    }
    const cardA = toSceneRect(tall.card, slotBoardSizeForWidth(374, 1.93)), cardB = toSceneRect(short.card, slotBoardSizeForWidth(374, 1.4));
    expect(cardA.y).toBeCloseTo(cardB.y, 5);
  });
  it('is the eight-photo composition, so a board of the first n photographs matches the old prefix family', () => {
    const eight = selectDetailBoardLayout(8), slots = selectSlotBoardLayout(1.93);
    eight.photos.forEach((photo, slot) => {
      expect(photo.x).toBeCloseTo(slots.photos[slot].x, 5); expect(photo.width).toBeCloseTo(slots.photos[slot].width, 5); expect(photo.frame).toBe(slots.photos[slot].frame);
      expect(photo.y * 1.93).toBeCloseTo(slots.photos[slot].y * 1.93, 5);
    });
  });
  it('grows to the lowest occupied position and to the whole board while arranging, never shrinking below the Anchor', () => {
    const empty = slotBoardHeightRatio(-1), one = slotBoardHeightRatio(0), three = slotBoardHeightRatio(2), eight = slotBoardHeightRatio(7), arranging = slotBoardHeightRatio(0, true);
    expect(one).toBeGreaterThanOrEqual(empty);                        // the Anchor sets the floor
    expect(slotBoardHeightRatio(3)).toBeGreaterThan(three);
    expect(eight).toBeGreaterThan(slotBoardHeightRatio(3));
    expect(arranging).toBe(eight); expect(arranging).toBeCloseTo(1.93, 1);
  });
  it('contains every occupied print and the Anchor, for every supported photo count and for nonconsecutive occupancy', () => {
    const occupancies: number[][] = [[], [0], [0, 1], [0, 1, 2], [0, 1, 2, 3], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5, 6, 7], [7], [3, 5], [1, 4, 6], [2, 7]];
    for (const occupied of occupancies) {
      const ratio = slotBoardHeightRatio(Math.max(-1, ...occupied)), layout = selectSlotBoardLayout(ratio), size = slotBoardSizeForWidth(100, ratio);
      for (const slot of occupied) {
        const rect = toSceneRect(layout.photos[slot], size);
        expect(rect.y + rect.height).toBeLessThanOrEqual(size.height); expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
      }
      const card = toSceneRect(layout.card, size); expect(card.y + card.height).toBeLessThanOrEqual(size.height);
    }
  });
  it('never places the Anchor over the hero, and no slot sits off the sheet', () => {
    const layout = selectSlotBoardLayout(1.93), size = slotBoardSizeForWidth(100, 1.93), hero = toSceneRect(layout.photos[0], size), card = toSceneRect(layout.card, size);
    expect(card.y).toBeGreaterThan(hero.y + hero.height);
    layout.photos.forEach((_, slot) => expect(slotPrintBottomWidths(slot)).toBeLessThan(1.93));
  });
  it('keeps tape on the slots the composition tapes, so a taped print stays taped wherever the others are', () => {
    expect(selectSlotBoardLayout(1.93).decor.map(tape => tape.photo)).toEqual([0, 1, 3, 6]);
    expect(BOARD_FRAME_ASPECT.landscape).toBeGreaterThan(1);
  });
});
