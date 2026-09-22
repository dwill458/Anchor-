import { clamp, heightClassFor, lerp, resolveV2Viewport, widthClassFor } from '../responsive';

/** Representative portrait viewports: [name, width, height, top inset, bottom inset]. */
export const VIEWPORTS = [
  ['small Android 320x568', 320, 568, 24, 0],
  ['small Android 360x640', 360, 640, 24, 0],
  ['compact iPhone SE 375x667', 375, 667, 20, 0],
  ['compact iPhone mini 375x812', 375, 812, 50, 34],
  ['standard iPhone 390x844', 390, 844, 47, 34],
  ['standard iPhone 393x852', 393, 852, 59, 34],
  ['tall Android 412x915', 412, 915, 24, 24],
  ['large iPhone 430x932', 430, 932, 59, 34],
] as const;

describe('responsive primitives', () => {
  it('clamps and interpolates within bounds', () => {
    expect(clamp(10, 5, 20)).toBe(10);
    expect(clamp(10, 25, 20)).toBe(20);
    expect(lerp(100, 200, 0.5)).toBe(150);
    expect(lerp(100, 200, 2)).toBe(200);
    expect(lerp(100, 200, -1)).toBe(100);
  });

  it('classifies width into the three supported classes', () => {
    expect([320, 360].map(widthClassFor)).toEqual(['compact', 'compact']);
    expect([375, 390, 393].map(widthClassFor)).toEqual(['standard', 'standard', 'standard']);
    expect([414, 430].map(widthClassFor)).toEqual(['large', 'large']);
  });

  it('classifies usable height', () => {
    expect(heightClassFor(548)).toBe('short');
    expect(heightClassFor(730)).toBe('regular');
    expect(heightClassFor(830)).toBe('tall');
  });

  it('keeps the approved 20pt gutter on standard and large phones and eases to 16 on the smallest', () => {
    const gutter = (width: number) => resolveV2Viewport({ width, height: 800 }).gutter;
    expect(gutter(320)).toBe(16);
    expect(gutter(360)).toBe(18);
    expect(gutter(393)).toBe(20);
    expect(gutter(430)).toBe(20);
  });

  it.each(VIEWPORTS)('resolves sane metrics on %s', (_name, width, height, top, bottom) => {
    const viewport = resolveV2Viewport({ width, height, topInset: top, bottomInset: bottom });
    expect(viewport.gutter).toBeGreaterThanOrEqual(16);
    expect(viewport.gutter).toBeLessThanOrEqual(20);
    expect(viewport.contentWidth).toBe(width - viewport.gutter * 2);
    expect(viewport.roominess).toBeGreaterThanOrEqual(0);
    expect(viewport.roominess).toBeLessThanOrEqual(1);
    expect(viewport.usableHeight).toBe(height - top - bottom);
    // Values interpolate between their endpoints and never leave them.
    const spaced = viewport.vertical(8, 20);
    expect(spaced).toBeGreaterThanOrEqual(8);
    expect(spaced).toBeLessThanOrEqual(20);
    expect(viewport.footerPaddingBottom).toBeGreaterThanOrEqual(16);
  });

  it('gives back vertical space monotonically as height shrinks', () => {
    const at = (height: number) => resolveV2Viewport({ width: 393, height }).vertical(4, 12);
    expect(at(500)).toBe(4);
    expect(at(900)).toBe(12);
    expect(at(700)).toBeGreaterThanOrEqual(at(650));
    expect(at(800)).toBeGreaterThanOrEqual(at(700));
  });

  it('caps content width on very wide windows', () => {
    expect(resolveV2Viewport({ width: 1024, height: 768 }).contentWidth).toBe(560);
  });
});
