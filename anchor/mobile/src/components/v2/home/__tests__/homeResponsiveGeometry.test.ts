import { carouselGeometry } from '../V2HomeAnchorCarousel';
import { resolveHomeHeroLayout } from '../homeHeroLayout';

const VIEWPORTS: Array<[string, string, number, number, number, number]> = [
  ['small Android', 'android', 320, 568, 24, 0],
  ['small Android tall', 'android', 360, 780, 24, 24],
  ['iPhone SE', 'ios', 375, 667, 20, 0],
  ['iPhone 14', 'ios', 390, 844, 47, 34],
  ['iPhone 15 Pro', 'ios', 393, 852, 59, 34],
  ['Pixel/S24 class', 'android', 412, 915, 24, 24],
  ['iPhone Pro Max', 'ios', 430, 932, 59, 34],
];

describe.each(VIEWPORTS)('Home hero geometry on %s', (_name, platform, width, height, top, bottom) => {
  const layout = resolveHomeHeroLayout({ platform, width, height, topInset: top, bottomInset: bottom, selectedIndex: 0, intentions: ['I am free', 'B', 'C'] });
  const geometry = carouselGeometry(width, layout.anchorSize);

  it('centres the active Anchor exactly on the viewport centre', () => {
    expect(geometry.activeCenterX).toBe(width / 2);
    expect(geometry.slotCenterX(0)).toBe(width / 2);
  });

  it('exposes the left and right neighbours symmetrically', () => {
    expect(geometry.leftExposure).toBeCloseTo(geometry.rightExposure, 8);
    expect(geometry.slotCenterX(-1) + geometry.slotCenterX(1)).toBeCloseTo(width, 8);
  });

  it('shows a visible, but partial, sliver of each neighbour', () => {
    expect(geometry.leftExposure).toBeGreaterThan(8);
    expect(geometry.leftExposure).toBeLessThan(geometry.neighbourWidth * 0.5);
  });

  it('keeps the centre Anchor clear of its neighbours', () => {
    const activeHalf = (layout.anchorSize + 14) / 2;
    const neighbourInnerEdge = geometry.slotCenterX(1) - geometry.neighbourWidth / 2;
    expect(neighbourInnerEdge).toBeGreaterThan(width / 2 + activeHalf);
  });

  it('keeps the Anchor artwork inside its box and the box inside the track', () => {
    expect(layout.artworkBoxHeight).toBeGreaterThanOrEqual(layout.anchorSize + 14);
    expect(layout.trackHeight).toBeGreaterThan(layout.artworkBoxHeight);
  });
});

describe('Home hero on small viewports', () => {
  const intentions = ['I am free', 'I complete my most important work with focus', 'C'];

  it('gives artwork back on a short phone but never on a tuned device', () => {
    const tuned = resolveHomeHeroLayout({ platform: 'ios', width: 393, height: 852, topInset: 59, bottomInset: 34, selectedIndex: 0, intentions: ['I am free'] });
    const short = resolveHomeHeroLayout({ platform: 'android', width: 320, height: 568, topInset: 24, bottomInset: 0, selectedIndex: 0, intentions: ['I am free'] });
    expect(tuned.anchorSize).toBe(188);
    expect(short.anchorSize).toBeLessThan(tuned.anchorSize);
    expect(short.anchorSize).toBeGreaterThanOrEqual(120);
    expect(short.trackHeight).toBeLessThan(tuned.trackHeight);
  });

  it('holds the same height for a short, long and huge intention', () => {
    const base = { platform: 'ios', width: 360, height: 780, topInset: 24, bottomInset: 24, selectedIndex: 0 };
    const one = resolveHomeHeroLayout({ ...base, intentions: ['I am free'] });
    const long = resolveHomeHeroLayout({ ...base, intentions });
    const huge = resolveHomeHeroLayout({ ...base, intentions: ['word '.repeat(80).trim()] });
    expect(long.trackHeight).toBe(one.trackHeight);
    expect(huge.trackHeight).toBe(one.trackHeight);
  });
});
