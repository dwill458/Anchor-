import { Skia } from '@shopify/react-native-skia';

/**
 * Pen accent for the intro: contour strokes only, visible in the band the contour sweep has passed and the land
 * sweep has not yet reached. The real land (ChartMapLand) fills in behind it, so there is one picture and no tone
 * layer to swap in at the end.
 */
export const INK_SKSL = `
uniform shader land;
uniform float2 size;
uniform float contourP;
uniform float landSweepP;
uniform half3 inkColor;

const float tilt = 0.14;
const float soft = 0.06;

float reveal(float p, float s) {
  float edge = p * (1.0 + tilt + soft) - soft;
  return 1.0 - smoothstep(edge, edge + soft, s);
}

half4 main(float2 xy) {
  half4 c = land.eval(xy);
  float lum = dot(float3(c.rgb), float3(0.299, 0.587, 0.114));
  float ink = clamp((1.0 - lum - 0.10) / 0.78, 0.0, 1.0);
  float contour = clamp((ink - 0.42) * 2.4, 0.0, 1.0);
  float s = xy.y / size.y + (xy.x / size.x) * tilt;
  float band = max(0.0, reveal(contourP, s) - reveal(landSweepP, s));
  float a = contour * band * 0.9;
  return half4(inkColor * a, a);
}`;

/**
 * Sweep mask: alpha is the same tilted, soft-edged reveal as the pen. Used with dstIn, so the land layer and the
 * survey route only show where the sweep has passed. At progress 1 the mask is opaque everywhere.
 */
export const SWEEP_MASK_SKSL = `
uniform float2 size;
uniform float sweepP;

const float tilt = 0.14;
const float soft = 0.06;

float reveal(float p, float s) {
  float edge = p * (1.0 + tilt + soft) - soft;
  return 1.0 - smoothstep(edge, edge + soft, s);
}

half4 main(float2 xy) {
  float s = xy.y / size.y + (xy.x / size.x) * tilt;
  float a = reveal(sweepP, s);
  return half4(0.0, 0.0, 0.0, a);
}`;

export type ChartInkRuntimeEffect = NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>;

let inkEffectCache: ChartInkRuntimeEffect | null | undefined;
let sweepMaskEffectCache: ChartInkRuntimeEffect | null | undefined;

/** Compile the intro pen shader once per session. Null lets the host retain the static map fallback. */
export function getChartInkEffect(): ChartInkRuntimeEffect | null {
  if (inkEffectCache !== undefined) return inkEffectCache;
  try {
    inkEffectCache = Skia.RuntimeEffect.Make(INK_SKSL) ?? null;
    if (!inkEffectCache && __DEV__) console.warn('[chart-map] ink SkSL failed to compile');
  } catch (error) {
    inkEffectCache = null;
    if (__DEV__) console.warn('[chart-map] ink SkSL compile threw', error);
  }
  return inkEffectCache;
}

/** Compile the sweep mask once per session. Null means the host falls back to a plain opacity crossfade. */
export function getChartSweepMaskEffect(): ChartInkRuntimeEffect | null {
  if (sweepMaskEffectCache !== undefined) return sweepMaskEffectCache;
  try {
    sweepMaskEffectCache = Skia.RuntimeEffect.Make(SWEEP_MASK_SKSL) ?? null;
    if (!sweepMaskEffectCache && __DEV__) console.warn('[chart-map] sweep mask SkSL failed to compile');
  } catch (error) {
    sweepMaskEffectCache = null;
    if (__DEV__) console.warn('[chart-map] sweep mask SkSL compile threw', error);
  }
  return sweepMaskEffectCache;
}

/** Test helper: allow the compile-once path to be exercised independently. */
export function resetChartInkEffectCache(): void {
  inkEffectCache = undefined;
  sweepMaskEffectCache = undefined;
}

export const CHART_INK_TILT = 0.14;
export const CHART_INK_SOFT_EDGE = 0.06;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Pure TypeScript mirror of the shader's tilted top-to-bottom sweep. */
export function chartInkReveal(progress: number, sweepCoordinate: number): number {
  const p = clamp01(progress);
  const edge = p * (1 + CHART_INK_TILT + CHART_INK_SOFT_EDGE) - CHART_INK_SOFT_EDGE;
  return 1 - smoothstep(edge, edge + CHART_INK_SOFT_EDGE, sweepCoordinate);
}

/** Pure TypeScript mirror of the shader's luminance-to-ink conversion. */
export function chartInkStrength(luminance: number): number {
  return clamp01((1 - luminance - 0.1) / 0.78);
}

/** Pure TypeScript mirror of the dark-contour threshold. */
export function chartContourStrength(ink: number): number {
  return clamp01((ink - 0.42) * 2.4);
}

/** Pure TypeScript mirror of the land/route sweep mask (alpha written by SWEEP_MASK_SKSL). */
export function chartSweepMaskAlpha(progress: number, sweepCoordinate: number): number {
  return chartInkReveal(progress, sweepCoordinate);
}

/** Pure TypeScript mirror of the pen accent: contour strength inside the contour-minus-land band, capped at 0.9. */
export function chartInkAccent(contourP: number, landSweepP: number, sweepCoordinate: number, ink: number): number {
  const band = Math.max(0, chartInkReveal(contourP, sweepCoordinate) - chartInkReveal(landSweepP, sweepCoordinate));
  return chartContourStrength(ink) * band * 0.9;
}
