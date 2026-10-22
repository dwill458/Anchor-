import { clampCamera } from '../chartMapGeometry';
import { chartMapScreenTop } from '../ChartWeatherHold';
import { renderHook } from '@testing-library/react-native';
import type { ChartMapAnimState } from '../chartMapContracts';
import { useChartWeatherTransform, weatherTransformFor } from '../useChartMapCamera';

describe('full bleed camera frame', () => {
  // artTop = insetTop (47) + CHART_MAP_TOP (96).
  const frame = { mode: 'fullBleed' as const, artTop: 143 };
  it('places overview art at artTop and spans the width', () => {
    const c = clampCamera(426, 590, 1, 390, 844, frame);
    expect(c.tx).toBe(0);
    expect(c.ty).toBeCloseTo(143);
    expect(c.k * 852).toBe(390);
    expect(chartMapScreenTop(390, 844, 47, 34)).toBe(143);
  });
  it('clamps x, centres below scale one, and never clamps y', () => {
    expect(clampCamera(-900, -900, 1.5, 390, 844, frame).tx).toBe(0);
    expect(clampCamera(1900, 1900, 1.5, 390, 844, frame).tx).toBe(-195);
    expect(clampCamera(1900, -900, .96, 390, 844, frame).tx).toBeCloseTo(7.8);
    expect(clampCamera(426, -1900, 1, 390, 844, frame).ty).toBeGreaterThan(844);
    expect(clampCamera(426, 1900, 1, 390, 844, frame).ty).toBeLessThan(0);
  });
  it('keeps the default crop mapping', () => {
    const c = clampCamera(426, 590, 1, 390, 540);
    expect(c.tx).toBe(0);
    expect(c.ty).toBeCloseTo(0);
  });
  it('uses the full bleed overview transform in the live weather hook', () => {
    const anim = { camera: { cx: { value: 426 }, cy: { value: 590 }, s: { value: 1 } } } as ChartMapAnimState;
    const { result } = renderHook(() => useChartWeatherTransform(anim, 390, 844, frame));
    const w = weatherTransformFor(426, 590, 1, 390, 844, frame);
    expect(result.current.value).toEqual([{ translateX: w.tx }, { translateY: 143 }, { scale: w.scale }]);
  });
});
