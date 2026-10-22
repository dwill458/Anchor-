import type { RouteTable, WaypointPlacement, WaypointProgressInput } from '../chartMapContracts';
import { FOG_FIELD_DATA } from '../chartFogFieldData';
import {
  buildRouteTable, cameraTargetFor, clampCamera, decodeFogFieldData, fogRouteHash, fogRouteHashInput, OVERVIEW_CAMERA, posAt, ROUTE_PTS, waypointPlacement,
} from '../chartMapGeometry';
import { CHART_MAP_TIMING } from '../../chartMotion';
import { routeRevealArc } from '../chartProgress';
import { chartMapScreenTop } from '../ChartWeatherHold';
import { FOCUS_SCALE, OPEN_SCALE } from '../useChartMapCamera';

/** The route before the summit extension: the first seven vertices of today's ROUTE_PTS. */
const OLD_PTS: ReadonlyArray<readonly [number, number]> = [
  [70, 992], [233, 790], [385, 606], [516, 490], [575, 430], [625, 400], [660, 370],
];

/** Sampled cubic-leg polyline of a route, with cumulative arc length (independent of the table). */
function sampleRoute(pts: ReadonlyArray<readonly [number, number]>): Array<{ x: number; y: number; arc: number }> {
  const out = [{ x: pts[0][0], y: pts[0][1], arc: 0 }];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    const nx = -dy / L;
    const ny = dx / L;
    const off = (i % 2 ? -1 : 1) * Math.min(34, L * 0.16);
    const c1 = [a[0] + dx * 0.33 + nx * off, a[1] + dy * 0.33 + ny * off];
    const c2 = [a[0] + dx * 0.67 - nx * off * 0.7, a[1] + dy * 0.67 - ny * off * 0.7];
    let prev = { x: a[0], y: a[1] };
    for (let k = 1; k <= 480; k++) {
      const t = k / 480;
      const u = 1 - t;
      const p = {
        x: u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
        y: u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1],
      };
      total += Math.hypot(p.x - prev.x, p.y - prev.y);
      out.push({ ...p, arc: total });
      prev = p;
    }
  }
  return out;
}

const OLD_SAMPLES = sampleRoute(OLD_PTS);
const OLD_TOTAL = OLD_SAMPLES[OLD_SAMPLES.length - 1].arc;

/** Map point on the OLD route at an arc length (480 samples per leg: sub-unit accuracy). */
function oldPointAt(arc: number): { x: number; y: number } {
  let best = OLD_SAMPLES[0];
  for (const s of OLD_SAMPLES) if (Math.abs(s.arc - arc) < Math.abs(best.arc - arc)) best = s;
  return { x: best.x, y: best.y };
}

/** Old layout: waypoints at (k+1)/(n+1) of the old total, as waypointPlacement lays them out. */
function oldPlacement(n: number): WaypointPlacement {
  const arcs = Array.from({ length: n }, (_, k) => ((k + 1) / (n + 1)) * OLD_TOTAL);
  return { n, arcs, legs: arcs.map((end, i) => ({ start: i === 0 ? 0 : arcs[i - 1], end })) } as unknown as WaypointPlacement;
}

const mk = (id: string, movesDone: number, movesTotal: number, completed = false): WaypointProgressInput => ({
  id, completed, mode: 'moves', metric: null, movesDone, movesTotal,
});

const N = 5;
const STATES = [
  { name: 'fresh chart', inputs: [mk('a', 0, 2), mk('b', 0, 2), mk('c', 0, 2), mk('d', 0, 2), mk('e', 0, 2)], currentIndex: 0, isFinished: false },
  { name: 'mid chart', inputs: [mk('a', 2, 2, true), mk('b', 2, 2, true), mk('c', 1, 2), mk('d', 0, 2), mk('e', 0, 2)], currentIndex: 2, isFinished: false },
  { name: 'one waypoint left', inputs: [mk('a', 2, 2, true), mk('b', 2, 2, true), mk('c', 2, 2, true), mk('d', 2, 2, true), mk('e', 1, 2)], currentIndex: 4, isFinished: false },
  { name: 'finished', inputs: [mk('a', 2, 2, true), mk('b', 2, 2, true), mk('c', 2, 2, true), mk('d', 2, 2, true), mk('e', 2, 2, true)], currentIndex: 4, isFinished: true },
];

describe('route extension to the summit', () => {
  const table = buildRouteTable();

  it('keeps every existing vertex: the first seven ROUTE_PTS are unchanged', () => {
    expect(ROUTE_PTS.slice(0, OLD_PTS.length)).toEqual(OLD_PTS);
    expect(ROUTE_PTS).toHaveLength(OLD_PTS.length + 4);
  });

  it('ends at the destination X just under the apex of the right-hand peak', () => {
    const end = posAt(table, table.total);
    expect(end.x).toBeCloseTo(741, 2);
    expect(end.y).toBeCloseTo(112, 2);
    expect(waypointPlacement(N).summit).toEqual(end);
    expect(table.legs).toHaveLength(ROUTE_PTS.length - 1);
    expect(table.total).toBeGreaterThan(OLD_TOTAL);
  });

  it('the old finishing point (660,370) is still on the route, at the old arc length', () => {
    const p = posAt(table, OLD_TOTAL);
    expect(p.x).toBeCloseTo(660, 0);
    expect(p.y).toBeCloseTo(370, 0);
  });

  it.each(STATES)('ink never retreats: $name', ({ inputs, currentIndex, isFinished }) => {
    const before = routeRevealArc({
      inputs, currentIndex, isFinished, hw: {}, placement: oldPlacement(N), table: { total: OLD_TOTAL } as unknown as RouteTable,
    });
    const after = routeRevealArc({ inputs, currentIndex, isFinished, hw: {}, placement: waypointPlacement(N), table });
    // Ink never ends behind where it ended before...
    expect(after).toBeGreaterThanOrEqual(before - 1e-9);
    // ...and the old drawn end is still the same point on the new route, so the new end is further along it.
    const oldEnd = oldPointAt(before);
    const onNewRoute = posAt(table, before);
    expect(Math.hypot(onNewRoute.x - oldEnd.x, onNewRoute.y - oldEnd.y)).toBeLessThan(1);
    if (before > 0) expect(after / before).toBeCloseTo(table.total / OLD_TOTAL, 6);
  });

  it('finished charts draw the whole route, ending at the new X', () => {
    const arc = routeRevealArc({ inputs: [], currentIndex: 0, isFinished: true, hw: {}, placement: waypointPlacement(N), table });
    expect(arc).toBe(table.total);
    expect(posAt(table, arc).y).toBeCloseTo(112, 2);
  });
});

/**
 * Summit clearance per framing. Screen y of a map point is ty + s*k*y (the land Group and the marker
 * layer agree). The Chart's header box ends at insetTop + 76: 8 + 44pt controls + 8 + the category row.
 */
describe('summit clearance under the header', () => {
  const HEADER_BOTTOM = (insetTop: number) => insetTop + 76;
  const CLEAR = 56;
  const phones = [
    { name: '360x640 (48dp inset)', w: 360, h: 640, insetTop: 48, insetBottom: 34 },
    { name: '412x915 (48dp inset)', w: 412, h: 915, insetTop: 48, insetBottom: 34 },
    { name: '412x915 (60dp inset)', w: 412, h: 915, insetTop: 60, insetBottom: 34 },
  ];

  it.each(phones)('$name: every framing puts the summit at least 56dp below the header', ({ w, h, insetTop, insetBottom }) => {
    const { summit } = waypointPlacement(N);
    const artTop = chartMapScreenTop(w, h, insetTop, insetBottom);
    const framings = [
      { name: 'overview', cx: OVERVIEW_CAMERA.cx, cy: OVERVIEW_CAMERA.cy, s: OVERVIEW_CAMERA.s },
      { name: 'summit focus', ...cameraTargetFor(summit, FOCUS_SCALE) },
      { name: 'summit open', ...cameraTargetFor(summit, OPEN_SCALE) },
      { name: 'open start camera', ...CHART_MAP_TIMING.open.startCamera },
    ];
    const gaps = framings.map((f) => {
      const cam = clampCamera(f.cx, f.cy, f.s, w, h, { mode: 'fullBleed', artTop });
      const screenY = cam.ty + f.s * cam.k * summit.y;
      return { framing: f.name, gap: Math.round((screenY - HEADER_BOTTOM(insetTop)) * 10) / 10 };
    });
    // Lists every framing that is too close, so a failure names it.
    expect(gaps.filter((g) => g.gap < CLEAR)).toEqual([]);
  });

  it('the summit art circle clears the header and stays on screen at overview (360x640)', () => {
    const { w, h, insetTop, insetBottom } = phones[0];
    const artTop = chartMapScreenTop(w, h, insetTop, insetBottom);
    const k = w / 852;
    const { summit } = waypointPlacement(N);
    const circleTop = artTop + (summit.y - 36) * k;
    const circleBottom = artTop + (summit.y + 36) * k;
    expect(circleTop - HEADER_BOTTOM(insetTop)).toBeGreaterThanOrEqual(0);
    expect(circleBottom).toBeLessThanOrEqual(h);
  });
});

describe('fog cache key', () => {
  it('is versioned and carries the extended route, and the generated data matches it', () => {
    expect(fogRouteHashInput().startsWith('fog-v2|')).toBe(true);
    expect(fogRouteHashInput()).toContain('[741,112]');
    expect(FOG_FIELD_DATA.hash).toBe(fogRouteHash());
    expect(decodeFogFieldData()).not.toBeNull();
  });
});
