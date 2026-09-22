/**
 * Motion and layout arithmetic for the creation flow, kept out of the components so it can be
 * tested without a renderer and tuned from one place.
 *
 * Durations are wall-clock milliseconds. Formation runs once per Anchor and exists to be
 * watched, so it is paced for a phone held at arm's length, not for a desktop prototype.
 */
import { Easing } from 'react-native-reanimated';

import { AnchorMotion } from '@/theme/v2';
import type { AnchorPoint } from '@/components/v2/anchor/anchorStructure';

export const CREATION_EASING = {
  /** Deliberate transitions: headline swaps, panels, the mark shrinking for Destination. */
  deliberate: AnchorMotion.easing.standard,
  /** Things arriving: grid, captions, the rail. */
  enter: AnchorMotion.easing.enter,
  /** The path being drawn: steady through the middle, gentle at both ends. */
  trace: Easing.bezier(0.45, 0.05, 0.35, 1),
} as const;

export const CREATION_TIMING = {
  /** Headline and panel crossfade: out, then in. */
  swapOut: 150,
  swapIn: 220,
  /** Distillation's settled letters are held this long before formation takes them. */
  distillHold: 650,
  /** Destination shrink and keyboard response. */
  stageFit: 320,
  /** Creation chrome leaving before the hand-off to Home. */
  handoffFade: 280,
  /** Longest creation waits for Home to be staged underneath before it lets go anyway. */
  handoffWait: 900,
} as const;

export const FORMATION_TIMING = {
  /** Grid arrives and the letters lift to make room. */
  gridIn: 700,
  /** Path time per point, bounded so short and long intentions both read. */
  perVertex: 320,
  pathMin: 1400,
  pathMax: 3200,
  /** Colour arrives, the grid recedes, the mark settles. */
  settle: 1000,
  /** Reduced motion: staged opacity, no tracing. */
  reducedTotal: 900,
  /** A tap during formation finishes it this quickly rather than skipping it. */
  hurry: 420,
} as const;

export interface FormationTimeline {
  total: number;
  /** Fractions of `total`. */
  gridEnd: number;
  pathStart: number;
  pathEnd: number;
}

export function formationTimeline(vertexCount: number): FormationTimeline {
  const path = Math.min(FORMATION_TIMING.pathMax, Math.max(FORMATION_TIMING.pathMin, vertexCount * FORMATION_TIMING.perVertex));
  const total = FORMATION_TIMING.gridIn + path + FORMATION_TIMING.settle;
  const pathStart = FORMATION_TIMING.gridIn / total;
  const pathEnd = (FORMATION_TIMING.gridIn + path) / total;
  return { total, gridEnd: pathStart, pathStart, pathEnd };
}

/**
 * When the traced line reaches each vertex, as a fraction of the whole path. The trace runs
 * at constant speed along the path, so a vertex is reached when its share of length is drawn.
 */
export function vertexArrivalFractions(vertices: AnchorPoint[]): number[] {
  if (vertices.length === 0) return [];
  const cumulative = [0];
  for (let i = 1; i < vertices.length; i += 1) {
    cumulative.push(cumulative[i - 1] + Math.hypot(vertices[i].x - vertices[i - 1].x, vertices[i].y - vertices[i - 1].y));
  }
  const total = cumulative[cumulative.length - 1];
  if (total <= 0) return vertices.map((_, index) => (vertices.length === 1 ? 0 : index / (vertices.length - 1)));
  return cumulative.map((length) => length / total);
}

/**
 * Pair each distilled letter with the vertex it became. The generator re-applies the
 * reduction rules to the letters it is given, so a letter can occasionally produce no point;
 * such a letter maps to -1 and is simply not highlighted.
 */
export function letterVertexIndexes(letters: string[], vertexLetters: Array<string | null>): number[] {
  let cursor = 0;
  return letters.map((letter) => {
    for (let i = cursor; i < vertexLetters.length; i += 1) {
      if (vertexLetters[i] === letter) {
        cursor = i + 1;
        return i;
      }
    }
    return -1;
  });
}

/* ── sizing ───────────────────────────────────────────────────────────────── */

export const MARK_SIZE_MIN = 220;
export const MARK_SIZE_MAX = 460;

/**
 * Share of the structure's 100-unit box the drawing can reach. Grids span 20–80 with ±2 of
 * hand-drawn jitter, and the widest treatment (architectural guides) reaches ~11–89; the rest
 * of the box is always empty paper, so the box is fitted by this core, not by its edges.
 */
export const MARK_CORE = 0.8;

/**
 * The Anchor's full size on this device, as the side of its 100-unit box. Derived from the
 * viewport rather than a stage measurement, so it is stable across steps; each step then fits
 * it with a scale.
 */
export function creationMarkSize({ width, usableHeight }: { width: number; usableHeight: number; gutter?: number }): number {
  const byWidth = width * 1.02;
  const byHeight = usableHeight * 0.52;
  return Math.round(Math.min(MARK_SIZE_MAX, Math.max(MARK_SIZE_MIN, Math.min(byWidth, byHeight))));
}

/** Scale that fits the mark's drawn core into whatever room the current step's stage has. */
export function stageFitScale(stage: { width: number; height: number }, markSize: number): number {
  if (stage.width <= 0 || stage.height <= 0 || markSize <= 0) return 1;
  const core = markSize * MARK_CORE;
  return Math.max(0.24, Math.min(1, (stage.height * 0.96) / core, (stage.width * 1.0) / core));
}

/* ── expression rail ──────────────────────────────────────────────────────── */

export const RAIL = {
  /** Centre-to-centre distance between rail items. */
  itemWidth: 84,
  /** Rendered size of an item's mark (its whole box; the drawn mark fills ~60% of it). */
  thumbSize: 64,
  /** How far a flick carries, in seconds of velocity. */
  projection: 0.16,
  /** Resistance past either end of the rail. */
  rubberBand: 0.3,
  spring: AnchorMotion.spring.carousel,
} as const;

/** Rail position (in items) while the finger holds it, resisted past either end. */
export function railDragPosition(startPosition: number, translationX: number, count: number): number {
  'worklet';
  const raw = startPosition - translationX / RAIL.itemWidth;
  const max = Math.max(0, count - 1);
  if (raw < 0) return raw * RAIL.rubberBand;
  if (raw > max) return max + (raw - max) * RAIL.rubberBand;
  return raw;
}

/** Where a released rail comes to rest: the flick's projection, snapped to an item. */
export function railRestIndex(position: number, velocityX: number, count: number): number {
  'worklet';
  const projected = position - (velocityX / RAIL.itemWidth) * RAIL.projection;
  return Math.min(Math.max(0, count - 1), Math.max(0, Math.round(projected)));
}

/** How much of expression `index` shows at rail `position`: fully at its own item, none one item away. */
export function expressionLayerOpacity(position: number, index: number): number {
  'worklet';
  return Math.min(1, Math.max(0, 1 - Math.abs(position - index)));
}
