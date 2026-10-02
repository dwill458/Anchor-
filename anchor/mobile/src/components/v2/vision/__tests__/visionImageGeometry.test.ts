import { fullscreenFit, visionImageFit } from '../visionImageGeometry';
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
  it('does not crop an upload by more than a small trim', () => {
    // A 4:3 landscape car photo into the ~0.85 hero aperture would lose a third of its width.
    expect(visionImageFit(4 / 3, 0.85, true)).toBe('contain');
    expect(visionImageFit(1.2, 1.12, true)).toBe('cover');
  });
  it('frames full-screen imagery deterministically: portraits fill, a landscape upload is kept whole', () => {
    const phone = { width: 393, height: 852 };
    expect(fullscreenFit({ width: 1024, height: 1820 }, phone, false)).toBe('cover');
    expect(fullscreenFit({ width: 4032, height: 3024 }, phone, true)).toBe('contain');
    expect(fullscreenFit({ width: 3024, height: 4032 }, phone, true)).toBe('cover');
    expect(fullscreenFit({ width: 4032, height: 3024 }, phone, false)).toBe('cover');
    expect(fullscreenFit({ width: 0, height: 0 }, phone, true)).toBe('cover');
  });
  it.each([360, 393])('protects hero dominance and an Anchor transition at %i dp', width => {
    for (const count of [2, 3, 6]) {
      const layout = selectBoardLayout(count);
      const scene = boardSizeForWidth(width, count);
      const hero = toSceneRect(layout.photos[0], scene);
      const anchor = toSceneRect(layout.card, scene);
      expect(hero.height).toBeGreaterThan(width * 0.7);
      expect(anchor.y).toBeLessThan(hero.y + hero.height);
      expect(anchor.y + anchor.height).toBeGreaterThan(hero.y + hero.height);
      for (const slot of layout.photos.slice(1)) {
        const support = toSceneRect(slot, scene);
        expect(hero.width * hero.height).toBeGreaterThan(support.width * support.height * 1.4);
        expect(support.y + support.height).toBeLessThan(scene.height - 44);
      }
    }
  });
});
