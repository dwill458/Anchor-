import {
  ROUTE_PTS,
  OVERVIEW_CAMERA,
  buildFogField,
  buildRouteTable,
  cameraTargetFor,
  clampCamera,
  fogAlphaAt,
  packFogField,
  posAt,
  posAtInto,
  scallopPath,
  waypointPlacement,
} from '../chartMapGeometry';

/** Independent re-implementation of the prototype total length. */
function prototypeTotal(): number {
  let total = 0;
  for (let i = 0; i < ROUTE_PTS.length - 1; i++) {
    const a = ROUTE_PTS[i];
    const b = ROUTE_PTS[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    const nx = -dy / L;
    const ny = dx / L;
    const off = (i % 2 ? -1 : 1) * Math.min(34, L * 0.16);
    const c1 = [a[0] + dx * 0.33 + nx * off, a[1] + dy * 0.33 + ny * off];
    const c2 = [a[0] + dx * 0.67 - nx * off * 0.7, a[1] + dy * 0.67 - ny * off * 0.7];
    let prev = [a[0], a[1]];
    for (let k = 1; k <= 48; k++) {
      const t = k / 48;
      const u = 1 - t;
      const p = [
        u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
        u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1],
      ];
      total += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
  }
  return total;
}

describe('route table', () => {
  const table = buildRouteTable();

  it('is memoised and has a sane total equal to the prototype re-implementation', () => {
    expect(buildRouteTable()).toBe(table);
    // The route now climbs to the summit: about 1153 map units (the original seven-vertex route was about 874).
    expect(table.total).toBeGreaterThan(1100);
    expect(table.total).toBeLessThan(1200);
    expect(Math.abs(table.total - prototypeTotal())).toBeLessThan(table.total * 0.01);
    expect(table.legs).toHaveLength(10);
    expect(table.svgPath.match(/C/g)).toHaveLength(10);
    expect(table.svgPath.startsWith('M70,992')).toBe(true);
  });

  it('posAt endpoints equal PTS[0] and the destination X; clamps out of range', () => {
    expect(posAt(table, 0)).toEqual({ x: 70, y: 992 });
    const end = posAt(table, table.total);
    expect(end.x).toBeCloseTo(741, 2);
    expect(end.y).toBeCloseTo(112, 2);
    expect(posAt(table, -50)).toEqual(posAt(table, 0));
    const over = posAt(table, table.total + 500);
    expect(over.x).toBeCloseTo(end.x, 3);
    expect(over.y).toBeCloseTo(end.y, 3);
  });

  it('posAtInto writes into the provided object', () => {
    const out = { x: 0, y: 0 };
    const r = posAtInto(table.xs, table.ys, table.arcs, table.count, table.total / 2, out);
    expect(r).toBe(out);
    expect(out).toEqual(posAt(table, table.total / 2));
  });

  it('sample arcs are non-decreasing', () => {
    for (let i = 1; i < table.count; i++) expect(table.arcs[i]).toBeGreaterThanOrEqual(table.arcs[i - 1]);
  });
});

describe('waypointPlacement', () => {
  const table = buildRouteTable();
  it.each([3, 5, 7, 12])('places N=%i evenly inside the route', (n) => {
    const p = waypointPlacement(n);
    expect(p.n).toBe(n);
    expect(p.arcs).toHaveLength(n);
    expect(p.points).toHaveLength(n);
    expect(p.legs).toHaveLength(n);
    const gap = table.total / (n + 1);
    p.arcs.forEach((arc, k) => {
      expect(arc).toBeGreaterThan(0);
      expect(arc).toBeLessThan(table.total);
      expect(Math.abs(arc - (k + 1) * gap)).toBeLessThan(1e-6);
      if (k > 0) expect(arc).toBeGreaterThan(p.arcs[k - 1]);
      const pt = posAt(table, arc);
      expect(p.points[k].x).toBeCloseTo(pt.x, 6);
      expect(p.points[k].y).toBeCloseTo(pt.y, 6);
    });
    expect(p.legs[0].start).toBe(0);
    p.legs.forEach((leg, i) => {
      expect(leg.end).toBe(p.arcs[i]);
      if (i > 0) expect(leg.start).toBe(p.arcs[i - 1]);
    });
    expect(p.markerRadius).toBe(n > 7 ? 24 : 30);
    expect(p.start).toEqual({ x: 70, y: 992 });
    expect(p.summit.x).toBeCloseTo(741, 2);
  });

  it('is memoised and clamps n defensively', () => {
    expect(waypointPlacement(5)).toBe(waypointPlacement(5));
    expect(waypointPlacement(0).n).toBe(1);
    expect(waypointPlacement(99).n).toBe(12);
    expect(waypointPlacement(NaN).n).toBe(1);
  });
});

describe('fog', () => {
  const table = buildRouteTable();
  const field = buildFogField(table);
  const cellAt = (x: number, y: number) => Math.floor(y / 4) * field.cols + Math.floor(x / 4);

  it('is memoised with the prototype dimensions', () => {
    expect(buildFogField(table)).toBe(field);
    expect(field.cols).toBe(213);
    expect(field.rows).toBe(295);
    expect(field.dist).toHaveLength(213 * 295);
  });

  it('at revealArc 0 the start is revealed and the summit is fogged', () => {
    const tip = posAt(table, 110);
    const start = fogAlphaAt(field, cellAt(70, 992), 0, 0, tip);
    const summit = fogAlphaAt(field, cellAt(734, 190), 0, 0, tip);
    expect(start).toBeGreaterThan(0.95);
    expect(summit).toBeLessThan(0.05);
  });

  it('arrival (fog = 1) clears everything along the map', () => {
    const tip = posAt(table, table.total);
    for (const [x, y] of [[70, 992], [734, 190], [400, 600], [20, 20], [830, 1160]]) {
      expect(fogAlphaAt(field, cellAt(x, y), table.total, 1, tip)).toBeGreaterThan(0.95);
    }
  });

  it('pack/decode round-trips within 1/16', () => {
    const { fieldRGBA, noiseRGBA } = packFogField(field);
    expect(fieldRGBA).toHaveLength(field.cols * field.rows * 4);
    for (const i of [0, 1000, 31000, field.dist.length - 1]) {
      const d = (fieldRGBA[i * 4] * 256 + fieldRGBA[i * 4 + 1]) / 16;
      const a = (fieldRGBA[i * 4 + 2] * 256 + fieldRGBA[i * 4 + 3]) / 16;
      expect(Math.abs(d - Math.min(field.dist[i], 4095.9))).toBeLessThanOrEqual(1 / 16);
      expect(Math.abs(a - field.arc[i])).toBeLessThanOrEqual(1 / 16);
      expect(Math.abs(noiseRGBA[i * 4] / 255 - field.noise[i])).toBeLessThanOrEqual(1 / 255);
      expect(noiseRGBA[i * 4 + 3]).toBe(255);
    }
  });
});

describe('camera and scallop', () => {
  it('overview constants and target', () => {
    expect(OVERVIEW_CAMERA).toEqual({ cx: 426, cy: 590, s: 1 });
    expect(cameraTargetFor({ x: 100, y: 200 }, 1.45)).toEqual({ cx: 100, cy: 230, s: 1.45 });
  });

  it('clampCamera matches the prototype applyCam', () => {
    const c = clampCamera(426, 590, 1, 390, 540);
    expect(c.k).toBeCloseTo(390 / 852, 6);
    expect(c.tx).toBeCloseTo(0, 9);
    expect(c.ty).toBeCloseTo(0, 9);
    const z = clampCamera(734, 190, 1.45, 390, 540);
    expect(z.tx).toBeCloseTo(390 - 390 * 1.45, 6); // clamped to the right edge
    expect(z.ty).toBeGreaterThanOrEqual(540 - 540 * 1.45);
    expect(z.ty).toBeLessThanOrEqual(0);
    const mid = clampCamera(426, 590, 1.45, 390, 540);
    expect(mid.tx).toBeCloseTo(195 - 426 * (390 / 852) * 1.45, 6);
  });

  it('scallopPath scales to width and keeps the centre tip', () => {
    const d = scallopPath(390);
    expect(d.startsWith('M0,40 L0,0')).toBe(true);
    expect(d).toContain('195,40');
    const half = scallopPath(195, 20);
    expect(half).toContain('97.5,20');
    expect(half.endsWith('L195,20 Z')).toBe(true);
  });
});


describe('summit inside the map on phone widths', () => {
  it.each([320, 360, 390, 430])('%idp keeps the etched X inside the map width', width => {
    const summit = waypointPlacement(4).summit;
    const scale = width / 852;
    const x = summit.x * scale;
    const radius = 18 * scale;
    expect(width - x - radius).toBeGreaterThanOrEqual(24);
  });
});


it('centres a current waypoint in a capped Chart window without the old bottom clamp', () => {
  const point = waypointPlacement(4).points[0];
  const camera = clampCamera(point.x, point.y + 30, 1.45, 360, 252);
  const y = camera.ty + point.y * camera.k * 1.45;
  expect(y).toBeGreaterThan(44);
  expect(y).toBeLessThan(252 - 44);
});
