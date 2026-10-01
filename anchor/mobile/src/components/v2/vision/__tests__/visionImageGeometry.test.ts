import { visionImageFit } from '../visionImageGeometry';
import { boardSizeForWidth, selectBoardLayout, toSceneRect } from '../board/visionBoardLayouts';

describe('Vision source preservation', () => {
  it('keeps generated safe-framed portraits in their authored crop', () => {
    expect(visionImageFit(9 / 16, 1.12)).toBe('cover');
  });
  it('preserves arbitrary uploads when a crop would discard the subject', () => {
    expect(visionImageFit(3, 0.7, true)).toBe('contain');
    expect(visionImageFit(9 / 16, 1.12, true)).toBe('contain');
    expect(visionImageFit(1, 1.12, true)).toBe('cover');
  });
  it.each([360, 393])('protects hero dominance and an Anchor transition at %i dp', width => {
    for (const count of [2, 3, 6]) {
      const layout = selectBoardLayout(count);
      const scene = boardSizeForWidth(width, count);
      const hero = toSceneRect(layout.photos[0], scene);
      const anchor = toSceneRect(layout.card, scene);
      expect(hero.height).toBeGreaterThan(width * 0.85);
      expect(anchor.y).toBeLessThan(hero.y + hero.height);
      expect(anchor.y + anchor.height).toBeGreaterThan(hero.y + hero.height);
      for (const slot of layout.photos.slice(1)) {
        const support = toSceneRect(slot, scene);
        expect(hero.width * hero.height).toBeGreaterThan(support.width * support.height * 1.7);
        expect(support.y + support.height).toBeLessThan(scene.height - 44);
      }
    }
  });
});
