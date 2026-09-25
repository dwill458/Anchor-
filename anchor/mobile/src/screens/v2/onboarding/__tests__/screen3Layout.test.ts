import { runnerHairLeft, solveScreen3Layout } from '../screen3Hero';

const DEVICES = {
  'iPhone 14 Pro': { width: 393, height: 852, insets: { top: 59, bottom: 34 } },
  'Galaxy S24': { width: 360, height: 780, insets: { top: 32, bottom: 24 } },
  'Pixel 8 Pro (tall)': { width: 412, height: 915, insets: { top: 40, bottom: 24 } },
  'iPhone SE (short)': { width: 375, height: 667, insets: { top: 20, bottom: 0 } },
} as const;

describe('Screen 3 composition', () => {
  it.each(Object.entries(DEVICES))('keeps the runner whole and the grid on screen on %s', (_name, device) => {
    const layout = solveScreen3Layout(device.width, device.height, device.insets);
    const { hero } = layout;
    // Her whole silhouette sits on screen, feet above the question.
    expect(hero.hairY).toBeGreaterThanOrEqual(0);
    expect(hero.shoeY).toBeLessThan(layout.headlineTop);
    // The plate always reaches the right edge (with bleed for the camera drift).
    expect(hero.left + hero.width).toBeGreaterThanOrEqual(device.width);
    // Synthetic foliage is bounded.
    expect(hero.extension).toBeLessThanOrEqual(device.width * (device.height / device.width < 2 ? 0.3 : 0.2) + 0.01);
    // Cards stay a sensible size.
    expect(layout.cardH).toBeGreaterThanOrEqual(device.height < 700 ? 72 : 84);
    expect(layout.cardH).toBeLessThanOrEqual(116);
  });

  it('keeps her head clear of the back button on the target phones', () => {
    for (const device of [DEVICES['iPhone 14 Pro'], DEVICES['Galaxy S24']]) {
      const layout = solveScreen3Layout(device.width, device.height, device.insets);
      const backButtonRight = 16 + 38;
      const headerBottom = device.insets.top + 48;
      const clearBeside = runnerHairLeft(layout) > backButtonRight + 4;
      const clearBelow = layout.hero.hairY > headerBottom;
      expect(clearBeside || clearBelow).toBe(true);
      // Hero occupies roughly the upper 43–48% of the screen.
      const share = layout.hero.shoeY / device.height;
      expect(share).toBeGreaterThan(0.42);
      expect(share).toBeLessThan(0.52);
    }
  });
});
