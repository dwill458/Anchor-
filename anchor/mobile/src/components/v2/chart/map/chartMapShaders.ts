/**
 * Chart map SkSL (CHART_REDESIGN_PLAN.md section 3).
 *
 * TINT: one runtime effect, two modes, over the grayscale landscape master.
 *   mode 0 (faint): mix(paper, L, .28)            (prototype applyImage pencil layer)
 *   mode 1 (ink):   t = 1 - L; paper -> cat (t .5) -> cat * .5 (t 1)
 *
 * FOG: per-pixel port of the prototype's `renderFog` + canvas smoothing. The
 * fog field (nearest route sample distance + arc, and stipple noise) is
 * precomputed once (chartMapGeometry.buildFogField). For a map-space point the
 * shader evaluates the prototype's per-cell `out` at the 4 surrounding cell
 * centres (cell centre = idx * 4 + 2) and bilinearly mixes them, which equals
 * the prototype's 213 x 295 mask drawn with image smoothing. The shader output
 * is used as alpha with blendMode dstIn over the ink layer.
 *
 * UPLOAD FORMAT (this differs from packFogField's single RGBA image, on
 * purpose): SkSL samples premultiplied colour, so a texture whose alpha byte
 * carries data would be corrupted whenever A < 1. We therefore upload THREE
 * fully opaque (A = 255) RGBA8 images, all 213 x 295, FilterMode.Nearest:
 *   fieldDist: R = hi byte, G = lo byte of round(dist * 16)
 *   fieldArc:  R = hi byte, G = lo byte of round(arc  * 16)
 *   noise:     R = round(noise * 255)
 * `splitFogField` builds them from A's `packFogField` output (decode is the
 * documented one: dist = (R*256+G)/16, arc = (B*256+A)/16, noise = R/255).
 * All three are drawn with ImageShader rect = (0, 0, 852, 1180) so a map-space
 * eval(cell * 4 + 2) lands exactly on a texel centre.
 */
import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';
import { FOG_CELL, FOG_COLS, FOG_ROWS } from './chartMapContracts';

export const TINT_SKSL = `
uniform shader image;
uniform float3 paper;
uniform float3 cat;
uniform float mode;
half4 main(float2 xy) {
  half4 c = image.eval(xy);
  float L = dot(float3(c.rgb), float3(0.3, 0.59, 0.11));
  float3 rgb;
  if (mode < 0.5) {
    rgb = mix(paper, float3(L), 0.28);
  } else {
    float t = 1.0 - L;
    rgb = t < 0.5 ? mix(paper, cat, t / 0.5) : mix(cat, cat * 0.5, (t - 0.5) / 0.5);
  }
  return half4(half3(rgb), 1.0);
}`;

export const FOG_SKSL = `
uniform shader fieldDist;
uniform shader fieldArc;
uniform shader noiseTex;
uniform float revealArc;
uniform float fog;
uniform float2 tip;

float decode16(half4 c) {
  return (floor(float(c.r) * 255.0 + 0.5) * 256.0 + floor(float(c.g) * 255.0 + 0.5)) / 16.0;
}

float cellOut(float2 cell) {
  float2 centre = cell * 4.0 + 2.0;
  float dist = decode16(fieldDist.eval(centre));
  float arc = decode16(fieldArc.eval(centre));
  float fa = revealArc + 110.0;
  float d = arc <= fa ? dist : distance(centre, tip);
  float rIn = 105.0 + 1700.0 * fog;
  float fe = 95.0 + 300.0 * fog;
  float al = clamp(1.0 - (d - rIn) / fe, 0.0, 1.0);
  float n = float(noiseTex.eval(centre).r);
  return smoothstep(0.42, 0.58, al + (n - 0.5) * 0.7);
}

half4 main(float2 xy) {
  float2 g = xy / 4.0 - 0.5;
  float2 i0 = floor(g);
  float2 f = g - i0;
  float2 a = clamp(i0, float2(0.0), float2(212.0, 294.0));
  float2 b = clamp(i0 + 1.0, float2(0.0), float2(212.0, 294.0));
  float v00 = cellOut(a);
  float v10 = cellOut(float2(b.x, a.y));
  float v01 = cellOut(float2(a.x, b.y));
  float v11 = cellOut(b);
  float v = mix(mix(v00, v10, f.x), mix(v01, v11, f.x), f.y);
  return half4(half(v));
}`;

/**
 * CLOUDS: the dense illustrated fog over undiscovered ground. It reuses the FOG mask (inside the revealed
 * region v = 1) and paints soft billowing cloud with alpha (1 - v), so unexplored terrain is hidden and the
 * edge is the same stipple the ink reveal uses. Output is premultiplied. At arrival `fog` -> 1 makes v = 1
 * everywhere, so the clouds clear with no extra state.
 */
export const CLOUD_SKSL = `
uniform shader fieldDist;
uniform shader fieldArc;
uniform shader noiseTex;
uniform float revealArc;
uniform float fog;
uniform float2 tip;
uniform float3 paper;

float decode16(half4 c) {
  return (floor(float(c.r) * 255.0 + 0.5) * 256.0 + floor(float(c.g) * 255.0 + 0.5)) / 16.0;
}

float cellOut(float2 cell) {
  float2 centre = cell * 4.0 + 2.0;
  float dist = decode16(fieldDist.eval(centre));
  float arc = decode16(fieldArc.eval(centre));
  float fa = revealArc + 110.0;
  float d = arc <= fa ? dist : distance(centre, tip);
  float rIn = 105.0 + 1700.0 * fog;
  float fe = 95.0 + 300.0 * fog;
  float al = clamp(1.0 - (d - rIn) / fe, 0.0, 1.0);
  float n = float(noiseTex.eval(centre).r);
  return smoothstep(0.42, 0.58, al + (n - 0.5) * 0.7);
}

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), f.x),
             mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), f.x), f.y);
}

float fbm(float2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

half4 main(float2 xy) {
  float2 g = xy / 4.0 - 0.5;
  float2 i0 = floor(g);
  float2 f = g - i0;
  float2 a = clamp(i0, float2(0.0), float2(212.0, 294.0));
  float2 b = clamp(i0 + 1.0, float2(0.0), float2(212.0, 294.0));
  float v00 = cellOut(a);
  float v10 = cellOut(float2(b.x, a.y));
  float v01 = cellOut(float2(a.x, b.y));
  float v11 = cellOut(b);
  float v = mix(mix(v00, v10, f.x), mix(v01, v11, f.x), f.y);
  float cover = 1.0 - v;
  float billow = fbm(xy / 170.0);
  float wisp = fbm(xy / 55.0 + 9.0);
  float shade = smoothstep(0.28, 0.72, billow * 0.7 + wisp * 0.3);
  float alpha = cover * (0.78 + 0.18 * billow);
  float3 rgb = mix(paper * float3(0.86, 0.84, 0.81), paper * float3(1.02, 1.01, 0.99), shade);
  return half4(half3(rgb * alpha), half(alpha));
}`;

type RuntimeEffect = NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>;

/** Compile an SkSL source; null on failure (caller falls back, see ChartMapLand). */
export function makeEffect(src: string): RuntimeEffect | null {
  try {
    const effect = Skia.RuntimeEffect.Make(src);
    if (!effect && __DEV__) console.warn('[chart-map] SkSL failed to compile');
    return effect ?? null;
  } catch (error) {
    if (__DEV__) console.warn('[chart-map] SkSL compile threw', error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Fog texture upload                                                  */
/* ------------------------------------------------------------------ */

export type FogBytes = { fieldDist: Uint8Array; fieldArc: Uint8Array; noise: Uint8Array };

/** Split A's packed field (A-channel carries data) into three opaque RGBA8 buffers. */
export function splitFogField(fieldRGBA: Uint8Array, noiseRGBA: Uint8Array): FogBytes {
  const n = FOG_COLS * FOG_ROWS;
  const fieldDist = new Uint8Array(n * 4);
  const fieldArc = new Uint8Array(n * 4);
  const noise = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    fieldDist[o] = fieldRGBA[o];
    fieldDist[o + 1] = fieldRGBA[o + 1];
    fieldDist[o + 3] = 255;
    fieldArc[o] = fieldRGBA[o + 2];
    fieldArc[o + 1] = fieldRGBA[o + 3];
    fieldArc[o + 3] = 255;
    noise[o] = noiseRGBA[o];
    noise[o + 3] = 255;
  }
  return { fieldDist, fieldArc, noise };
}

/** Upload one opaque FOG_COLS x FOG_ROWS RGBA8 buffer. Null if Skia cannot build it. */
export function uploadFogImage(bytes: Uint8Array) {
  try {
    const data = Skia.Data.fromBytes(bytes);
    return Skia.Image.MakeImage(
      {
        width: FOG_COLS,
        height: FOG_ROWS,

        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Opaque,
      },
      data,
      FOG_COLS * 4,
    );
  } catch (error) {
    if (__DEV__) console.warn('[chart-map] fog image upload failed', error);
    return null;
  }
}

/** Design-space size the three fog images are stretched to (cell * 4 = map units). */
export const FOG_IMAGE_RECT = { x: 0, y: 0, width: FOG_COLS * FOG_CELL, height: FOG_ROWS * FOG_CELL };

/* ------------------------------------------------------------------ */
/* Worklet helpers (UI thread, allocation free)                        */
/* ------------------------------------------------------------------ */

function lerpIndex(arcs: ArrayLike<number>, count: number, arc: number): number {
  'worklet';
  const total = arcs[count - 1];
  const t = arc < 0 ? 0 : arc > total ? total : arc;
  let lo = 0;
  let hi = count - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (arcs[m] < t) lo = m;
    else hi = m;
  }
  return lo;
}

/** x of the route point at `arc` (same maths as chartMapGeometry.posAt). */
export function routeCoordAt(
  vals: ArrayLike<number>,
  arcs: ArrayLike<number>,
  count: number,
  arc: number,
): number {
  'worklet';
  const total = arcs[count - 1];
  const t = arc < 0 ? 0 : arc > total ? total : arc;
  const lo = lerpIndex(arcs, count, arc);
  const hi = lo + 1 < count ? lo + 1 : lo;
  const span = arcs[hi] - arcs[lo];
  const f = (t - arcs[lo]) / (span > 1e-6 ? span : 1e-6);
  return vals[lo] + (vals[hi] - vals[lo]) * f;
}

/** '#RRGGBB' -> [r, g, b] in 0..1 (SkSL float3 uniform). */
export function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0');
  return [parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255];
}

/** '#RRGGBB' + alpha -> 'rgba(r,g,b,a)'. */
export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToVec3(hex);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`;
}

/* ------------------------------------------------------------------ */
/* Rough brush centreline (stable hand-inked edge)                     */
/* ------------------------------------------------------------------ */

export type RoughRoute = {
  /** Polyline x/y at the same sample indices as the source RouteTable. */
  xs: Float32Array;
  ys: Float32Array;
  /** Cumulative polyline length at each sample (index-aligned with table.arcs). */
  cum: Float32Array;
  total: number;
  /** SVG polyline path data (single contour). */
  svgPath: string;
};

const ROUGH_AMPLITUDE = 1.6;
const ROUGH_WAVELENGTH = 22;

function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smoothed value noise in [-1, 1] along arc length (deterministic). */
function smoothNoise(s: number): number {
  const x = s / ROUGH_WAVELENGTH;
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash01(i) * (1 - u) + hash01(i + 1) * u) * 2 - 1;
}

/**
 * Offsets each route sample along its normal by seeded smooth noise (about
 * +-1.6 units), tapering to zero at both ends, and records cumulative polyline
 * length. Built once; trimmed at runtime with no path effect, so the drawn edge
 * never re-jitters.
 */
export function buildRoughRoute(table: {
  xs: ArrayLike<number>; ys: ArrayLike<number>; arcs: ArrayLike<number>; count: number; total: number;
}): RoughRoute {
  const n = table.count;
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const cum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    let tx = table.xs[b] - table.xs[a];
    let ty = table.ys[b] - table.ys[a];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const s = table.arcs[i];
    const taper = Math.min(1, s / 20, (table.total - s) / 20);
    const off = smoothNoise(s) * ROUGH_AMPLITUDE * Math.max(0, taper);
    xs[i] = table.xs[i] - ty * off;
    ys[i] = table.ys[i] + tx * off;
    if (i > 0) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  }
  let d = `M${xs[0].toFixed(2)},${ys[0].toFixed(2)}`;
  for (let i = 1; i < n; i++) d += ` L${xs[i].toFixed(2)},${ys[i].toFixed(2)}`;
  return { xs, ys, cum, total: cum[n - 1], svgPath: d };
}
