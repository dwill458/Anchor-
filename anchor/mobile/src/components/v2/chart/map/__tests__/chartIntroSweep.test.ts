import {
  CHART_INK_TILT,
  chartContourStrength,
  chartInkAccent,
  chartInkReveal,
  chartSweepMaskAlpha,
} from '../chartInkShader';

/** Sweep coordinates across the tilted domain the shader sees: s = y/h + tilt * x/w, in [0, 1 + tilt]. */
const SWEEP_COORDS = Array.from({ length: 121 }, (_, i) => (i / 120) * (1 + CHART_INK_TILT));
const PROGRESS_STEPS = Array.from({ length: 21 }, (_, i) => i / 20);

describe('chart intro land sweep mask', () => {
  it('is fully transparent before the sweep and fully opaque after it, across the whole domain', () => {
    for (const s of SWEEP_COORDS) {
      expect(chartSweepMaskAlpha(0, s)).toBe(0);
      expect(chartSweepMaskAlpha(1, s)).toBe(1);
    }
  });

  it('is the same math as the ink reveal, so the route and terrain share one edge', () => {
    for (const p of PROGRESS_STEPS) {
      for (const s of SWEEP_COORDS) {
        expect(chartSweepMaskAlpha(p, s)).toBe(chartInkReveal(p, s));
      }
    }
  });

  it('never decreases as the sweep advances', () => {
    for (const s of SWEEP_COORDS) {
      let previous = chartSweepMaskAlpha(0, s);
      for (const p of PROGRESS_STEPS) {
        const next = chartSweepMaskAlpha(p, s);
        expect(next).toBeGreaterThanOrEqual(previous - 1e-12);
        previous = next;
      }
    }
  });
});

describe('chart intro pen accent (contour band only)', () => {
  it('is zero when the land sweep has caught the contour sweep, at every coordinate', () => {
    for (const p of PROGRESS_STEPS) {
      for (const s of SWEEP_COORDS) {
        expect(chartInkAccent(p, p, s, 1)).toBeCloseTo(0, 12);
      }
    }
  });

  it('is zero at rest (nothing drawn) and when the settled map is complete', () => {
    for (const s of SWEEP_COORDS) {
      expect(chartInkAccent(0, 0, s, 1)).toBe(0);
      expect(chartInkAccent(1, 1, s, 1)).toBe(0);
    }
  });

  it('is nonzero only in the band the contour sweep has passed and the land sweep has not yet reached', () => {
    const contourP = 0.6;
    const landP = 0.35;
    for (const s of SWEEP_COORDS) {
      const band = chartInkReveal(contourP, s) - chartInkReveal(landP, s);
      const accent = chartInkAccent(contourP, landP, s, 1);
      if (band <= 0) {
        expect(accent).toBe(0);
      } else {
        expect(accent).toBeCloseTo(band * 0.9, 12);
      }
    }
  });

  it('is capped at 0.9 of the contour line strength and carries no tone', () => {
    for (const s of SWEEP_COORDS) {
      expect(chartInkAccent(1, 0, s, 1)).toBeLessThanOrEqual(0.9 + 1e-12);
    }
    // Tone was removed: a pale tone pixel (contour threshold not crossed) draws nothing.
    expect(chartInkAccent(1, 0, 0.5, 0.3)).toBe(0);
    expect(chartContourStrength(0.3)).toBe(0);
  });

  it('settled frame equals the base land: accent is zero and the mask is one for every coordinate', () => {
    for (const s of SWEEP_COORDS) {
      expect(chartInkAccent(1, 1, s, 1)).toBe(0);
      expect(chartSweepMaskAlpha(1, s)).toBe(1);
    }
  });
});
