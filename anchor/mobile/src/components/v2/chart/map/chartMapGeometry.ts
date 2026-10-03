/**
 * Chart map geometry: a straight port of the prototype's route maths.
 * Pure, no React. Helpers tagged 'worklet' may run on the UI thread.
 *
 * WORKLET GUIDANCE (map layer): on the UI thread use `posAtInto` (writes into
 * a caller-owned `{x, y}`, no allocation) with the table's typed arrays
 * (`table.xs`, `table.ys`, `table.arcs`, `table.count`). `posAt(table, arc)`
 * is the JS-thread convenience that allocates a new point.
 */
import { FOG_FIELD_DATA } from './chartFogFieldData';
import {
  FOG_ARRIVAL_FEATHER,
  FOG_ARRIVAL_R_IN,
  FOG_CELL,
  FOG_COLS,
  FOG_FEATHER,
  FOG_LEAD,
  FOG_R_IN,
  FOG_ROWS,
  type FogField,
  type MapPoint,
  type RouteLeg,
  type RouteTable,
  type WaypointPlacement,
} from './chartMapContracts';

/** Prototype PTS: route vertices in map space. PTS[0] = start, PTS[6] = summit. */
export const ROUTE_PTS: ReadonlyArray<readonly [number, number]> = [
  [70, 992],
  [233, 790],
  [385, 606],
  [516, 490],
  // DEFERRED: [629, 380], [713, 292], [734, 190] placed the summit in the header zone.
  [575, 430],
  [625, 400],
  [660, 370],
];

export const OVERVIEW_CAMERA = { cx: 426, cy: 590, s: 1 } as const;

/** Sample spacing along the route (prototype: ~6 units). */
const SAMPLE_SPACING = 6;
/** Bezier arc-length table resolution per leg. */
const ARC_STEPS = 48;

const fmtNum = (n: number): string => String(Math.round(n * 100) / 100);

/* ------------------------------------------------------------------ */
/* Route table                                                         */
/* ------------------------------------------------------------------ */

let routeTableCache: RouteTable | null = null;

export function buildRouteTable(): RouteTable {
  if (routeTableCache) return routeTableCache;
  const legs: RouteLeg[] = [];
  const sx: number[] = [];
  const sy: number[] = [];
  const sa: number[] = [];
  let total = 0;
  let svgPath = '';

  for (let i = 0; i < ROUTE_PTS.length - 1; i++) {
    const a = ROUTE_PTS[i];
    const b = ROUTE_PTS[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    const nx = -dy / L;
    const ny = dx / L;
    const off = (i % 2 ? -1 : 1) * Math.min(34, L * 0.16);
    const c1x = a[0] + dx * 0.33 + nx * off;
    const c1y = a[1] + dy * 0.33 + ny * off;
    const c2x = a[0] + dx * 0.67 - nx * off * 0.7;
    const c2y = a[1] + dy * 0.67 - ny * off * 0.7;
    const bez = (t: number): [number, number] => {
      const u = 1 - t;
      return [
        u * u * u * a[0] + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * b[0],
        u * u * u * a[1] + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * b[1],
      ];
    };
    // 48-step arc table (t, cumulative length).
    let len = 0;
    let prev = bez(0);
    const tabT: number[] = [0];
    const tabL: number[] = [0];
    for (let k = 1; k <= ARC_STEPS; k++) {
      const p = bez(k / ARC_STEPS);
      len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      tabT.push(k / ARC_STEPS);
      tabL.push(len);
      prev = p;
    }
    const n = Math.ceil(len / SAMPLE_SPACING);
    for (let k = 0; k <= n; k++) {
      const arcL = (len * k) / n;
      let j = 1;
      while (j < tabL.length - 1 && tabL[j] < arcL) j++;
      const f = (arcL - tabL[j - 1]) / Math.max(1e-6, tabL[j] - tabL[j - 1]);
      const p = bez(tabT[j - 1] + (tabT[j] - tabT[j - 1]) * f);
      sx.push(p[0]);
      sy.push(p[1]);
      sa.push(total + arcL);
    }
    legs.push({
      a: { x: a[0], y: a[1] },
      c1: { x: c1x, y: c1y },
      c2: { x: c2x, y: c2y },
      b: { x: b[0], y: b[1] },
      start: total,
      len,
    });
    if (i === 0) svgPath += `M${fmtNum(a[0])},${fmtNum(a[1])}`;
    svgPath += ` C${fmtNum(c1x)},${fmtNum(c1y)} ${fmtNum(c2x)},${fmtNum(c2y)} ${fmtNum(b[0])},${fmtNum(b[1])}`;
    total += len;
  }

  routeTableCache = {
    xs: Float32Array.from(sx),
    ys: Float32Array.from(sy),
    arcs: Float32Array.from(sa),
    count: sx.length,
    total,
    legs,
    svgPath,
  };
  return routeTableCache;
}

/**
 * Point at arc length, binary search over the sample table. Writes into `out`
 * and returns it; allocation free, safe on the UI thread.
 */
export function posAtInto(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  arcs: ArrayLike<number>,
  count: number,
  arc: number,
  out: { x: number; y: number }
): { x: number; y: number } {
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
  const span = arcs[hi] - arcs[lo];
  const f = (t - arcs[lo]) / (span > 1e-6 ? span : 1e-6);
  out.x = xs[lo] + (xs[hi] - xs[lo]) * f;
  out.y = ys[lo] + (ys[hi] - ys[lo]) * f;
  return out;
}

/** JS-thread convenience: allocates a new point. Use `posAtInto` in worklets. */
export function posAt(table: RouteTable, arc: number): MapPoint {
  return posAtInto(table.xs, table.ys, table.arcs, table.count, arc, { x: 0, y: 0 });
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */

const placementCache = new Map<number, WaypointPlacement>();

export function waypointPlacement(n: number): WaypointPlacement {
  const count = Math.min(12, Math.max(1, Number.isFinite(n) ? Math.floor(n) : 1));
  const cached = placementCache.get(count);
  if (cached) return cached;
  const table = buildRouteTable();
  const arcs: number[] = [];
  for (let k = 0; k < count; k++) arcs.push(((k + 1) / (count + 1)) * table.total);
  const placement: WaypointPlacement = {
    n: count,
    arcs,
    points: arcs.map((arc) => posAt(table, arc)),
    summit: posAt(table, table.total),
    start: posAt(table, 0),
    legs: arcs.map((end, i) => ({ start: i === 0 ? 0 : arcs[i - 1], end })),
    markerRadius: count > 7 ? 24 : 30,
  };
  placementCache.set(count, placement);
  return placement;
}

/* ------------------------------------------------------------------ */
/* Fog                                                                 */
/* ------------------------------------------------------------------ */

const hash1 = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Prototype v2: smoothed 2D value noise. */
const v2 = (x: number, y: number, s: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const h = (a: number, b: number) => hash1(a * 57 + b * 131 + s * 7);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
};

let fogCache: { table: RouteTable; field: FogField } | null = null;

/** Bucket size (map units) of the nearest-sample acceleration grid. */
const FOG_BUCKET = 128;

/**
 * Runtime fallback build (not memoised): nearest-sample search over a coarse
 * bucket grid (expanding rings, ties to the lowest sample index, results
 * identical to brute force). Honest note: the route has only ~200 samples, so
 * brute force is already cheap; the grid helps little, and the stipple noise
 * (about nine `sin` evaluations per cell) dominates the cost. This is why the
 * app normally decodes precomputed data instead (see `buildFogField`). Kept for
 * tests and as the fallback when the generated data is stale.
 */
export function buildFogFieldGrid(table: RouteTable): FogField {
  const cols = FOG_COLS;
  const rows = FOG_ROWS;
  const dist = new Float32Array(cols * rows);
  const arc = new Float32Array(cols * rows);
  const noise = new Float32Array(cols * rows);
  const { xs, ys, arcs, count } = table;
  const half = FOG_CELL / 2;

  const gw = Math.ceil((cols * FOG_CELL) / FOG_BUCKET);
  const gh = Math.ceil((rows * FOG_CELL) / FOG_BUCKET);
  // CSR layout: items of bucket b are items[start[b] .. start[b + 1]), in ascending sample index.
  const bucketOf = new Int32Array(count);
  const start = new Int32Array(gw * gh + 1);
  for (let k = 0; k < count; k++) {
    const bx = Math.min(gw - 1, Math.max(0, Math.floor(xs[k] / FOG_BUCKET)));
    const by = Math.min(gh - 1, Math.max(0, Math.floor(ys[k] / FOG_BUCKET)));
    bucketOf[k] = by * gw + bx;
    start[bucketOf[k] + 1]++;
  }
  for (let b = 0; b < gw * gh; b++) start[b + 1] += start[b];
  const fillAt = start.slice(0, gw * gh);
  const items = new Int32Array(count);
  for (let k = 0; k < count; k++) items[fillAt[bucketOf[k]]++] = k;
  const maxRing = Math.max(gw, gh);

  for (let my = 0; my < rows; my++) {
    const y = my * FOG_CELL + half;
    const by0 = Math.floor(y / FOG_BUCKET);
    for (let mx = 0; mx < cols; mx++) {
      const x = mx * FOG_CELL + half;
      const bx0 = Math.floor(x / FOG_BUCKET);
      let best = 1e12;
      let bestK = -1;
      for (let r = 0; r <= maxRing; r++) {
        const y0 = by0 - r;
        const y1 = by0 + r;
        const x0 = bx0 - r;
        const x1 = bx0 + r;
        const ya = y0 < 0 ? 0 : y0;
        const yb = y1 >= gh ? gh - 1 : y1;
        for (let by = ya; by <= yb; by++) {
          // Top/bottom rows of the ring scan every bucket; middle rows only the two ends.
          const stepX = by === y0 || by === y1 || r === 0 ? 1 : x1 - x0;
          for (let bx = x0; bx <= x1; bx += stepX) {
            if (bx < 0 || bx >= gw) continue;
            const b = by * gw + bx;
            for (let n = start[b], e = start[b + 1]; n < e; n++) {
              const k = items[n];
              const dx = xs[k] - x;
              const dy = ys[k] - y;
              const d = dx * dx + dy * dy;
              if (d < best || (d === best && k < bestK)) {
                best = d;
                bestK = k;
              }
            }
          }
        }
        // Everything unscanned lies at least r * bucket away.
        const reach = r * FOG_BUCKET;
        if (bestK >= 0 && best < reach * reach) break;
      }
      const i = my * cols + mx;
      dist[i] = Math.sqrt(best);
      arc[i] = arcs[bestK];
      noise[i] = 0.5 * v2(mx * 0.12, my * 0.12, 3) + 0.25 * v2(mx * 0.35, my * 0.35, 5) + 0.25 * hash1(mx * 13 + my * 77);
    }
  }
  return { cols, rows, dist, arc, noise };
}

/**
 * Reference implementation (the original prototype precompute: brute-force
 * nearest search). Not memoised; used by tests to prove the accelerated build
 * is identical and to compare timings.
 */
export function buildFogFieldBruteForce(table: RouteTable): FogField {
  const cols = FOG_COLS;
  const rows = FOG_ROWS;
  const dist = new Float32Array(cols * rows);
  const arc = new Float32Array(cols * rows);
  const noise = new Float32Array(cols * rows);
  const { xs, ys, arcs, count } = table;
  const half = FOG_CELL / 2;
  for (let my = 0; my < rows; my++) {
    const y = my * FOG_CELL + half;
    for (let mx = 0; mx < cols; mx++) {
      const x = mx * FOG_CELL + half;
      let best = 1e12;
      let bestArc = 0;
      for (let k = 0; k < count; k++) {
        const dx = xs[k] - x;
        const dy = ys[k] - y;
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          bestArc = arcs[k];
        }
      }
      const i = my * cols + mx;
      dist[i] = Math.sqrt(best);
      arc[i] = bestArc;
      noise[i] = 0.5 * v2(mx * 0.12, my * 0.12, 3) + 0.25 * v2(mx * 0.35, my * 0.35, 5) + 0.25 * hash1(mx * 13 + my * 77);
    }
  }
  return { cols, rows, dist, arc, noise };
}

/** Everything the generated fog data depends on. MUST match scripts/generate-chart-fog-field.mjs. */
export function fogRouteHashInput(): string {
  return `fog-v1|${JSON.stringify(ROUTE_PTS)}|cell=${FOG_CELL}|cols=${FOG_COLS}|rows=${FOG_ROWS}|spacing=${SAMPLE_SPACING}|steps=${ARC_STEPS}`;
}

/** FNV-1a (32-bit) hex of the route constants; compared with the generated data's hash. */
export function fogRouteHash(): string {
  const str = fogRouteHashInput();
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const B64 = (() => {
  const t = new Uint8Array(128);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < 64; i++) t[chars.charCodeAt(i)] = i;
  return t;
})();

/** Base64 to bytes with a lookup table (no atob dependency). */
export function decodeBase64(b64: string): Uint8Array {
  const len = b64.length;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((len / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const n = (B64[b64.charCodeAt(i)] << 18) | (B64[b64.charCodeAt(i + 1)] << 12) | (B64[b64.charCodeAt(i + 2)] << 6) | B64[b64.charCodeAt(i + 3)];
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/**
 * Decode the generated fog field, or null when it was generated for different
 * route constants. Precision: dist/arc to 1/32 (stored as value * 16, rounded);
 * noise is noise8 / 255, within 1/510 of the runtime value.
 */
export function decodeFogFieldData(): FogField | null {
  if (FOG_FIELD_DATA.hash !== fogRouteHash() || FOG_FIELD_DATA.cols !== FOG_COLS || FOG_FIELD_DATA.rows !== FOG_ROWS) return null;
  const n = FOG_COLS * FOG_ROWS;
  const d = decodeBase64(FOG_FIELD_DATA.dist16);
  const a = decodeBase64(FOG_FIELD_DATA.arc16);
  const q = decodeBase64(FOG_FIELD_DATA.noise8);
  if (d.length !== n * 2 || a.length !== n * 2 || q.length !== n) return null;
  const dist = new Float32Array(n);
  const arc = new Float32Array(n);
  const noise = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    dist[i] = (d[i * 2] | (d[i * 2 + 1] << 8)) / 16;
    arc[i] = (a[i * 2] | (a[i * 2 + 1] << 8)) / 16;
    noise[i] = q[i] / 255;
  }
  return { cols: FOG_COLS, rows: FOG_ROWS, dist, arc, noise };
}

/**
 * The fog field for the master route, memoised. Decodes the generated data
 * (cheap); if it is stale (route constants changed without re-running
 * scripts/generate-chart-fog-field.mjs) it warns in __DEV__ and falls back to
 * the runtime grid build.
 */
export function buildFogField(table: RouteTable): FogField {
  if (fogCache && fogCache.table === table) return fogCache.field;
  let field = decodeFogFieldData();
  if (!field) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[chart] fog field data is stale; run `node scripts/generate-chart-fog-field.mjs`. Falling back to the runtime build.');
    }
    field = buildFogFieldGrid(table);
  }
  fogCache = { table, field };
  return field;
}

/** Builds the fog field on the next macrotask (call after the first frame). */
export function precomputeFogFieldAsync(table: RouteTable): Promise<FogField> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(buildFogField(table)), 0);
  });
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * JS reference for the per-cell fog value in [0,1] (1 = ink fully revealed),
 * the prototype's `renderFog` output / 255. The fog shader must match this.
 * `tip` = posAt(table, revealArc + FOG_LEAD).
 */
export function fogAlphaAt(field: FogField, i: number, revealArc: number, fog: number, tip: MapPoint): number {
  const fa = revealArc + FOG_LEAD;
  const rIn = FOG_R_IN + FOG_ARRIVAL_R_IN * fog; // prototype: 105 + 1700*fog
  const fe = FOG_FEATHER + FOG_ARRIVAL_FEATHER * fog; // prototype: 95 + 300*fog
  let d: number;
  if (field.arc[i] <= fa) {
    d = field.dist[i];
  } else {
    const mx = i % field.cols;
    const my = Math.floor(i / field.cols);
    const dx = mx * FOG_CELL + FOG_CELL / 2 - tip.x;
    const dy = my * FOG_CELL + FOG_CELL / 2 - tip.y;
    d = Math.sqrt(dx * dx + dy * dy);
  }
  const al = Math.min(1, Math.max(0, 1 - (d - rIn) / fe));
  return smoothstep(0.42, 0.58, al + (field.noise[i] - 0.5) * 0.7);
}

/**
 * Pack for GPU upload (two cols x rows RGBA8 images, nearest filtering).
 *
 * DECODE (in the shader, channel values in 0..255):
 *   dist  = (R * 256 + G) / 16          (map units, up to ~4095)
 *   arc   = (B * 256 + A) / 16          (map units)
 *   noise = R / 255 of the noise image  (G = B = 0, A = 255)
 * Precision: 1/16 unit.
 */
export function packFogField(field: FogField): { fieldRGBA: Uint8Array; noiseRGBA: Uint8Array } {
  const n = field.cols * field.rows;
  const fieldRGBA = new Uint8Array(n * 4);
  const noiseRGBA = new Uint8Array(n * 4);
  const enc = (v: number) => Math.round(Math.min(4095.9, Math.max(0, v)) * 16);
  for (let i = 0; i < n; i++) {
    const d = enc(field.dist[i]);
    const a = enc(field.arc[i]);
    fieldRGBA[i * 4] = d >> 8;
    fieldRGBA[i * 4 + 1] = d & 255;
    fieldRGBA[i * 4 + 2] = a >> 8;
    fieldRGBA[i * 4 + 3] = a & 255;
    noiseRGBA[i * 4] = Math.round(Math.min(1, Math.max(0, field.noise[i])) * 255);
    noiseRGBA[i * 4 + 3] = 255;
  }
  return { fieldRGBA, noiseRGBA };
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

export function cameraTargetFor(p: MapPoint, s: number): { cx: number; cy: number; s: number } {
  return { cx: p.x, cy: p.y + 30, s };
}

/**
 * Prototype applyCam. `k` = viewW / MAP_W maps map units to view pixels; the
 * transform is translate(tx, ty) then scale(s). tx/ty are clamped so the map
 * never shows its edges.
 */
export function clampCamera(
  cx: number,
  cy: number,
  s: number,
  viewW: number,
  viewH: number
): { tx: number; ty: number; k: number } {
  'worklet';
  const k = viewW / 852;
  const loX = viewW - viewW * s;
  // DEFERRED: viewH - viewH * s assumed every viewport showed the full art.
  // Short Chart windows pan over the full landscape instead of clamping at their cropped bottom.
  const artH = viewW * 1180 / 852;
  const extentH = viewH + 1 < artH ? artH : viewH;
  const loY = viewH - extentH * s;
  const rawX = viewW / 2 - cx * k * s;
  const rawY = viewH / 2 - cy * k * s;
  const tx = Math.max(loX, Math.min(0, rawX));
  const ty = Math.max(loY, Math.min(0, rawY));
  return { tx, ty, k };
}

/* ------------------------------------------------------------------ */
/* Scallop                                                             */
/* ------------------------------------------------------------------ */

/**
 * Map-to-panel divider matching the mockup: the cream map sheet curves smoothly down from both
 * edges to a small pointed tip at the centre. Ink fills everything below, in a 390 x 40 box
 * scaled to width x height.
 */
export function scallopPath(width: number, height = 40): string {
  const sx = width / 390;
  const sy = height / 40;
  const X = (v: number) => fmtNum(v * sx);
  const Y = (v: number) => fmtNum(v * sy);
  return (
    `M0,${Y(40)} L0,${Y(0)}` +
    ` C${X(70)},${Y(18)} ${X(140)},${Y(26)} ${X(178)},${Y(28)}` +
    ` Q${X(190)},${Y(30)} ${X(195)},${Y(40)}` +
    ` Q${X(200)},${Y(30)} ${X(212)},${Y(28)}` +
    ` C${X(250)},${Y(26)} ${X(320)},${Y(18)} ${X(390)},${Y(0)}` +
    ` L${X(390)},${Y(40)} Z`
  );
}
