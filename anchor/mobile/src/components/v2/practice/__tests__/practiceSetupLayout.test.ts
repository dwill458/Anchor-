import { resolveV2Viewport } from '@/theme/v2/responsive';
import { resolvePracticeSetupMetrics, SETUP_CONTROL_MIN_HEIGHT } from '../practiceSetupLayout';

const viewport = (width: number, height: number, top = 0, bottom = 0) => resolveV2Viewport({ width, height, topInset: top, bottomInset: bottom });

describe('Practice setup metrics', () => {
  it('keeps the approved Focus design values on a tall standard phone', () => {
    const m = resolvePracticeSetupMetrics(viewport(393, 852, 47, 0), 'focus');
    expect(m.artworkSize).toBe(186);
    expect(m.haloSize).toBe(218);
    expect(m.sidePadding).toBe(40);
    expect(m.artworkGap).toBe(12);
  });

  it('shrinks artwork within a controlled range on a short compact phone, never below the floor', () => {
    const m = resolvePracticeSetupMetrics(viewport(320, 568, 24, 0), 'focus');
    expect(m.artworkSize).toBeGreaterThanOrEqual(148);
    expect(m.artworkSize).toBeLessThan(186);
    expect(m.sidePadding).toBeLessThan(40);
    expect(m.sidePadding).toBeGreaterThanOrEqual(24);
  });

  it.each([
    [320, 568, 24, 0],
    [360, 640, 24, 0],
    [375, 667, 20, 0],
    [393, 852, 59, 34],
    [430, 932, 59, 34],
  ])('leaves the setup body room for three duration chips at %sx%s', (w, h, top, bottom) => {
    const m = resolvePracticeSetupMetrics(viewport(w, h, top, bottom), 'focus');
    const bodyWidth = w - m.sidePadding * 2;
    const chip = (bodyWidth - 16) / 3;
    expect(chip).toBeGreaterThanOrEqual(72);
    expect(SETUP_CONTROL_MIN_HEIGHT).toBeGreaterThanOrEqual(44);
    // Artwork always fits its container.
    expect(m.artworkSize).toBeLessThanOrEqual(bodyWidth);
  });

  it('applies the same architecture to the larger Deep Prime / Visualize hero', () => {
    const tall = resolvePracticeSetupMetrics(viewport(393, 900, 47, 0), 'hero');
    const short = resolvePracticeSetupMetrics(viewport(360, 640, 24, 0), 'hero');
    expect(tall.artworkSize).toBeLessThanOrEqual(266);
    expect(short.artworkSize).toBeLessThan(tall.artworkSize);
    expect(short.artworkSize).toBeGreaterThanOrEqual(188 * 0.9);
  });
});
