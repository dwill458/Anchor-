import { FOG_SKSL, TINT_SKSL, hexToVec3, routeCoordAt, splitFogField } from '../chartMapShaders';
import { FOG_COLS, FOG_ROWS } from '../chartMapContracts';
import { buildFogField, buildRouteTable, fogAlphaAt, packFogField, posAt } from '../chartMapGeometry';

describe('chart map SkSL sources', () => {
  it('fog shader carries the prototype constants', () => {
    for (const c of ['105.0', '95.0', '1700.0', '300.0', '0.42', '0.58', '0.7', '110.0', '4.0', '16.0']) {
      expect(FOG_SKSL).toContain(c);
    }
    expect(FOG_SKSL).toContain('uniform shader fieldDist');
    expect(FOG_SKSL).toContain('uniform shader fieldArc');
    expect(FOG_SKSL).toContain('uniform shader noiseTex');
  });

  it('tint shader carries the luminance weights, .28 faint mix and ink ramp', () => {
    expect(TINT_SKSL).toContain('0.3, 0.59, 0.11');
    expect(TINT_SKSL).toContain('0.28');
    expect(TINT_SKSL).toContain('1.0 - L');
    expect(TINT_SKSL).toContain('cat * 0.5');
  });
});

describe('fog shader JS port (decode of the opaque upload format)', () => {
  const table = buildRouteTable();
  const field = buildFogField(table);
  const { fieldRGBA, noiseRGBA } = packFogField(field);
  const bytes = splitFogField(fieldRGBA, noiseRGBA);

  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // Mirrors FOG_SKSL cellOut, fed only by the split, opaque bytes.
  function portOut(i: number, reveal: number, fog: number, tip: { x: number; y: number }) {
    const o = i * 4;
    const dist = (bytes.fieldDist[o] * 256 + bytes.fieldDist[o + 1]) / 16;
    const arc = (bytes.fieldArc[o] * 256 + bytes.fieldArc[o + 1]) / 16;
    const noise = bytes.noise[o] / 255;
    const fa = reveal + 110;
    const cx = (i % FOG_COLS) * 4 + 2;
    const cy = Math.floor(i / FOG_COLS) * 4 + 2;
    const d = arc <= fa ? dist : Math.hypot(cx - tip.x, cy - tip.y);
    const rIn = 105 + 1700 * fog;
    const fe = 95 + 300 * fog;
    const al = Math.min(1, Math.max(0, 1 - (d - rIn) / fe));
    return smooth(0.42, 0.58, al + (noise - 0.5) * 0.7);
  }

  it('split images are opaque', () => {
    expect(bytes.fieldDist.length).toBe(FOG_COLS * FOG_ROWS * 4);
    for (let i = 0; i < FOG_COLS * FOG_ROWS; i += 997) {
      expect(bytes.fieldDist[i * 4 + 3]).toBe(255);
      expect(bytes.fieldArc[i * 4 + 3]).toBe(255);
      expect(bytes.noise[i * 4 + 3]).toBe(255);
    }
  });

  it.each([0, 250, 700, 1100])('matches chartMapGeometry.fogAlphaAt at fog 0, reveal %i', reveal => {
    const tip = posAt(table, reveal + 110);
    let worst = 0;
    for (let i = 0; i < FOG_COLS * FOG_ROWS; i += 37) {
      worst = Math.max(worst, Math.abs(portOut(i, reveal, 0, tip) - fogAlphaAt(field, i, reveal, 0, tip)));
    }
    // 1/16-unit quantisation of dist/arc and 1/255 of noise.
    expect(worst).toBeLessThan(0.05);
  });
});

describe('worklet helpers', () => {
  it('routeCoordAt matches posAt', () => {
    const table = buildRouteTable();
    for (const arc of [-5, 0, 123.4, 600, table.total, table.total + 50]) {
      const p = posAt(table, arc);
      expect(routeCoordAt(table.xs, table.arcs, table.count, arc)).toBeCloseTo(p.x, 4);
      expect(routeCoordAt(table.ys, table.arcs, table.count, arc)).toBeCloseTo(p.y, 4);
    }
  });

  it('hexToVec3 parses', () => {
    expect(hexToVec3('#FF0000')).toEqual([1, 0, 0]);
  });
});
