/**
 * Anchor expression: how an Anchor's structure appears.
 *
 * Structure stays yours; expression changes how it appears. Every treatment here is a pure,
 * deterministic description of layers drawn over the SAME stored path data — no layer is
 * allowed to carry its own geometry. Width, colour, offset and opacity change; the `d`
 * string never does. That is what keeps one Anchor unmistakably the same mark in every
 * expression, and what makes browsing expressions free: nothing is generated, fetched or
 * re-parsed.
 */
import {
  ANCHOR_EXPRESSIONS,
  CREATION_EXPRESSIONS,
  EXPRESSION_DESCRIPTIONS,
  EXPRESSION_LABELS,
  type AnchorExpression,
} from '@/constants/v2/creation';
import { colors } from '@/theme/v2/colors';

export type ExpressionPaint =
  /** The Anchor's category colour. */
  | { kind: 'category' }
  /** The category colour pulled toward ink — an engraved line. */
  | { kind: 'categoryDeep'; amount: number }
  | { kind: 'color'; color: string }
  /** The shared metallic foil gradient. */
  | { kind: 'foil' };

export interface ExpressionLayer {
  paint: ExpressionPaint;
  /** Multiplies each stroke's own stored width. */
  widthScale: number;
  opacity: number;
  /** Offset in viewBox units (the generator draws in a 100-unit box). */
  dx?: number;
  dy?: number;
  linecap?: 'round' | 'butt' | 'square';
  linejoin?: 'round' | 'miter' | 'bevel';
}

export interface ExpressionSpec {
  id: AnchorExpression;
  label: string;
  description: string;
  layers: ExpressionLayer[];
  /** Marks each vertex of a straight-segment mark: the points the letters became. */
  vertices?: { paint: ExpressionPaint; radiusScale: number; opacity: number; hollow?: boolean };
  /** Faint construction lines continuing each segment past its endpoints. */
  construction?: { paint: ExpressionPaint; widthScale: number; extend: number; opacity: number };
}

const INK = colors.ink.base;
const PAPER = colors.surface;

/** Foil stops: warm and restrained — a pressed metallic, not a glow. */
export const FOIL_STOPS = [
  { offset: 0, color: '#7D5F2C' },
  { offset: 0.28, color: '#C9A866' },
  { offset: 0.46, color: '#EFE0B4' },
  { offset: 0.62, color: '#B08A48' },
  { offset: 0.84, color: '#E2CB92' },
  { offset: 1, color: '#86652F' },
] as const;

const SPECS: Record<'original' | 'monoline' | 'architectural' | 'ink' | 'etched' | 'foil' | 'embossed' | 'cut_paper', Omit<ExpressionSpec, 'id' | 'label' | 'description'>> = {
  original: {
    layers: [{ paint: { kind: 'category' }, widthScale: 1, opacity: 1 }],
  },
  monoline: {
    layers: [{ paint: { kind: 'color', color: INK }, widthScale: 0.42, opacity: 1, linecap: 'square', linejoin: 'bevel' }],
    vertices: { paint: { kind: 'color', color: INK }, radiusScale: 0.62, opacity: 1 },
  },
  architectural: {
    construction: { paint: { kind: 'color', color: INK }, widthScale: 0.16, extend: 9, opacity: 0.3 },
    layers: [{ paint: { kind: 'color', color: INK }, widthScale: 0.55, opacity: 0.92, linecap: 'butt', linejoin: 'bevel' }],
    vertices: { paint: { kind: 'color', color: INK }, radiusScale: 1.25, opacity: 0.55, hollow: true },
  },
  ink: {
    layers: [
      // Bleed into the paper, then the body, then a dry drag along one edge.
      { paint: { kind: 'color', color: INK }, widthScale: 2.3, opacity: 0.08 },
      { paint: { kind: 'color', color: INK }, widthScale: 1.55, opacity: 0.94 },
      { paint: { kind: 'color', color: INK }, widthScale: 0.45, opacity: 0.3, dx: 0.45, dy: -0.35 },
    ],
    vertices: { paint: { kind: 'color', color: INK }, radiusScale: 0.95, opacity: 0.94 },
  },
  etched: {
    layers: [
      // Light caught on the lower lip of the cut, the cut itself, and its dark floor.
      { paint: { kind: 'color', color: '#FFFFFF' }, widthScale: 1.45, opacity: 0.85, dx: 0.3, dy: 0.42 },
      { paint: { kind: 'categoryDeep', amount: 0.55 }, widthScale: 1.25, opacity: 1 },
      { paint: { kind: 'categoryDeep', amount: 0.8 }, widthScale: 0.38, opacity: 0.7, dx: -0.12, dy: -0.16 },
    ],
  },
  foil: {
    layers: [
      { paint: { kind: 'color', color: INK }, widthScale: 1.2, opacity: 0.16, dx: 0.5, dy: 0.7 },
      { paint: { kind: 'foil' }, widthScale: 1.25, opacity: 1 },
      // A sheen along the lit edge, kept inside the stroke so it never reads as a second line.
      { paint: { kind: 'color', color: '#FFF8E6' }, widthScale: 0.22, opacity: 0.38, dx: -0.12, dy: -0.15 },
    ],
  },
  embossed: {
    layers: [
      // Blind emboss: a paper-coloured ridge lit from the upper left.
      { paint: { kind: 'color', color: INK }, widthScale: 2, opacity: 0.2, dx: 0.55, dy: 0.75 },
      { paint: { kind: 'color', color: '#FFFFFF' }, widthScale: 2, opacity: 0.95, dx: -0.45, dy: -0.55 },
      { paint: { kind: 'color', color: PAPER }, widthScale: 2, opacity: 1 },
    ],
  },
  cut_paper: {
    // Bevelled joins: a scissor cut, not a mitre. Acute corners in these paths would throw
    // mitred spikes far past the geometry.
    layers: [
      { paint: { kind: 'color', color: INK }, widthScale: 2.4, opacity: 0.22, dx: 0.9, dy: 1.3, linecap: 'butt', linejoin: 'bevel' },
      { paint: { kind: 'category' }, widthScale: 2.4, opacity: 1, linecap: 'butt', linejoin: 'bevel' },
      { paint: { kind: 'color', color: '#FFFFFF' }, widthScale: 0.24, opacity: 0.18, dx: -0.3, dy: -0.35, linecap: 'butt', linejoin: 'bevel' },
    ],
  },
};

/**
 * Stored expressions outside the creation rail render through their nearest treatment, so an
 * Anchor that already carries one of them is never shown blank or as something else entirely.
 */
const NEAREST: Record<AnchorExpression, keyof typeof SPECS> = {
  original: 'original',
  monoline: 'monoline',
  architectural: 'architectural',
  ink: 'ink',
  etched: 'etched',
  foil: 'foil',
  embossed: 'embossed',
  cut_paper: 'cut_paper',
  halo: 'original',
  glass: 'monoline',
  radiant: 'foil',
  organic: 'ink',
  woven: 'etched',
};

const RESOLVED = new Map<AnchorExpression, ExpressionSpec>();

export function expressionSpec(expression: AnchorExpression): ExpressionSpec {
  const cached = RESOLVED.get(expression);
  if (cached) return cached;
  const spec: ExpressionSpec = {
    id: expression,
    label: EXPRESSION_LABELS[expression],
    description: EXPRESSION_DESCRIPTIONS[expression],
    ...SPECS[NEAREST[expression]],
  };
  RESOLVED.set(expression, spec);
  return spec;
}

/** The expressions a new Anchor can be kept in, in rail order. */
export const CREATION_EXPRESSION_SPECS: readonly ExpressionSpec[] = CREATION_EXPRESSIONS.map(expressionSpec);

const LEGACY_ALIASES: Record<string, AnchorExpression> = { cutpaper: 'cut_paper', 'cut-paper': 'cut_paper' };

export function normalizeExpression(value: unknown): AnchorExpression {
  if (typeof value !== 'string') return 'original';
  const key = value.trim().toLowerCase();
  const aliased = LEGACY_ALIASES[key] ?? key;
  return (ANCHOR_EXPRESSIONS as readonly string[]).includes(aliased) ? (aliased as AnchorExpression) : 'original';
}

/** The expression an Anchor is kept in. It rides in `classifierMeta.v2Expression`. */
export function anchorExpressionOf(anchor: { classifierMeta?: Record<string, unknown> | null } | null | undefined): AnchorExpression {
  return normalizeExpression(anchor?.classifierMeta?.v2Expression);
}

/* ── paint resolution ─────────────────────────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Linear mix of two #RRGGBB colours; `amount` 0 = `from`, 1 = `to`. */
export function mixHex(from: string, to: string, amount: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  if (!a || !b) return from;
  const t = Math.min(1, Math.max(0, amount));
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/** A paint as an SVG stroke value. `foilRef` is the url() of this renderer's own gradient. */
export function resolvePaint(paint: ExpressionPaint, categoryColor: string, foilRef: string): string {
  switch (paint.kind) {
    case 'category':
      return categoryColor;
    case 'categoryDeep':
      return mixHex(categoryColor, INK, paint.amount);
    case 'foil':
      return foilRef;
    case 'color':
    default:
      return (paint as { color: string }).color;
  }
}

export function specUsesFoil(spec: ExpressionSpec): boolean {
  return spec.layers.some((layer) => layer.paint.kind === 'foil');
}
