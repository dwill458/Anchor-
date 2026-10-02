import { parseSigilSvg } from '@/components/common/PrimeAnchorCanvas';
import {
  buildDrawnGeometry,
  simplifyStroke,
  totalStrokeLength,
  DRAWN_FIT_SIZE,
} from './drawnGeometry';

// Mirrors backend/src/api/routes/anchors.ts isSafeSvg — the backend rejects SVGs that fail it.
function isSafeSvg(svg: string): boolean {
  const normalized = svg.toLowerCase();
  return !(
    /<script\b/.test(normalized) ||
    /\son[a-z]+\s*=/.test(normalized) ||
    /javascript:/.test(normalized) ||
    /\b(?:href|xlink:href|src)\s*=\s*['"]?\s*https?:\/\//.test(normalized)
  );
}

const line = (n: number, y = 100) => Array.from({ length: n }, (_, i) => ({ x: 20 + i * 10, y }));

describe('simplifyStroke', () => {
  it('keeps both endpoints and drops collinear points', () => {
    const result = simplifyStroke(line(10));
    expect(result).toEqual([{ x: 20, y: 100 }, { x: 110, y: 100 }]);
  });

  it('keeps a corner that deviates beyond epsilon', () => {
    const corner = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 100, y: 100 }];
    const result = simplifyStroke(corner);
    expect(result).toContainEqual({ x: 100, y: 0 });
    expect(result[0]).toEqual(corner[0]);
    expect(result[result.length - 1]).toEqual(corner[corner.length - 1]);
  });

  it('does not collapse a closed loop to its (coincident) endpoints', () => {
    const loop = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 0 },
    ];
    const result = simplifyStroke(loop);
    expect(result.length).toBeGreaterThan(2);
    expect(result[0]).toEqual(result[result.length - 1]);
  });
});

describe('buildDrawnGeometry', () => {
  const triangle = [{ x: 50, y: 300 }, { x: 150, y: 100 }, { x: 250, y: 300 }, { x: 50, y: 300 }];

  it('builds a single-stroke 100x100 SVG', () => {
    const result = buildDrawnGeometry([triangle]);
    expect(result.strokeCount).toBe(1);
    expect(result.baseSigilSvg).toContain('viewBox="0 0 100 100"');
    expect(result.baseSigilSvg.match(/<path /g)).toHaveLength(1);
    expect(result.baseSigilSvg).toContain('stroke-linecap="round"');
    expect(result.baseSigilSvg).not.toContain('<filter');
    expect(result.baseSigilSvg).not.toContain('<marker');
  });

  it('emits one path per stroke and marks the pen lifts', () => {
    const second = [{ x: 60, y: 200 }, { x: 240, y: 200 }];
    const result = buildDrawnGeometry([triangle, second]);
    expect(result.strokeCount).toBe(2);
    expect(result.baseSigilSvg.match(/<path /g)).toHaveLength(2);
    expect(result.points.filter((p) => p.breakBefore)).toHaveLength(1);
    expect(result.points[0].breakBefore).toBeUndefined();
  });

  it('drops strokes shorter than two points', () => {
    const result = buildDrawnGeometry([[{ x: 1, y: 1 }], triangle]);
    expect(result.strokeCount).toBe(1);
  });

  it('returns an empty drawing when nothing usable was drawn', () => {
    const result = buildDrawnGeometry([[{ x: 1, y: 1 }]]);
    expect(result.strokeCount).toBe(0);
    expect(result.points).toEqual([]);
  });

  it('fits every point inside the 20..80 box, centred', () => {
    const wide = buildDrawnGeometry([[{ x: 0, y: 0 }, { x: 500, y: 40 }]]);
    const tall = buildDrawnGeometry([[{ x: 0, y: 0 }, { x: 10, y: 800 }]]);

    [wide, tall].forEach((result) => {
      result.points.forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(20);
        expect(p.x).toBeLessThanOrEqual(80);
        expect(p.y).toBeGreaterThanOrEqual(20);
        expect(p.y).toBeLessThanOrEqual(80);
      });
      const xs = result.points.map((p) => p.x);
      const ys = result.points.map((p) => p.y);
      const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      expect(extent).toBeLessThanOrEqual(DRAWN_FIT_SIZE + 0.01);
    });
  });

  it('produces SVG that passes the backend safety check and parses for the canvas', () => {
    const result = buildDrawnGeometry([triangle, [{ x: 60, y: 200 }, { x: 240, y: 200 }]]);
    expect(isSafeSvg(result.baseSigilSvg)).toBe(true);

    const parsed = parseSigilSvg(result.baseSigilSvg);
    expect(parsed.viewBox).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(parsed.pathDs).toHaveLength(2);
    parsed.pathDs.forEach((d) => expect(d).toMatch(/^M [\d.]+,[\d.]+( L [\d.]+,[\d.]+)+$/));
  });
});

describe('totalStrokeLength', () => {
  it('sums every stroke', () => {
    expect(totalStrokeLength([[{ x: 0, y: 0 }, { x: 30, y: 40 }], [{ x: 0, y: 0 }, { x: 0, y: 10 }]])).toBe(60);
    expect(totalStrokeLength([])).toBe(0);
  });
});
