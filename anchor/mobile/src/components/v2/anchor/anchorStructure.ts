/**
 * Anchor structure: the stored geometry of an Anchor, as data.
 *
 * An Anchor's structure is its `baseSigilSvg` (or `reinforcedSigilSvg`) — produced once by the
 * deterministic generator and persisted by the server. Nothing here changes it. This module
 * only reads the SVG into strokes so that expression renderers can draw the SAME path data
 * through different visual treatments, and so formation can trace the real path.
 *
 * The parse is deliberately narrow: it accepts the stroked-path SVGs the Anchor generators
 * and the drawing canvas emit (absolute M/L/H/V/Q/C/Z, no transforms, no filled shapes).
 * Anything else returns `null`, and callers fall back to the plain SVG renderer — an
 * unfamiliar legacy SVG is shown exactly as stored rather than re-interpreted.
 */

export type AnchorStrokeRole = 'mark' | 'perimeter';

export interface AnchorPoint {
  x: number;
  y: number;
}

export interface AnchorStroke {
  /** Path data exactly as stored. Expressions must render this string unchanged. */
  d: string;
  strokeWidth: number;
  opacity: number;
  /** `perimeter` is the hand-drawn boundary some structures carry; `mark` is the intention path. */
  role: AnchorStrokeRole;
  /** Corner points for straight-segment paths, in drawing order; null when the path curves. */
  vertices: AnchorPoint[] | null;
  /** Arc length in viewBox units, used to trace the stroke. */
  length: number;
}

export interface AnchorStructure {
  viewBox: string;
  box: { minX: number; minY: number; width: number; height: number };
  strokes: AnchorStroke[];
  /** Stroke width of the primary mark, the reference every expression scales from. */
  markWidth: number;
}

const UNSUPPORTED = /<(circle|rect|line|polyline|polygon|ellipse|text|image|use|filter|mask|pattern|clipPath|linearGradient|radialGradient|style|script)\b|\btransform\s*=/i;
const PATH_TAG = /<path\b([^>]*)\/?>/gi;
const ATTRIBUTE = /([\w:-]+)\s*=\s*"([^"]*)"/g;
const TOKEN = /[MLHVQCZmlhvqcz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g;

const CACHE = new Map<string, AnchorStructure | null>();
const CACHE_LIMIT = 250;

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  let match: RegExpExecArray | null;
  ATTRIBUTE.lastIndex = 0;
  while ((match = ATTRIBUTE.exec(tag))) result[match[1].toLowerCase()] = match[2];
  return result;
}

function distance(a: AnchorPoint, b: AnchorPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function quadratic(p0: AnchorPoint, p1: AnchorPoint, p2: AnchorPoint, t: number): AnchorPoint {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}

function cubic(p0: AnchorPoint, p1: AnchorPoint, p2: AnchorPoint, p3: AnchorPoint, t: number): AnchorPoint {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function sampleLength(point: (t: number) => AnchorPoint, from: AnchorPoint, samples: number): number {
  let length = 0;
  let previous = from;
  for (let i = 1; i <= samples; i += 1) {
    const next = point(i / samples);
    length += distance(previous, next);
    previous = next;
  }
  return length;
}

/** Walk absolute path data once: arc length, and the corner list when every segment is straight. */
export function measurePathData(d: string): { length: number; vertices: AnchorPoint[] | null } | null {
  const tokens = d.match(TOKEN);
  if (!tokens?.length) return null;

  let index = 0;
  let command = '';
  let cursor: AnchorPoint = { x: 0, y: 0 };
  let subpathStart: AnchorPoint = { x: 0, y: 0 };
  let length = 0;
  let straight = true;
  const vertices: AnchorPoint[] = [];
  const number = () => {
    const value = Number(tokens[index++]);
    if (!Number.isFinite(value)) throw new Error('bad number');
    return value;
  };
  const isCommand = (token: string | undefined) => token !== undefined && /^[A-Za-z]$/.test(token);

  try {
    while (index < tokens.length) {
      if (isCommand(tokens[index])) command = tokens[index++];
      // Relative commands are not produced by any Anchor generator; refuse rather than guess.
      if (command !== command.toUpperCase()) return null;
      switch (command) {
        case 'M': {
          cursor = { x: number(), y: number() };
          subpathStart = cursor;
          if (vertices.length) straight = false; // multiple subpaths do not form one corner chain
          vertices.push(cursor);
          command = 'L'; // implicit lineto after the first pair
          break;
        }
        case 'L': {
          const next = { x: number(), y: number() };
          length += distance(cursor, next);
          vertices.push(next);
          cursor = next;
          break;
        }
        case 'H': {
          const next = { x: number(), y: cursor.y };
          length += distance(cursor, next);
          vertices.push(next);
          cursor = next;
          break;
        }
        case 'V': {
          const next = { x: cursor.x, y: number() };
          length += distance(cursor, next);
          vertices.push(next);
          cursor = next;
          break;
        }
        case 'Q': {
          const control = { x: number(), y: number() };
          const end = { x: number(), y: number() };
          const from = cursor;
          length += sampleLength((t) => quadratic(from, control, end, t), from, 16);
          cursor = end;
          straight = false;
          break;
        }
        case 'C': {
          const c1 = { x: number(), y: number() };
          const c2 = { x: number(), y: number() };
          const end = { x: number(), y: number() };
          const from = cursor;
          length += sampleLength((t) => cubic(from, c1, c2, end, t), from, 20);
          cursor = end;
          straight = false;
          break;
        }
        case 'Z': {
          length += distance(cursor, subpathStart);
          cursor = subpathStart;
          straight = false;
          break;
        }
        default:
          return null;
      }
    }
  } catch {
    return null;
  }

  return { length, vertices: straight ? vertices : null };
}

function parseViewBox(svg: string): AnchorStructure['box'] | null {
  const match = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
  const values = (match?.[1] ?? '0 0 100 100').trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) return null;
  return { minX: values[0], minY: values[1], width: values[2], height: values[3] };
}

function parse(svg: string): AnchorStructure | null {
  if (typeof svg !== 'string' || !svg.includes('<svg') || UNSUPPORTED.test(svg)) return null;
  const box = parseViewBox(svg);
  if (!box) return null;

  const strokes: AnchorStroke[] = [];
  let match: RegExpExecArray | null;
  PATH_TAG.lastIndex = 0;
  while ((match = PATH_TAG.exec(svg))) {
    const attrs = attributes(match[1]);
    const d = attrs.d?.trim();
    if (!d) continue;
    // A filled shape would read completely differently under a stroke-only treatment.
    if (attrs.fill && attrs.fill !== 'none' && attrs.fill !== 'transparent') return null;
    const measured = measurePathData(d);
    if (!measured) return null;
    const strokeWidth = Number(attrs['stroke-width'] ?? 1);
    const opacity = Number(attrs.opacity ?? attrs['stroke-opacity'] ?? 1);
    strokes.push({
      d,
      strokeWidth: Number.isFinite(strokeWidth) && strokeWidth > 0 ? strokeWidth : 1,
      opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1,
      role: measured.vertices ? 'mark' : 'perimeter',
      vertices: measured.vertices,
      length: measured.length,
    });
  }

  const marks = strokes.filter((stroke) => stroke.role === 'mark');
  if (!strokes.length) return null;
  // A drawn structure can be made only of curves; its first stroke is then its mark.
  if (!marks.length) strokes[0] = { ...strokes[0], role: 'mark' };

  const markWidth = (marks[0] ?? strokes[0]).strokeWidth;
  return {
    viewBox: `${box.minX} ${box.minY} ${box.width} ${box.height}`,
    box,
    strokes,
    markWidth,
  };
}

/**
 * Parse once per SVG string for the lifetime of the app. Expression browsing re-renders the
 * same structure many times; it must never re-parse it.
 */
export function parseAnchorStructure(svg: string | null | undefined): AnchorStructure | null {
  if (!svg) return null;
  if (CACHE.has(svg)) return CACHE.get(svg) ?? null;
  const structure = parse(svg);
  if (CACHE.size >= CACHE_LIMIT) CACHE.clear();
  CACHE.set(svg, structure);
  return structure;
}
