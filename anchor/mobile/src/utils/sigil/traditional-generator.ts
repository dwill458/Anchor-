import { logger } from '@/utils/logger';
import { PlanetaryTier } from '@/types';
import { getGridConfig, GridConfig } from './gridRegistry';

/**
 * TRUE Sigil Generator - Planetary Grid Method (Kamea)
 * * ARCHITECTURE CHANGE:
 * Instead of overlapping full letter vectors (which creates "noise"),
 * this version uses the traditional "Magic Square" technique:
 * 1. Reduces intent (removes vowels/duplicates).
 * 2. Maps letters to a 3x3 numerology grid.
 * 3. Draws a single continuous "path of power" connecting the points.
 * 4. Applies SVG filters for a hand-drawn ink aesthetic.
 */

export type SigilVariant = 'dense' | 'balanced' | 'minimal';

export interface SigilGenerationResult {
  svg: string;
  variant: SigilVariant;
}

const EMPTY_SIGIL_SVG = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"></svg>';
const SIGIL_RESULT_CACHE = new Map<string, SigilGenerationResult>();

// ---------------------------------------------------------------------------
// 1. TRADITIONAL MAPPING LOGIC
// ---------------------------------------------------------------------------

// Pythagorean Numerology Mapping (1-9)
export function letterToNumber(letter: string, maxValue: number): number {
  const code = letter.toUpperCase().charCodeAt(0) - 64; // A=1, B=2, ..., Z=26
  if (code < 1 || code > 26) return 1;

  if (maxValue >= 26) return code;

  if (maxValue === 9) {
    let sum = code;
    while (sum > 9) {
      sum = String(sum).split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0);
    }
    return sum;
  }

  return ((code - 1) % maxValue) + 1;
}

// ---------------------------------------------------------------------------
// 2. HELPER FUNCTIONS
// ---------------------------------------------------------------------------

function normalizeLettersInput(letters: unknown): string {
  const rawText = Array.isArray(letters)
    ? letters.join('')
    : typeof letters === 'string'
      ? letters
      : '';

  return rawText.toUpperCase().replace(/[^A-Z]/g, '');
}

/** One point of the path: the letter it came from and the grid cell that letter reduces to. */
interface IntentPoint {
  /** Null only for the empty-input centre fallback. */
  letter: string | null;
  value: number;
}

/**
 * Clean and reduce the intent string (Austin Osman Spare method)
 */
function processIntent(rawText: string, variant: SigilVariant, maxValue: number): IntentPoint[] {
  if (!rawText) return [{ letter: null, value: Math.ceil(maxValue / 2) || 1 }]; // Fallback to center point

  let processed = rawText;

  // Step 1: Remove Vowels (unless string is too short)
  if (processed.length > 3) {
    processed = processed.replace(/[AEIOU]/g, '');
  }

  // Step 2: Remove Duplicates (Classic Sigil logic)
  processed = Array.from(new Set(processed.split(''))).join('');

  // Step 3: Map to numbers
  let points = processed.split('').map(char => ({ letter: char, value: letterToNumber(char, maxValue) }));

  // Variant Logic:
  // Minimal: Simplify path further if too long
  if (variant === 'minimal' && points.length > 5) {
    points = points.filter((_, i) => i % 2 === 0);
  }

  return points;
}

function createSeed(input: string): number {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededUnit(seed: number, salt: number): number {
  let value = (seed ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 2246822507);
  value = Math.imul(value ^ (value >>> 13), 3266489909);
  value ^= value >>> 16;
  return value / 4294967295;
}

/**
 * Add deterministic "hand-drawn" imperfections to a point.
 * Stable output keeps repeated renders cacheable and avoids XML churn.
 */
function jitter(val: number, seed: number, salt: number, intensity: number = 2): number {
  const offset = seededUnit(seed, salt) * intensity - intensity / 2;
  return Number((val + offset).toFixed(2));
}

/** A drawn vertex: where on the page the letter's grid cell landed, after the hand-drawn jitter. */
export interface SigilVertex {
  letter: string | null;
  /** The grid cell (1..maxValue) the letter reduced to. */
  value: number;
  /** The undisturbed centre of that cell. */
  cell: { x: number; y: number };
  /** The point the path actually passes through. */
  x: number;
  y: number;
}

/**
 * Place each reduced letter on its grid cell, in order. The path data is built from exactly
 * these vertices, so anything that draws or explains the path draws the real one.
 */
function placeVertices(points: IntentPoint[], seed: number, gridConfig: GridConfig): SigilVertex[] {
  if (points.length === 0) return [];

  const start = gridConfig.coords[points[0].value];
  if (!start) return [];

  const vertices: SigilVertex[] = [
    { letter: points[0].letter, value: points[0].value, cell: start, x: jitter(start.x, seed, 1), y: jitter(start.y, seed, 2) },
  ];

  for (let i = 1; i < points.length; i++) {
    const curr = gridConfig.coords[points[i].value];
    if (curr) {
      const saltBase = i * 2 + 1;
      vertices.push({ letter: points[i].letter, value: points[i].value, cell: curr, x: jitter(curr.x, seed, saltBase), y: jitter(curr.y, seed, saltBase + 1) });
    }
  }

  return vertices;
}

// ---------------------------------------------------------------------------
// Sharp-turn relaxation (long Desire paths)
// ---------------------------------------------------------------------------

/** Paths with at least this many letters can fold back on themselves into a tight cluster. */
export const SHARP_TURN_MIN_LETTERS = 11;
/** The narrowest angle, in degrees, two consecutive segments may close to. */
export const MIN_SEGMENT_ANGLE_DEG = 20;

/** The interior angle at vertex b between the segments to a and c, in degrees (0 = folded flat). */
export function interiorAngleDeg(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  const ux = a.x - b.x;
  const uy = a.y - b.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const lu = Math.hypot(ux, uy);
  const lv = Math.hypot(vx, vy);
  if (lu < 1e-6 || lv < 1e-6) return 180;
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Opens hairpins in a long path. Every letter keeps its own cell and order — the vertex is only
 * allowed to wander inside the middle of that cell — so the letter -> number -> path story the flow
 * tells stays true. A vertex whose two segments close tighter than {@link MIN_SEGMENT_ANGLE_DEG}
 * has its neighbours pushed apart sideways until they clear it. Deterministic, bounded passes;
 * a fold the cells cannot open is left as it is. Paths under {@link SHARP_TURN_MIN_LETTERS} letters
 * are returned untouched.
 */
export function relaxSharpTurns(vertices: SigilVertex[], gridConfig: GridConfig): SigilVertex[] {
  if (vertices.length < SHARP_TURN_MIN_LETTERS) return vertices;

  const cellStep = 60 / (gridConfig.size - 1);
  const maxShift = Math.max(0, cellStep / 2 - 0.75);
  const out = vertices.map((vertex) => ({ ...vertex }));
  const clampTo = (value: number, centre: number) => Math.min(centre + maxShift, Math.max(centre - maxShift, value));

  for (let pass = 0; pass < 16; pass += 1) {
    let changed = false;
    for (let i = 1; i < out.length - 1; i += 1) {
      const a = out[i - 1];
      const b = out[i];
      const c = out[i + 1];
      if (interiorAngleDeg(a, b, c) >= MIN_SEGMENT_ANGLE_DEG + 1) continue;

      const la = Math.hypot(a.x - b.x, a.y - b.y);
      const lc = Math.hypot(c.x - b.x, c.y - b.y);
      if (la < 1e-6 || lc < 1e-6) continue;
      // Perpendicular to the way the fold points: a goes one side of it, c the other.
      let ux = (a.x - b.x) / la + (c.x - b.x) / lc;
      let uy = (a.y - b.y) / la + (c.y - b.y) / lc;
      const lu = Math.hypot(ux, uy);
      if (lu < 1e-6) continue;
      ux /= lu;
      uy /= lu;
      const px = -uy;
      const py = ux;
      const nudge = maxShift * 0.5;

      // Each neighbour moves away from the fold's axis, to the side it already lies on.
      const sideOf = (v: SigilVertex, fallback: number) => {
        const d = (v.x - b.x) * px + (v.y - b.y) * py;
        return Math.abs(d) < 1e-6 ? fallback : Math.sign(d);
      };
      const moves: Array<[SigilVertex, number]> = [[a, sideOf(a, 1)], [c, sideOf(c, -1)]];
      moves.forEach(([vertex, side]) => {
        const nx = Number(clampTo(vertex.x + px * nudge * side, vertex.cell.x).toFixed(2));
        const ny = Number(clampTo(vertex.y + py * nudge * side, vertex.cell.y).toFixed(2));
        if (nx !== vertex.x || ny !== vertex.y) changed = true;
        vertex.x = nx;
        vertex.y = ny;
      });
    }
    if (!changed) break;
  }

  return out;
}

/**
 * Generate the SVG Path Data (d attribute)
 */
function createSigilPath(vertices: SigilVertex[]): string {
  if (vertices.length === 0) return '';
  const [first, ...rest] = vertices;
  return rest.reduce((path, vertex) => `${path} L ${vertex.x},${vertex.y}`, `M ${first.x},${first.y}`);
}

// ---------------------------------------------------------------------------
// 3. SVG COMPONENT GENERATORS
// ---------------------------------------------------------------------------

function createBorder(variant: SigilVariant): string {
  if (variant === 'minimal' || variant === 'balanced') return ''; // No border for minimal and balanced

  // "Hand-drawn" circle approximation
  const r = 44; // Increased from 42 to fit 20-80 grid comfortably
  const c = 50;
  // A slightly imperfect circle path
  const d = `
    M ${c + r},${c} 
    Q ${c + r},${c + r} ${c},${c + r} 
    Q ${c - r},${c + r} ${c - r},${c} 
    Q ${c - r},${c - r} ${c},${c - r} 
    Q ${c + r},${c - r} ${c + r},${c}
  `;

  // Dense ("Contained") is defined by one hand-drawn perimeter holding the
  // mark. It used to add a second, perfectly geometric ring outside it; that
  // double ring is what made the form read as a ceremonial seal rather than a
  // personal mark, so only the imperfect perimeter remains. The intention-
  // derived path is untouched. Already-saved Anchors keep their stored SVG.
  return `<path d="${d}" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.8" />`;
}

// ---------------------------------------------------------------------------
// 4. MAIN EXPORT
// ---------------------------------------------------------------------------

function calculateStrokeWidth(tier: PlanetaryTier, variant: SigilVariant, gridConfig: GridConfig): number {
  const baseDensity: Record<number, Record<SigilVariant, number>> = {
    3: { dense: 3, balanced: 2, minimal: 1.5 },
    4: { dense: 2.5, balanced: 1.8, minimal: 1.2 },
    5: { dense: 2, balanced: 1.5, minimal: 1 },
    6: { dense: 1.8, balanced: 1.3, minimal: 0.9 },
    7: { dense: 1.5, balanced: 1.1, minimal: 0.7 }
  };
  return baseDensity[gridConfig.size]?.[variant] ?? 2;
}

/**
 * The formation of one sigil, laid bare: the grid it was drawn on, each letter's cell and
 * vertex in drawing order, and the SVG that results. `svg` is byte-identical to
 * `generateTrueSigil` for the same input — this is the same computation, not a re-creation.
 */
export interface SigilFormation extends SigilGenerationResult {
  tier: PlanetaryTier;
  /** Cells per side of the grid (3 for Saturn … 7 for Venus). */
  gridSize: number;
  /** Every cell centre on the grid, ordered by cell number. */
  gridCells: Array<{ value: number; x: number; y: number }>;
  vertices: SigilVertex[];
  pathData: string;
  strokeWidth: number;
  /** True when the variant adds the hand-drawn perimeter around the path. */
  hasPerimeter: boolean;
}

const SIGIL_FORMATION_CACHE = new Map<string, SigilFormation>();

export function describeTrueSigil(
  letters: any,
  tier: PlanetaryTier = PlanetaryTier.SATURN,
  variant: SigilVariant = 'balanced'
): SigilFormation {
  const normalizedLetters = normalizeLettersInput(letters);
  const cacheKey = `${tier}:${variant}:${normalizedLetters || 'CENTER'}`;
  const cachedFormation = SIGIL_FORMATION_CACHE.get(cacheKey);

  if (cachedFormation) {
    return cachedFormation;
  }

  const gridConfig = getGridConfig(tier);

  // 1. Logic Layer
  const points = processIntent(normalizedLetters, variant, gridConfig.maxValue);

  // 2. Geometry Layer
  const seed = createSeed(cacheKey);
  // Desire (and Creativity) draw on the Sun field: its long paths are the ones that fold into clusters.
  const placed = placeVertices(points, seed, gridConfig);
  const vertices = tier === PlanetaryTier.SUN ? relaxSharpTurns(placed, gridConfig) : placed;
  const pathData = createSigilPath(vertices);

  const strokeWidth = calculateStrokeWidth(tier, variant, gridConfig);

  // Assemble
  // NOTE: Do not add <filter>, <marker>, or marker-start/marker-end here.
  // react-native-svg does not reliably support these and they cause crashes.
  const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" color="#FFFFFF"><g>${createBorder(variant)}<path d="${pathData}" stroke="currentColor" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" /></g></svg>`;

  const formation: SigilFormation = {
    svg,
    variant,
    tier,
    gridSize: gridConfig.size,
    gridCells: Object.entries(gridConfig.coords)
      .map(([value, point]) => ({ value: Number(value), x: point.x, y: point.y }))
      .sort((a, b) => a.value - b.value),
    vertices,
    pathData,
    strokeWidth,
    hasPerimeter: createBorder(variant) !== '',
  };

  SIGIL_FORMATION_CACHE.set(cacheKey, formation);

  return formation;
}

/**
 * The geometry of one sigil in the shape the creation flow animates: the real, jittered path
 * points (with the grid cell each landed in), the tier's grid, and the number each letter was
 * mapped to. A view over {@link describeTrueSigil} — the same computation `generateTrueSigil`
 * serialises, so what the flow draws is exactly what is sent for styling.
 */
export interface SigilGeometry {
  points: Array<{ x: number; y: number; cell: number }>;
  gridConfig: GridConfig;
  letterNumbers: Array<{ letter: string; number: number }>;
  /** Path `d` attribute, identical to the one inside the generated SVG. */
  pathData: string;
  strokeWidth: number;
}

export function getSigilGeometry(
  letters: any,
  tier: PlanetaryTier = PlanetaryTier.SATURN,
  variant: SigilVariant = 'balanced'
): SigilGeometry {
  const formation = describeTrueSigil(letters, tier, variant);
  return {
    points: formation.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y, cell: vertex.value })),
    gridConfig: getGridConfig(tier),
    letterNumbers: formation.vertices
      .filter((vertex): vertex is SigilVertex & { letter: string } => vertex.letter !== null)
      .map((vertex) => ({ letter: vertex.letter, number: vertex.value })),
    pathData: formation.pathData,
    strokeWidth: formation.strokeWidth,
  };
}

export function generateTrueSigil(
  letters: any,
  tier: PlanetaryTier = PlanetaryTier.SATURN,
  variant: SigilVariant = 'balanced'
): SigilGenerationResult {
  const normalizedLetters = normalizeLettersInput(letters);
  const cacheKey = `${tier}:${variant}:${normalizedLetters || 'CENTER'}`;
  const cachedResult = SIGIL_RESULT_CACHE.get(cacheKey);

  if (cachedResult) {
    return cachedResult;
  }

  const { svg } = describeTrueSigil(letters, tier, variant);
  const result = {
    svg,
    variant,
  };

  SIGIL_RESULT_CACHE.set(cacheKey, result);

  return result;
}

export function generateAllVariants(letters: any, tier: PlanetaryTier = PlanetaryTier.SATURN): SigilGenerationResult[] {
  try {
    return [
      generateTrueSigil(letters, tier, 'dense'),
      generateTrueSigil(letters, tier, 'balanced'),
      generateTrueSigil(letters, tier, 'minimal'),
    ];
  } catch (error) {
    logger.error('Error generating sigil variants:', error);
    // Return empty fallback array
    return [
      { svg: EMPTY_SIGIL_SVG, variant: 'dense' },
      { svg: EMPTY_SIGIL_SVG, variant: 'balanced' },
      { svg: EMPTY_SIGIL_SVG, variant: 'minimal' },
    ];
  }
}

export const VARIANT_METADATA = {
  dense: {
    title: 'Practice',
    description: 'Dense geometry held by one perimeter',
  },
  balanced: {
    title: 'Focused',
    description: 'Clear paths, steady center',
  },
  minimal: {
    title: 'Raw',
    description: 'Simplified path, open structure',
  },
};
