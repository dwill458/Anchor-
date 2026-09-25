import { screen5CopyBottom, solveOutcomeHero, solveScreen5Layout, type Frame } from '../screen5Layout';

const DEVICES = {
  'iPhone 14 Pro': { width: 393, height: 852, insets: { top: 59, bottom: 34 } },
  'Galaxy S24': { width: 360, height: 780, insets: { top: 32, bottom: 24 } },
  'Pixel 8 Pro (tall)': { width: 412, height: 915, insets: { top: 40, bottom: 24 } },
  'iPhone SE (short)': { width: 375, height: 667, insets: { top: 20, bottom: 0 } },
} as const;

const right = (f: Frame) => f.x + f.width;
const bottom = (f: Frame) => f.y + f.height;
const centerX = (f: Frame) => f.x + f.width / 2;

describe('Screen 5 composition', () => {
  it.each(Object.entries(DEVICES))('fits above the CTA without clipping or overlap on %s', (_name, device) => {
    const layout = solveScreen5Layout(device.width, device.height, device.insets);
    const headerBottom = device.insets.top + 48;

    // Hero sits below the progress header and above the pill.
    expect(layout.hero.y).toBeGreaterThanOrEqual(headerBottom);
    expect(bottom(layout.hero)).toBeLessThan(layout.pillTop);
    // The copy and system never run into the CTA.
    expect(screen5CopyBottom(layout)).toBeLessThanOrEqual(layout.ctaTop - 12);
    expect(layout.ctaTop + 56 + layout.bottomPad).toBeCloseTo(device.height);

    // Every art piece stays on screen horizontally.
    for (const piece of [layout.see, layout.reinforce, layout.move]) {
      expect(piece.art.x).toBeGreaterThanOrEqual(0);
      expect(right(piece.art)).toBeLessThanOrEqual(device.width);
      // Art never drops into the shared label row.
      expect(bottom(piece.art)).toBeLessThan(layout.labelTop);
    }
    // MOVE's rise stays below the supporting line.
    expect(layout.move.art.y).toBeGreaterThan(layout.systemTop - 40);
  });

  it.each(Object.entries(DEVICES))('keeps SEE, REINFORCE and MOVE in their own regions on %s', (_name, device) => {
    const { see, reinforce, move } = solveScreen5Layout(device.width, device.height, device.insets);
    // No collisions: SEE ends before the Anchor, MOVE starts after it.
    expect(right(see.art)).toBeLessThan(reinforce.art.x);
    expect(move.art.x).toBeGreaterThan(right(reinforce.art));
    // REINFORCE is the hinge: centered on the middle third and circular.
    expect(centerX(reinforce.art)).toBeCloseTo(reinforce.column.x + reinforce.column.width / 2);
    expect(reinforce.art.width).toBe(reinforce.art.height);
    // Visual centers stay locked within their thirds.
    expect(centerX(see.art)).toBeGreaterThan(0);
    expect(centerX(see.art)).toBeLessThan(see.column.x + see.column.width);
    expect(centerX(move.art)).toBeGreaterThan(move.column.x);
    expect(centerX(move.art)).toBeLessThan(move.column.x + move.column.width);
  });

  it.each(Object.entries(DEVICES))('gives the three pieces different silhouettes but balanced weight on %s', (_name, device) => {
    const { see, reinforce, move } = solveScreen5Layout(device.width, device.height, device.insets);
    // SEE wider than tall, MOVE taller than the Anchor.
    expect(see.art.width).toBeGreaterThan(see.art.height);
    expect(move.art.height).toBeGreaterThan(reinforce.art.height);
    expect(move.art.height).toBeGreaterThan(see.art.height);
    // Perceived weight (area) within a sensible band of the Anchor's.
    const anchorArea = reinforce.art.width * reinforce.art.height;
    for (const piece of [see, move]) {
      const ratio = (piece.art.width * piece.art.height) / anchorArea;
      expect(ratio).toBeGreaterThan(0.75);
      expect(ratio).toBeLessThan(1.7);
    }
  });

  it('shrinks the category artwork from its Screen 4 size', () => {
    for (const device of Object.values(DEVICES)) {
      const s4 = solveOutcomeHero(device.width, device.height, device.insets);
      const s5 = solveScreen5Layout(device.width, device.height, device.insets);
      expect(s5.hero.height).toBeLessThan(s4.height);
      // Same horizontal center: the artwork travels up, never sideways.
      expect(centerX(s5.hero)).toBeCloseTo(centerX(s4));
      // It moves upward (or holds) — never down.
      expect(s5.hero.y).toBeLessThanOrEqual(s4.y);
    }
  });

  it('concedes gaps before artwork on the target phones', () => {
    const iphone = solveScreen5Layout(393, 852, { top: 59, bottom: 34 });
    const s24 = solveScreen5Layout(360, 780, { top: 32, bottom: 24 });
    expect(iphone.headline.fontSize).toBe(30);
    expect(s24.headline.fontSize).toBe(30);
    expect(iphone.hero.height).toBeGreaterThanOrEqual(150);
    expect(s24.hero.height).toBeGreaterThanOrEqual(130);
  });
});
