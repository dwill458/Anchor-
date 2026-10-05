import { photoMotionFrame, photoMotionPlan, subjectFocusFromPixels, ambientDarknessAt } from '../cinematicPhotoMotion';

describe('whole-photo continuous motion', () => {
  it.each([[1920, 1080], [1080, 1920], [600, 2400], [2400, 600]])('keeps every corner of %sx%s in view throughout', (width, height) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const plan = photoMotionPlan({ width, height }, viewport, { x: 0.8, y: 0.2 });
    for (let i = 0; i <= 100; i++) {
      const r = photoMotionFrame(plan, i / 100);
      expect(r.x).toBeGreaterThanOrEqual(-viewport.width / 2);
      expect(r.y).toBeGreaterThanOrEqual(-viewport.height / 2);
      expect(r.x + r.width).toBeLessThanOrEqual(viewport.width / 2);
      expect(r.y + r.height).toBeLessThanOrEqual(viewport.height / 2);
    }
    const a = photoMotionFrame(plan, 0), b = photoMotionFrame(plan, 0.5), c = photoMotionFrame(plan, 1);
    expect(b.x - a.x).toBeCloseTo(c.x - b.x);
    expect(b.y - a.y).toBeCloseTo(c.y - b.y);
    expect(a.width).toBe(c.width);
    expect(a.height).toBe(c.height);
    expect(width >= height ? Math.abs(c.x - a.x) : Math.abs(c.y - a.y)).toBeGreaterThan(15);
    }
  });
  it('drifts toward the content focus on the long axis without zooming', () => {
    const plan = photoMotionPlan({ width: 1800, height: 1000 }, { width: 390, height: 844 }, { x: 0.8, y: 0.5 });
    expect(photoMotionFrame(plan, 1).x).toBeLessThan(photoMotionFrame(plan, 0).x);
  });
  it('finds a contrasting subject region without claiming face recognition', () => {
    const pixels = new Uint8Array(16 * 16 * 4).fill(120);
    for (let y = 4; y < 12; y++) for (let x = 10; x < 14; x++) {
      const p = (y * 16 + x) * 4; pixels[p] = pixels[p + 1] = pixels[p + 2] = 255;
    }
    expect(subjectFocusFromPixels(pixels, 16, 16).x).toBeGreaterThan(0.6);
  });
});

it('darkens at start and only returns to light after the closing phrase, deterministically on resume', () => {
  expect(ambientDarknessAt(0, 190000)).toBe(0);
  expect(ambientDarknessAt(1000, 190000)).toBeCloseTo(0.5);
  expect(ambientDarknessAt(2000, 190000)).toBe(1);
  expect(ambientDarknessAt(189999, 190000)).toBe(1);
  expect(ambientDarknessAt(191000, 190000)).toBeCloseTo(0.5);
  expect(ambientDarknessAt(192000, 190000)).toBe(0);
});
