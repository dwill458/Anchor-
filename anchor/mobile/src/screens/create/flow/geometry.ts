/**
 * Flow-side geometry: everything the scenes need to place text, grid cells and the hero polyline
 * in the 390x844 design space. Pure — text measurement is injected so tests (and the Skia
 * painter) share one implementation.
 *
 * What is real here: the letters come from `distillIntention`, the cells and numbers from
 * `getSigilGeometry` (the same computation that builds the SVG sent for styling). The scenes only
 * decide where on screen those real values are drawn.
 */

import type { SigilGeometry } from '@/utils/sigil/traditional-generator';
import type { DrawnPoint } from '@/utils/sigil/drawnGeometry';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './creationFlowConfig';

export const W = DESIGN_WIDTH;
export const H = DESIGN_HEIGHT;

export interface Pt {
  x: number;
  y: number;
}

export interface FontSpec {
  family: 'serif' | 'sans';
  weight: 400 | 500 | 600;
  size: number;
  italic?: boolean;
}

export type MeasureText = (text: string, font: FontSpec) => number;

/** Hero: where the raw anchor settles for Form, and how large. */
export const HERO = { x: 195, y: 410 } as const;
export const HERO_SIZE = 230;
export const HERO_MAX_SCALE = 4.2;

/** Map grid placement. */
export const GRID_CENTER = { x: 195, y: 437 } as const;
/** The grid never grows wider than this; the spec's flat 5 px/unit would overflow 3x3 and 4x4. */
export const GRID_MAX_SPAN = 330;
export const GRID_MAX_PX_PER_UNIT = 5;

/** Registry coordinates run from 20 to 80 on every tier. */
const COORD_MIN = 20;
const COORD_MAX = 80;
const COORD_CENTER = 50;

export const INTENT_MAX_WIDTH = 306;
export const INTENT_CENTER_Y = 292;
/** Distilled letters sit in rows of up to 8, at this pitch. */
export const ROW_PITCH = 32;
export const MAX_PER_ROW = 8;
const ROW_Y: Record<1 | 2 | 3, number[]> = {
  1: [180],
  2: [160, 206],
  3: [140, 182, 224],
};

export const intentFontSize = (length: number): number => (length <= 64 ? 30 : length <= 100 ? 26 : 22);

export const SERIF = (size: number, italic = false): FontSpec => ({ family: 'serif', weight: 400, size, italic });
export const SANS = (size: number, weight: 400 | 500 | 600 = 400): FontSpec => ({ family: 'sans', weight, size });

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function wrapText(text: string, font: FontSpec, maxWidth: number, measure: MeasureText): string[] {
  const lines: string[] = [];
  let current = '';

  for (const word of text.split(' ')) {
    const attempt = current ? `${current} ${word}` : word;
    if (current && measure(attempt, font) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export type CharType = 'keep' | 'vowel' | 'dup' | 'other';

export interface IntentChar {
  ch: string;
  /** Centre x / baseline y in the centred layout. */
  cx: number;
  by: number;
  /** The same glyph's position in the Intention screen's left-aligned field. */
  ax: number;
  ay: number;
  type: CharType;
  /** Order among glyphs of the same removal kind; drives the 8 ms stagger. */
  j: number;
  /** For duplicates: index (in `chars`) of the first occurrence they merge into. */
  first?: number;
  /** For survivors: index into `uniq`. */
  ki?: number;
}

export interface UniqLetter {
  L: string;
  /** Distillation row position (design px). */
  rx: number;
  ry: number;
}

export interface IntentLayout {
  text: string;
  fontSize: number;
  lineHeight: number;
  lines: string[];
  chars: IntentChar[];
  uniq: UniqLetter[];
}

export interface IntentLayoutInput {
  text: string;
  /** Distilled letters from `distillIntention` — the source of truth for survivors. */
  finalLetters: string[];
  measure: MeasureText;
  /** Where the field's glyphs start, in design px. Omit for the fade entry. */
  field?: { x: number; y: number; width: number; lineHeight: number };
}

const isVowel = (letter: string) => 'AEIOU'.includes(letter);

export function buildIntentLayout({ text, finalLetters, measure, field }: IntentLayoutInput): IntentLayout {
  const clean = text.trim().replace(/\s+/g, ' ');
  const fontSize = intentFontSize(clean.length);
  const lineHeight = Math.round(fontSize * 1.3);
  const font = SERIF(fontSize);

  const lines = wrapText(clean, font, INTENT_MAX_WIDTH, measure);
  const top = INTENT_CENTER_Y - (lines.length * lineHeight) / 2 + lineHeight * 0.78;

  const chars: IntentChar[] = [];
  lines.forEach((line, li) => {
    const lineWidth = measure(line, font);
    const x0 = (W - lineWidth) / 2;
    for (let i = 0; i < line.length; i += 1) {
      const pre = measure(line.slice(0, i), font);
      const width = measure(line[i], font);
      chars.push({
        ch: line[i],
        cx: x0 + pre + width / 2,
        by: top + li * lineHeight,
        ax: 0,
        ay: 0,
        type: 'other',
        j: 0,
      });
    }
  });

  // The field's own wrapping, so each glyph can glide from where it was typed.
  const fieldLines = field
    ? wrapText(clean, font, field.width, measure)
    : wrapText(clean, font, INTENT_MAX_WIDTH, measure);
  const fieldStart: Pt[] = [];
  fieldLines.forEach((line, li) => {
    for (let i = 0; i < line.length; i += 1) {
      if (line[i] === ' ') continue;
      const x = field
        ? field.x + measure(line.slice(0, i), font) + measure(line[i], font) / 2
        : 0;
      const y = field ? field.y + li * field.lineHeight : 0;
      fieldStart.push({ x, y });
    }
  });
  let k = 0;
  chars.forEach((c) => {
    if (c.ch === ' ') return;
    const start = fieldStart[k];
    k += 1;
    c.ax = field && start ? start.x : c.cx;
    c.ay = field && start ? start.y : c.by;
  });

  // Classify every glyph. Survivors are checked against `finalLetters` so this can never drift
  // from `distillIntention`: the first occurrence of each consonant keeps, later ones merge.
  const survivors = new Set(finalLetters);
  const seen = new Map<string, number>();
  const uniqOrder: string[] = [];
  let vowelIndex = 0;
  let dupIndex = 0;

  chars.forEach((c, idx) => {
    if (!/[A-Za-z]/.test(c.ch)) {
      c.type = 'other';
      c.j = vowelIndex;
      vowelIndex += 1;
      return;
    }
    const upper = c.ch.toUpperCase();
    if (isVowel(upper)) {
      c.type = 'vowel';
      c.j = vowelIndex;
      vowelIndex += 1;
      return;
    }
    if (seen.has(upper) || !survivors.has(upper)) {
      c.type = 'dup';
      c.first = seen.get(upper) ?? idx;
      c.j = dupIndex;
      dupIndex += 1;
      return;
    }
    seen.set(upper, idx);
    c.type = 'keep';
    c.ki = uniqOrder.length;
    uniqOrder.push(upper);
  });

  const n = uniqOrder.length;
  const rows = Math.min(3, Math.max(1, Math.ceil(n / MAX_PER_ROW))) as 1 | 2 | 3;
  const perRow = Math.max(1, Math.ceil(n / rows));
  const uniq: UniqLetter[] = uniqOrder.map((L, i) => {
    const row = Math.floor(i / perRow);
    const col = i - row * perRow;
    const count = Math.min(perRow, n - row * perRow);
    return {
      L,
      rx: W / 2 + (col - (count - 1) / 2) * ROW_PITCH,
      ry: ROW_Y[rows][Math.min(row, rows - 1)],
    };
  });

  return { text: clean, fontSize, lineHeight, lines, chars, uniq };
}

// ---------------------------------------------------------------------------
// Map grid
// ---------------------------------------------------------------------------

export interface MapPoint {
  letter: string;
  /** The number the letter was actually mapped to on this tier (not always A=1). */
  number: number;
  /** 1-based cell, row-major. */
  cell: number;
  col: number;
  row: number;
  /** Screen position of the (jittered) path vertex. */
  x: number;
  y: number;
  /** Screen position of the cell centre. */
  cx: number;
  cy: number;
}

export interface MapLayout {
  size: number;
  /** Px per registry unit after the span clamp. */
  scale: number;
  /** Distance between adjacent cell centres, px. */
  step: number;
  /** Top-left of the grid frame and its side length, px. */
  frame: { x: number; y: number; span: number };
  points: MapPoint[];
  /** Every cell centre, for the cell-number labels' placement. */
  cellOrigin: (col: number, row: number) => Pt;
}

export function gridScale(size: number): number {
  // Centres span 60 units; the frame adds half a step each side: 60 * size / (size - 1) units.
  const spanUnits = (60 * size) / (size - 1);
  return Math.min(GRID_MAX_PX_PER_UNIT, GRID_MAX_SPAN / spanUnits);
}

export function buildMapLayout(geometry: SigilGeometry, letters: string[]): MapLayout {
  const { gridConfig } = geometry;
  const size = gridConfig.size;
  const scale = gridScale(size);
  const toX = (u: number) => GRID_CENTER.x + (u - COORD_CENTER) * scale;
  const toY = (u: number) => GRID_CENTER.y + (u - COORD_CENTER) * scale;
  const step = ((COORD_MAX - COORD_MIN) / (size - 1)) * scale;
  const span = step * size;

  const points: MapPoint[] = geometry.points.map((p, i) => {
    const cell = p.cell;
    const centre = gridConfig.coords[cell];
    return {
      letter: letters[i] ?? geometry.letterNumbers[i]?.letter ?? '',
      number: geometry.letterNumbers[i]?.number ?? cell,
      cell,
      col: (cell - 1) % size,
      row: Math.floor((cell - 1) / size),
      x: toX(p.x),
      y: toY(p.y),
      cx: toX(centre.x),
      cy: toY(centre.y),
    };
  });

  return {
    size,
    scale,
    step,
    frame: { x: GRID_CENTER.x - span / 2, y: GRID_CENTER.y - span / 2, span },
    points,
    cellOrigin: (col, row) => ({
      x: GRID_CENTER.x - span / 2 + col * step,
      y: GRID_CENTER.y - span / 2 + row * step,
    }),
  };
}

// ---------------------------------------------------------------------------
// Hero fit
// ---------------------------------------------------------------------------

export interface HeroFit {
  /** Scale and centre such that `hero = (p - centre) * k`, relative to HERO. */
  k: number;
  cx: number;
  cy: number;
  /** Hero-relative vertices (offset from HERO). */
  points: Pt[];
}

export function fitHero(points: Pt[], size: number = HERO_SIZE, maxScale: number = HERO_MAX_SCALE): HeroFit {
  if (points.length === 0) return { k: 1, cx: 0, cy: 0, points: [] };

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const extent = Math.max(maxX - minX, maxY - minY, 1);
  const k = Math.min(size / extent, maxScale);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return { k, cx, cy, points: points.map((p) => ({ x: (p.x - cx) * k, y: (p.y - cy) * k })) };
}

/** Drops zero-length steps so a polyline never draws a dot where two letters share a cell. */
export function distinctSegments(points: Pt[]): Array<[Pt, Pt]> {
  const segments: Array<[Pt, Pt]> = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (Math.hypot(b.x - a.x, b.y - a.y) > 0.01) segments.push([a, b]);
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Drawn path
// ---------------------------------------------------------------------------

export const PAD = { x: 24, y: 205, w: 342, h: 510 } as const;

/** Where the cleaned drawing lands: the hero strokes, plus the map from raw pad space to hero. */
export interface DrawnHero {
  /** One polyline per pen stroke, hero-relative (offset from HERO). */
  strokes: Pt[][];
  /** Every vertex of the cleaned geometry, hero-relative. */
  vertices: Pt[];
  /** Raw pad-space strokes, for the settle animation. */
  raw: DrawnPoint[][];
  /** The same affine that produced the cleaned geometry, applied to a raw pad point. */
  rawToHero: (p: Pt) => Pt;
}

/**
 * Hero strokes for a drawn anchor. They come from the cleaned geometry that is actually sent for
 * styling (viewBox space, centred on 50,50), scaled so its 60-unit fit fills the 230 px hero. The
 * raw hand strokes travel to the same place with `rawToHero`, which composes the geometry's own
 * pad -> viewBox fit with that scale, so the settle and the cleaned line agree exactly.
 */
export function buildDrawnHero(
  geometry: { points: Array<Pt & { breakBefore?: boolean }>; fit: { centerX: number; centerY: number; scale: number } },
  raw: DrawnPoint[][],
  fitSize: number
): DrawnHero {
  const k = HERO_SIZE / fitSize;
  const toHero = (p: Pt): Pt => ({ x: (p.x - 50) * k, y: (p.y - 50) * k });

  const strokes: Pt[][] = [];
  geometry.points.forEach((p, i) => {
    if (i === 0 || p.breakBefore) strokes.push([]);
    strokes[strokes.length - 1].push(toHero(p));
  });

  const { centerX, centerY, scale } = geometry.fit;
  return {
    strokes,
    vertices: strokes.flat(),
    raw: raw.filter((stroke) => stroke.length >= 2),
    rawToHero: (p) => ({ x: (p.x - centerX) * scale * k, y: (p.y - centerY) * scale * k }),
  };
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
];

/** How each intention type is named on screen: by what it is for, never by the grid's origin. */
const FIELD_LABELS: Record<string, string> = {
  desire: 'Desire',
  health: 'Health',
  career: 'Career',
  relationships: 'Relationship',
  creativity: 'Creativity',
  spirituality: 'Spirituality',
  abundance: 'Abundance',
  family: 'Family',
  learning: 'Learning',
  adventure: 'Adventure',
};

/**
 * The single line that teaches the field system: each type of intention has its own number square
 * (its field), and the line is drawn on that one. Custom intentions have no type to name.
 */
export function fieldLineText(category: string): string {
  const label = FIELD_LABELS[category];
  if (!label) return 'Your intention takes shape on its own field.';
  return `${label} intentions take shape on the ${label} field.`;
}

export function proofLineText(letterCount: number, drawn: boolean): string {
  if (drawn) return 'Drawn by you. Only yours.';
  const word = letterCount <= 20 ? NUMBER_WORDS[letterCount] : String(letterCount);
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} letters. One line. Only yours.`;
}
