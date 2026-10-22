import {
  BOARD_FRAME_ASPECT, selectSlotBoardLayout, slotBoardHeightRatio, slotBoardSizeForWidth, slotPrintBottomWidths, toSceneRect,
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
  it('is the editorial collage: a dominant hero, large overlapping prints, and a fixed mix of treatments', () => {
    const layout = selectSlotBoardLayout(slotBoardHeightRatio(7, true)), size = slotBoardSizeForWidth(100, slotBoardHeightRatio(7, true));
    const [hero, ...rest] = layout.photos.map(slot => toSceneRect(slot, size));
    rest.forEach(rect => expect(hero.width * hero.height).toBeGreaterThan(rect.width * rect.height * 1.8));
    expect(hero.width).toBeGreaterThanOrEqual(90);                                   // the hero runs nearly edge to edge
    expect(layout.photos.map(slot => slot.treatment)).toEqual(['torn', 'torn', 'print', 'polaroid', 'torn', 'print', 'torn', 'polaroid']);
    // Neighbouring prints overlap rather than sit in a grid: slot 1 reaches up into the hero, and slot 3 into slot 1.
    expect(rest[0].y).toBeLessThan(hero.y + hero.height);
    expect(rest[2].y).toBeLessThan(rest[0].y + rest[0].height);
  });
  it('grows to the lowest occupied position and to the whole board while arranging, never shrinking below the Anchor', () => {
    const empty = slotBoardHeightRatio(-1), one = slotBoardHeightRatio(0), three = slotBoardHeightRatio(2), eight = slotBoardHeightRatio(7), arranging = slotBoardHeightRatio(0, true);
    expect(one).toBeGreaterThanOrEqual(empty);                        // the Anchor sets the floor
    expect(slotBoardHeightRatio(3)).toBeGreaterThan(three);
    expect(eight).toBeGreaterThan(slotBoardHeightRatio(3));
    expect(arranging).toBe(eight); expect(arranging).toBeCloseTo(2.6, 1);
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
    layout.photos.forEach((_, slot) => expect(slotPrintBottomWidths(slot)).toBeLessThan(slotBoardHeightRatio(7, true)));
  });
  it('keeps tape on the slots the composition tapes, so a taped print stays taped wherever the others are', () => {
    expect(selectSlotBoardLayout(1.93).decor.map(tape => tape.photo)).toEqual([3, 7]);
    expect(BOARD_FRAME_ASPECT.landscape).toBeGreaterThan(1);
  });
});
