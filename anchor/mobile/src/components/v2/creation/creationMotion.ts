/**
 * Motion and layout arithmetic for the creation flow, kept out of the components so it can be
 * tested without a renderer and tuned from one place.
 *
 * Durations are wall-clock milliseconds. Creation runs once per Anchor and exists to be
 * watched, so it is paced for a phone held at arm's length, not for a desktop prototype.
 *
 * Motion hierarchy (fast → slow): small UI responses (`AnchorMotion.duration.micro`), scene
 * swaps (`CREATION_TIMING.swap*`), methodology transformations (distillation, mapping), and
 * the construction itself, which is the slowest thing in the flow on purpose.
 */
import { Easing, ReduceMotion, withDelay, withRepeat, withSequence, withTiming, type WithTimingConfig } from 'react-native-reanimated';

import { AnchorMotion } from '@/theme/v2';
import type { AnchorPoint } from '@/components/v2/anchor/anchorStructure';

export const CREATION_EASING = {
  /** Deliberate transitions: headline swaps, panels, the mark changing place. */
  deliberate: AnchorMotion.easing.standard,
  /** Things arriving: grid, captions, candidates. */
  enter: AnchorMotion.easing.enter,
  /** Things leaving. */
  exit: AnchorMotion.easing.exit,
  /** A letter travelling to its cell: leaves gently, lands softly. */
  travel: Easing.bezier(0.33, 0, 0.2, 1),
} as const;

/**
 * Creation's reduced-motion decision is the app's (`useV2ReduceMotion`, which honours the
 * in-app override). Reanimated's default instead follows the OS flag, which on Android is also
 * set when the animator duration scale is 0 — and then every `withTiming` jumps straight to its
 * end while the JS timers still advance, so formation looked finished the instant it began.
 * Every creation animation therefore opts out of the implicit check; reduced motion is handled
 * explicitly by the components.
 */
export function creationTiming(toValue: number, config: Omit<WithTimingConfig, 'reduceMotion'> = {}, callback?: (finished?: boolean) => void) {
  'worklet';
  return withTiming(toValue, { ...config, reduceMotion: ReduceMotion.Never }, callback);
}

/**
 * The modifiers carry their own reduce-motion check, independent of the timing inside them;
 * left at the default, the OS flag still collapses the delay, the sequence or the repeat.
 */
export function creationDelay(delayMs: number, animation: number): number {
  'worklet';
  return withDelay(delayMs, animation, ReduceMotion.Never);
}

export function creationSequence(...animations: number[]): number {
  'worklet';
  return withSequence(ReduceMotion.Never, ...animations);
}

export function creationRepeat(animation: number, reverse = true): number {
  'worklet';
  return withRepeat(animation, -1, reverse, undefined, ReduceMotion.Never);
}

export const CREATION_TIMING = {
  /** Headline and panel crossfade: out, then in. */
  swapOut: 180,
  swapIn: 260,
  /** Distillation's settled letters are held this long before formation takes them. */
  distillHold: 700,
  /** The mark changing place or size between steps. */
  stageFit: 520,
  /** Selecting an expression: the large structure adopting it. */
  expressionBlend: 420,
  /** Creation chrome leaving before the hand-off to Home. */
  handoffFade: 320,
  /** The chosen Anchor resolving into its circle before it travels. */
  handoffResolve: 760,
  /** Longest creation waits for Home to be staged underneath before it lets go anyway. */
  handoffWait: 900,
} as const;

/**
 * Pace multiplier for the ceremonial stages. The first Anchor is watched at full length; a
 * repeat creation may be tightened here without touching any component.
 */
export const CREATION_PACE = { first: 1, repeat: 1 } as const;

export const FORMATION_TIMING = {
  /** The square emerges behind the letters while they lift to make room. */
  gridIn: 1000,
  /** Letters leave the row for their cells one after another. */
  mapStagger: 320,
  mapTravel: 680,
  /** Longest the whole mapping may take, however many letters there are. */
  mapMax: 3000,
  /** Every point placed, before the line begins. */
  mapHold: 420,
  /** The construction: the line joining the points, in order. */
  constructMin: 2800,
  constructMax: 4200,
  constructPerSegment: 520,
  /** The line pauses at each point before it leaves for the next. */
  vertexPause: 180,
  /** Completed geometry holds, grid still behind it. */
  breathe: 900,
  /** Grid recedes, colour arrives, the mark settles. */
  recede: 1000,
  /** Reduced motion: staged opacity, no travel, no tracing. */
  reducedTotal: 1000,
  /** A tap during formation finishes it this quickly rather than skipping it. */
  hurry: 520,
} as const;

/**
 * Everything formation does, as fractions of one progress value (0 → 1). Every layer — the
 * square, the travelling letters, the points, the line, the colour — reads this one timeline,
 * so the choreography cannot drift apart and a replay or a hurry is a single animation.
 */
export interface FormationTimeline {
  total: number;
  gridEnd: number;
  /** Per vertex: when its letter leaves the row and when it lands on its cell. */
  departures: number[];
  landings: number[];
  constructStart: number;
  constructEnd: number;
  /** Per vertex: when the line reaches it. */
  vertexArrivals: number[];
  /**
   * The construction clock: progress → share of the path drawn. Holds at each vertex for the
   * pause, eases through each segment. `clockIn` ascends; `clockOut` is the path fraction.
   */
  clockIn: number[];
  clockOut: number[];
  /** Colour arrives and the construction recedes from here. */
  settleStart: number;
}

/** Cumulative share of the path's length at each vertex. */
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
 * The formation timeline for a structure's vertices.
 *
 * Construction time is shared between segments by length, with a floor so a short segment is
 * still seen being drawn rather than blinking into place; the line then waits briefly at each
 * point it reaches, which is what lets the eye follow it from point to point in order.
 */
export function formationTimeline(vertices: AnchorPoint[], pace = 1): FormationTimeline {
  const count = vertices.length;
  const t = (ms: number) => ms * pace;
  const gridIn = t(FORMATION_TIMING.gridIn);

  const stagger = count > 1
    ? Math.min(t(FORMATION_TIMING.mapStagger), (t(FORMATION_TIMING.mapMax) - t(FORMATION_TIMING.mapTravel)) / (count - 1))
    : 0;
  const mapping = count > 0 ? stagger * (count - 1) + t(FORMATION_TIMING.mapTravel) : 0;
  const mapHold = t(FORMATION_TIMING.mapHold);

  const segments = Math.max(0, count - 1);
  const pause = t(FORMATION_TIMING.vertexPause);
  const construct = segments === 0
    ? pause * 2
    : Math.min(t(FORMATION_TIMING.constructMax), Math.max(t(FORMATION_TIMING.constructMin), segments * t(FORMATION_TIMING.constructPerSegment) + (segments + 1) * pause));
  const breathe = t(FORMATION_TIMING.breathe);
  const recede = t(FORMATION_TIMING.recede);
  const total = gridIn + mapping + mapHold + construct + breathe + recede;

  const at = (ms: number) => ms / total;
  const departures: number[] = [];
  const landings: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const leave = gridIn + stagger * i;
    departures.push(at(leave));
    landings.push(at(leave + t(FORMATION_TIMING.mapTravel)));
  }

  const constructStartMs = gridIn + mapping + mapHold;
  const fractions = vertexArrivalFractions(vertices);
  const clockIn: number[] = [at(constructStartMs)];
  const clockOut: number[] = [0];
  const vertexArrivals: number[] = count > 0 ? [at(constructStartMs)] : [];

  if (segments > 0) {
    const drawBudget = Math.max(0, construct - (segments + 1) * pause);
    const lengths = fractions.slice(1).map((fraction, index) => fraction - fractions[index]);
    const floor = 1 / segments / 3;
    const weights = lengths.map((length) => Math.max(length, floor));
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    let cursor = constructStartMs + pause;
    clockIn.push(at(cursor));
    clockOut.push(0);
    for (let k = 0; k < segments; k += 1) {
      cursor += (drawBudget * weights[k]) / weightSum;
      clockIn.push(at(cursor));
      clockOut.push(fractions[k + 1]);
      vertexArrivals.push(at(cursor));
      if (k < segments - 1) {
        cursor += pause;
        clockIn.push(at(cursor));
        clockOut.push(fractions[k + 1]);
      }
    }
  } else {
    clockIn.push(at(constructStartMs + construct));
    clockOut.push(1);
  }
  const constructEndMs = constructStartMs + construct;

  return {
    total,
    gridEnd: at(gridIn),
    departures,
    landings,
    constructStart: at(constructStartMs),
    constructEnd: at(constructEndMs),
    vertexArrivals,
    clockIn,
    clockOut,
    settleStart: at(constructEndMs + breathe),
  };
}

/** Reduced motion: the same stages, presented by opacity with no travel and no tracing. */
export function reducedFormationTimeline(vertexCount: number): FormationTimeline {
  const landings = Array.from({ length: vertexCount }, () => 0.3);
  return {
    total: FORMATION_TIMING.reducedTotal,
    gridEnd: 0.2,
    departures: landings.map(() => 0.2),
    landings,
    constructStart: 0.35,
    constructEnd: 0.55,
    vertexArrivals: landings.map(() => 0.55),
    clockIn: [0.35, 0.55],
    clockOut: [0, 1],
    settleStart: 0.65,
  };
}

/**
 * The share of the path drawn at `progress`. Within a segment the pen eases in and out, so it
 * visibly leaves one point and arrives at the next; between segments it holds.
 */
export function constructionFraction(progress: number, clockIn: number[], clockOut: number[]): number {
  'worklet';
  const last = clockIn.length - 1;
  if (last < 0) return 1;
  if (progress <= clockIn[0]) return clockOut[0];
  if (progress >= clockIn[last]) return clockOut[last];
  for (let i = 0; i < last; i += 1) {
    const a = clockIn[i];
    const b = clockIn[i + 1];
    if (progress >= a && progress <= b) {
      const span = b - a;
      const local = span <= 0 ? 1 : (progress - a) / span;
      const eased = local < 0.5 ? 2 * local * local : 1 - Math.pow(-2 * local + 2, 2) / 2;
      return clockOut[i] + (clockOut[i + 1] - clockOut[i]) * eased;
    }
  }
  return clockOut[last];
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

/* ── generation ───────────────────────────────────────────────────────────── */

/**
 * The development sequence played while the interpretations are made. It is not a progress
 * bar: nothing here claims how far the server has got. It covers ordinary latency with the
 * structure taking on its expression, then rests in a still "developing" state for as long as
 * the work really takes, and only reveals what actually exists.
 */
export const GENERATION_TIMING = {
  /** The structure re-drawn in plain ink: it is the thing being developed. */
  structure: 1500,
  /** The chosen expression settles onto it. */
  expression: 2200,
  /** The circle it will live in forms around it. */
  surface: 1400,
  /** Shortest the sequence runs before a finished result may be revealed. */
  minimumBeforeReveal: 5200,
  /** After this, the copy says honestly that it is taking longer. */
  extendedAfter: 14000,
  /** Candidates emerging from the one structure. */
  reveal: 1100,
  /** Longest we wait for the finished images to decode before revealing anyway. */
  imageWait: 6000,
} as const;

/* ── sizing ───────────────────────────────────────────────────────────────── */

export const MARK_SIZE_MIN = 220;
export const MARK_SIZE_MAX = 460;

/**
 * Share of the structure's 100-unit box the drawing can reach. Grids span 20–80 with ±2 of
 * hand-drawn jitter; the rest of the box is paper, so the box is fitted by this core, not by
 * its edges.
 */
export const MARK_CORE = 0.8;

/** Share of the box the Kamea square occupies while it is on screen (it reaches ~5–95). */
export const KAMEA_CORE = 0.92;

/** Share of a paper disc the mark occupies (CircularAnchorRenderer's paper artwork). */
export const PAPER_ART_SHARE = 0.72;

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

/** Scale that fits `core` (a fraction of the mark box) into the room the current step has. */
export function stageFitScale(stage: { width: number; height: number }, markSize: number, core = MARK_CORE): number {
  if (stage.width <= 0 || stage.height <= 0 || markSize <= 0) return 1;
  const drawn = markSize * core;
  return Math.max(0.24, Math.min(1, (stage.height * 0.96) / drawn, (stage.width * 1.0) / drawn));
}

/** How much of expression `index` shows at blend `position`: fully at its own index, none one away. */
export function expressionLayerOpacity(position: number, index: number): number {
  'worklet';
  return Math.min(1, Math.max(0, 1 - Math.abs(position - index)));
}
