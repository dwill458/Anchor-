import { selectBoardLayout, toSceneRect, boardSizeForWidth, emptyBoardPlaceholderSlots } from '../visionBoardLayouts';

describe('editorial Vision Canvas geometry', () => {
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
