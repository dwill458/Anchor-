/**
 * Draw-your-own geometry.
 *
 * Turns the strokes a person drew on the creation pad into the same kind of 100x100-viewBox
 * straight-segment SVG that `generateTrueSigil` produces, so the existing styling, saving and
 * rendering pipeline accepts it unchanged. Pure — no React, no Skia.
 */

export interface DrawnPoint {
  x: number;
  y: number;
}

export interface DrawnGeometryPoint extends DrawnPoint {
  /** True on the first point of every stroke after the first (the pen was lifted). */
  breakBefore?: boolean;
}

export interface DrawnGeometry {
  /** viewBox "0 0 100 100", same wrapper and path attributes as `generateTrueSigil`. */
  baseSigilSvg: string;
  /** Simplified vertices, normalised into the 20..80 box. */
  points: DrawnGeometryPoint[];
  strokeCount: number;
  /** The pad -> viewBox transform that was applied: `out = 50 + (pad - center) * scale`. */
  fit: { centerX: number; centerY: number; scale: number };
}

/** Pad-space tolerance for Ramer–Douglas–Peucker. */
export const DRAWN_SIMPLIFY_EPSILON = 3;
/** The drawing is fitted inside this many viewBox units, centred on (50, 50). */
export const DRAWN_FIT_SIZE = 60;
/** Same stroke width the 6x6 (Sun) tier uses for the balanced variant. */
export const DRAWN_STROKE_WIDTH = 1.3;

const VIEWBOX_CENTER = 50;

function perpendicularDistance(point: DrawnPoint, a: DrawnPoint, b: DrawnPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // A closed loop has coincident endpoints; measure from that point instead.
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  return Math.abs(dy * point.x - dx * point.y + b.x * a.y - b.y * a.x) / Math.sqrt(lengthSquared);
}

/** Ramer–Douglas–Peucker. Always keeps both endpoints. */
export function simplifyStroke(points: DrawnPoint[], epsilon: number = DRAWN_SIMPLIFY_EPSILON): DrawnPoint[] {
  if (points.length <= 2) return points.slice();

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    let maxDistance = 0;
    let index = -1;

    for (let i = start + 1; i < end; i += 1) {
      const distance = perpendicularDistance(points[i], points[start], points[end]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }

    if (index !== -1 && maxDistance > epsilon) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

export function buildDrawnGeometry(strokes: DrawnPoint[][]): DrawnGeometry {
  const simplified = strokes
    .filter((stroke) => stroke.length >= 2)
    .map((stroke) => simplifyStroke(stroke))
    .filter((stroke) => stroke.length >= 2);

  if (simplified.length === 0) {
    return {
      baseSigilSvg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" color="#FFFFFF"><g></g></svg>',
      points: [],
      strokeCount: 0,
      fit: { centerX: 0, centerY: 0, scale: 1 },
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  simplified.forEach((stroke) =>
    stroke.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    })
  );

  const width = maxX - minX;
  const height = maxY - minY;
  const extent = Math.max(width, height);
  // A single dot-sized drawing has no extent to scale; keep it at the centre.
  const scale = extent > 0 ? DRAWN_FIT_SIZE / extent : 1;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const fit = (p: DrawnPoint): DrawnPoint => ({
    x: round(VIEWBOX_CENTER + (p.x - centerX) * scale),
    y: round(VIEWBOX_CENTER + (p.y - centerY) * scale),
  });

  const points: DrawnGeometryPoint[] = [];
  const paths = simplified.map((stroke, strokeIndex) => {
    const fitted = stroke.map(fit);
    fitted.forEach((p, i) => {
      points.push(strokeIndex > 0 && i === 0 ? { ...p, breakBefore: true } : p);
    });
    const [first, ...rest] = fitted;
    const d = rest.reduce((path, p) => `${path} L ${p.x},${p.y}`, `M ${first.x},${first.y}`);
    return `<path d="${d}" stroke="currentColor" stroke-width="${DRAWN_STROKE_WIDTH}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
  });

  // NOTE: no <filter>/<marker> — react-native-svg does not reliably support them.
  const baseSigilSvg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" color="#FFFFFF"><g>${paths.join('')}</g></svg>`;

  return {
    baseSigilSvg,
    points,
    strokeCount: simplified.length,
    fit: { centerX, centerY, scale },
  };
}

/** Total pen length across every stroke, in pad pixels. Used to gate the Done control. */
export function totalStrokeLength(strokes: DrawnPoint[][]): number {
  return strokes.reduce((total, stroke) => {
    let length = 0;
    for (let i = 1; i < stroke.length; i += 1) {
      length += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
    }
    return total + length;
  }, 0);
}
