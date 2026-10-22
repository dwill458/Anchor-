import { Skia } from '@shopify/react-native-skia';
import {
  CHART_INK_SOFT_EDGE,
  CHART_INK_TILT,
  chartContourStrength,
  chartInkReveal,
  chartInkStrength,
  getChartInkEffect,
  getChartSweepMaskEffect,
  INK_SKSL,
  resetChartInkEffectCache,
  SWEEP_MASK_SKSL,
} from '../chartInkShader';

describe('chart ink shader helpers', () => {
  it('mirrors shader sweep math and has exact endpoints across the tilted sweep domain', () => {
    expect(INK_SKSL).toContain('const float tilt = 0.14;');
    expect(INK_SKSL).toContain('const float soft = 0.06;');
    expect(CHART_INK_TILT).toBe(0.14);
    expect(CHART_INK_SOFT_EDGE).toBe(0.06);
    for (let i = 0; i <= 114; i++) {
      const s = i / 100;
      expect(chartInkReveal(0, s)).toBe(0);
      expect(chartInkReveal(1, s)).toBe(1);
    }
  });

  it('is monotonic in progress and non-increasing down the sweep', () => {
    for (let si = 0; si <= 114; si++) {
      const s = si / 100;
      let previous = chartInkReveal(0, s);
      for (let pi = 1; pi <= 100; pi++) {
        const next = chartInkReveal(pi / 100, s);
        expect(next).toBeGreaterThanOrEqual(previous);
        previous = next;
      }
    }
    for (let pi = 0; pi <= 100; pi++) {
      const p = pi / 100;
      let previous = chartInkReveal(p, 0);
      for (let si = 1; si <= 114; si++) {
        const next = chartInkReveal(p, si / 100);
        expect(next).toBeLessThanOrEqual(previous);
        previous = next;
      }
    }
  });

  it('matches luminance and contour constants used by INK_SKSL', () => {
    expect(chartInkStrength(0)).toBe(1);
    expect(chartInkStrength(1)).toBe(0);
    expect(chartInkStrength(0.9)).toBeCloseTo(0);
    expect(chartInkStrength(0.51)).toBeCloseTo(0.5);
    expect(chartContourStrength(0.42)).toBe(0);
    expect(chartContourStrength(1)).toBe(1);
  });

  it('is a contour-only pen accent: no tone layer, band between the contour and land sweeps', () => {
    expect(INK_SKSL).not.toContain('toneP');
    expect(INK_SKSL).not.toContain('landP;');
    expect(INK_SKSL).toContain('uniform float landSweepP;');
    expect(INK_SKSL).toContain('float band = max(0.0, reveal(contourP, s) - reveal(landSweepP, s));');
    expect(INK_SKSL).toContain('float a = contour * band * 0.9;');
  });

  it('sweep mask shares the reveal math and writes the reveal as alpha', () => {
    expect(SWEEP_MASK_SKSL).toContain('const float tilt = 0.14;');
    expect(SWEEP_MASK_SKSL).toContain('const float soft = 0.06;');
    expect(SWEEP_MASK_SKSL).toContain('float a = reveal(sweepP, s);');
    expect(SWEEP_MASK_SKSL).toContain('return half4(0.0, 0.0, 0.0, a);');
  });

  it('compiles the sweep mask once and caches a failed compile too', () => {
    const make = jest.spyOn(Skia.RuntimeEffect, 'Make').mockReturnValue({} as any);
    resetChartInkEffectCache();
    expect(getChartSweepMaskEffect()).toBeDefined();
    expect(getChartSweepMaskEffect()).toBeDefined();
    expect(make).toHaveBeenCalledWith(SWEEP_MASK_SKSL);
    expect(make.mock.calls.filter(([source]) => source === SWEEP_MASK_SKSL)).toHaveLength(1);

    make.mockReturnValue(null);
    resetChartInkEffectCache();
    expect(getChartSweepMaskEffect()).toBeNull();
    expect(getChartSweepMaskEffect()).toBeNull();
    expect(make.mock.calls.filter(([source]) => source === SWEEP_MASK_SKSL)).toHaveLength(2);
    make.mockRestore();
    resetChartInkEffectCache();
  });

  it('compiles once and caches a failed compile too', () => {
    const make = jest.spyOn(Skia.RuntimeEffect, 'Make').mockReturnValue({} as any);
    resetChartInkEffectCache();
    expect(getChartInkEffect()).toBeDefined();
    expect(getChartInkEffect()).toBeDefined();
    expect(make).toHaveBeenCalledTimes(1);
    expect(make).toHaveBeenCalledWith(INK_SKSL);

    make.mockReturnValue(null);
    resetChartInkEffectCache();
    expect(getChartInkEffect()).toBeNull();
    expect(getChartInkEffect()).toBeNull();
    expect(make).toHaveBeenCalledTimes(2);
    make.mockRestore();
    resetChartInkEffectCache();
  });
});
