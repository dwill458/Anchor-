import { selectBoardLayout, selectDetailBoardLayout, detailBoardSizeForWidth, toSceneRect, boardSizeForWidth, emptyBoardPlaceholderSlots } from '../visionBoardLayouts';

describe('editorial Vision Canvas geometry', () => {
  it.each([3, 4, 5, 6])('centres the Anchor on the entire %i-image collage', count => {
    const layout = selectDetailBoardLayout(count);
    const scene = detailBoardSizeForWidth(320, count);
    const rect = toSceneRect(layout.card, scene);
    expect(rect.x + rect.width / 2).toBeCloseTo(scene.width / 2);
    expect(rect.y + rect.height / 2).toBeCloseTo(scene.height / 2);
  });
  it.each([4, 5, 6])('shows every saved image in a %i-photo detail board', count => {
    const layout = selectDetailBoardLayout(count);
    expect(layout.photos).toHaveLength(count);
    const scene = detailBoardSizeForWidth(320, count);
    for (const slot of layout.photos) {
      const rect = toSceneRect(slot, scene);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThan(scene.height);
    }
    expect(selectBoardLayout(count).photos).toHaveLength(3); // protected cinematic overview
  });
  it.each([0, 1, 2, 3, 4, 6])('composes %i saved images without physical decorations', count => {
    const layout = selectBoardLayout(count);
    expect(layout.photos).toHaveLength(Math.min(count, 3));
    expect(layout.decor).toEqual([]);
    const scene = boardSizeForWidth(360, count);
    for (const slot of layout.photos) {
      const rect = toSceneRect(slot, scene);
      expect(rect.x).toBeGreaterThanOrEqual(-1);
      expect(rect.y).toBeGreaterThanOrEqual(-1);
      expect(rect.x + rect.width).toBeLessThanOrEqual(scene.width + 1);
      expect(rect.y + rect.height).toBeLessThanOrEqual(scene.height + 1);
    }
    if (count) expect(layout.photos[0].width).toBeGreaterThanOrEqual(0.95);
    if (count > 1) expect(layout.photos[0].width).toBeGreaterThan(layout.photos[1].width);
    expect(layout.card.width).toBeLessThanOrEqual(0.24);
  });
  it('keeps three large scenes for larger collections', () => {
    expect(selectBoardLayout(6).photos).toEqual(selectBoardLayout(3).photos);
  });
  it('has no imaginary slots in an empty Vision', () => {
    expect(emptyBoardPlaceholderSlots()).toEqual([]);
  });
});
