/**
 * The choreography and geometry behind Letter Distillation.
 *
 * This module owns no methodology. The classification is the production
 * `buildDistillationRenderWords` (@/utils/sigil/distillation), which walks the same
 * first-occurrence-consonant rule as `distillIntention` — so the letters left standing on
 * screen are always the exact letters the sigil engine is handed. What is added here is
 * only what the animation needs and cannot get from the flat letter list: a cascade
 * position within the reduction passes, a slot among the survivors, the beat each pass
 * lands on, and the transform that carries a measured letter into its slot.
 *
 * Kept out of the flow component so the arithmetic can be tested without a renderer.
 */

import { Easing } from 'react-native-reanimated';

import {
  buildDistillationRenderWords,
  type DistillationRemovalStep,
} from '@/utils/sigil/distillation';

/** The prototypes' shared easing — `cubic-bezier(.2,.75,.2,1)`. */
export const DISTILL_EASING = Easing.bezier(0.2, 0.75, 0.2, 1);

/**
 * One continuous reduction of the phrase the user just wrote: hold it whole, drop the
 * vowels, drop the repeats, then physically close the gaps. `stage` is the beat between
 * passes, `letterFade`/`letterStagger` are the per-character opacity cascade inside a
 * pass, and `compact` is the translate that carries the survivors together.
 *
 * Deliberately slower than the prototype's 650ms `d`. This runs once per Anchor and the
 * whole point is that the user *watches* the reduction happen to their own words — at
 * prototype speed the two passes read as a single flicker and the travel is over before
 * the eye finds it. Every value below is a wall-clock millisecond, so the pace of the
 * screen is tuned here and nowhere else.
 */
export const DISTILL_TIMING = {
  /** Long enough to read your own sentence back before anything touches it. */
  holdWhole: 1100,
  /** Beat between passes, so "vowels gone" registers before the repeats start leaving. */
  stage: 1400,
  letterStagger: 26,
  /** A letter about to go first dims, so the eye sees which ones are leaving… */
  letterDim: 300,
  dimHold: 380,
  /** …and only then withdraws. */
  letterFade: 360,
  /** The travel is the moment the screen exists for; it gets the most room. */
  compact: 1000,
  /** Beat between the letters landing and formation taking them, so the row reads as settled. */
  settle: 450,
  /** Entrance for the settled caption, label and secondary action. */
  caption: 320,
  /** Reduced motion: show the phrase, then present the settled sequence outright. */
  reducedHold: 500,
} as const;

/** The reduction passes, in the order the user watches them. */
export const DISTILL_STAGES = ['whole', 'vowels', 'repeats', 'compact', 'settled'] as const;
export type DistillationStage = (typeof DISTILL_STAGES)[number];

/* ── render model ─────────────────────────────────────────────────────────── */

/** Characters-per-word budget used to order the cascade across word boundaries. */
const WORD_STRIDE = 4;

export interface DistillationCell {
  /** Uppercased display character, exactly as the production builder emits it. */
  char: string;
  /** True for a surviving letter — one of the distilled letters, in order. */
  keep: boolean;
  /** 1 = dropped with the vowels, 2 = dropped with the repeats, null = survives. */
  removalStep: DistillationRemovalStep | null;
  /** Cascade position, so a pass reads left to right across the whole phrase. */
  staggerIndex: number;
  /** Slot among the survivors — the compaction target — or -1 when removed. */
  keptIndex: number;
}

export interface DistillationWord {
  cells: DistillationCell[];
}

export interface DistillationRenderModel {
  /** Words keep their grouping so each one wraps as an unbreakable unit. */
  words: DistillationWord[];
  /** The surviving letters, in order — the same sequence `distillIntention` returns. */
  keptLetters: string[];
  /** How many letters survive, which is how many boxes the compaction waits to measure. */
  keptCount: number;
  /** The last cascade position, used to size a pass around a long phrase. */
  lastStaggerIndex: number;
}

/**
 * Shape an intention into the per-character model the reduction animation drives.
 * Punctuation and digits are carried through as step-1 removals, matching the production
 * builder, so nothing on screen is invented or silently dropped.
 */
export function buildDistillationRenderModel(text: string): DistillationRenderModel {
  const keptLetters: string[] = [];
  let lastStaggerIndex = 0;

  const words = buildDistillationRenderWords(text).map((word, wordIndex) => ({
    cells: word.chars.map((cell, charIndex): DistillationCell => {
      const keptIndex = cell.keep ? keptLetters.length : -1;
      if (cell.keep) keptLetters.push(cell.char);
      const staggerIndex = wordIndex * WORD_STRIDE + charIndex;
      if (staggerIndex > lastStaggerIndex) lastStaggerIndex = staggerIndex;
      return { char: cell.char, keep: cell.keep, removalStep: cell.removalStep, staggerIndex, keptIndex };
    }),
  }));

  return { words, keptLetters, keptCount: keptLetters.length, lastStaggerIndex };
}

/* ── stage schedule ───────────────────────────────────────────────────────── */

/**
 * When each pass starts, in milliseconds from the step appearing. A long phrase's cascade
 * has to finish before the next pass starts on top of it, so a pass is never shorter than
 * the cascade it contains.
 */
export function distillationSchedule(lastStaggerIndex: number): Record<Exclude<DistillationStage, 'whole'>, number> {
  const cascade = lastStaggerIndex * DISTILL_TIMING.letterStagger + DISTILL_TIMING.letterDim + DISTILL_TIMING.dimHold + DISTILL_TIMING.letterFade;
  const pass = Math.max(DISTILL_TIMING.stage, cascade);
  const vowels = DISTILL_TIMING.holdWhole;
  const repeats = vowels + pass;
  const compact = repeats + pass;
  return { vowels, repeats, compact, settled: compact + DISTILL_TIMING.compact + DISTILL_TIMING.settle };
}

/** Whether a character has been dropped yet, given the pass currently on screen. */
export function isCellRemoved(cell: DistillationCell, stage: DistillationStage): boolean {
  if (cell.keep) return false;
  if (cell.removalStep === 1) return stage !== 'whole';
  return stage === 'repeats' || stage === 'compact' || stage === 'settled';
}

/* ── compaction geometry ──────────────────────────────────────────────────── */

/** A measured surviving letter: its box relative to the stage it was laid out in. */
export interface MeasuredLetter {
  keptIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Transform that carries a measured letter from where it sat in the phrase to its slot. */
export interface CompactionTarget {
  dx: number;
  dy: number;
  /** Uniform shrink applied only when the sequence cannot otherwise fit one line. */
  scale: number;
  /** Centre of the letter once it has settled, in stage coordinates. */
  cx: number;
  cy: number;
}

export interface CompactionOptions {
  /** Ideal space between adjacent letters in the settled sequence. */
  tracking?: number;
  /** Horizontal breathing room kept at each edge of the stage. */
  edgeInset?: number;
  /** Where in the stage's height the settled row lands (0 = top, 1 = bottom). */
  centerRatio?: number;
}

const DEFAULT_TRACKING = 14;
const DEFAULT_EDGE_INSET = 8;
const DEFAULT_CENTER_RATIO = 0.5;

/**
 * Lay the surviving letters out as one centered row and return, per letter, the transform
 * that moves it there from where it already sits in the phrase.
 *
 * This is the "close the gaps" step: nothing re-flows and nothing re-mounts, so the letters
 * the user has been reading are the same views that travel — which is the whole point of
 * this screen. Because only transforms change, every measured origin stays valid and the
 * removed characters can hold their space while they fade.
 *
 * Tracking is surrendered first when the row is too wide, and only once it is exhausted do
 * the letters shrink, so even a long intention settles on a single readable line.
 */
export function computeCompactionTargets(
  letters: MeasuredLetter[],
  stage: { width: number; height: number },
  options: CompactionOptions = {},
): Map<number, CompactionTarget> {
  const targets = new Map<number, CompactionTarget>();
  const ordered = [...letters].sort((a, b) => a.keptIndex - b.keptIndex);
  if (!ordered.length || stage.width <= 0 || stage.height <= 0) return targets;

  const edgeInset = options.edgeInset ?? DEFAULT_EDGE_INSET;
  const centerRatio = options.centerRatio ?? DEFAULT_CENTER_RATIO;
  const available = Math.max(0, stage.width - edgeInset * 2);
  const glyphWidth = ordered.reduce((sum, letter) => sum + letter.width, 0);
  const gaps = Math.max(0, ordered.length - 1);

  const scale = glyphWidth > available && glyphWidth > 0 ? available / glyphWidth : 1;
  const scaledGlyphWidth = glyphWidth * scale;
  const tracking = gaps
    ? Math.max(0, Math.min(options.tracking ?? DEFAULT_TRACKING, (available - scaledGlyphWidth) / gaps))
    : 0;

  const rowWidth = scaledGlyphWidth + tracking * gaps;
  const rowCenterY = stage.height * centerRatio;
  let cursor = (stage.width - rowWidth) / 2;

  for (const letter of ordered) {
    const scaledWidth = letter.width * scale;
    const scaledHeight = letter.height * scale;
    // `scale` pivots on the view's own centre, so correct for the half-width it absorbs.
    const dx = cursor - letter.x - (letter.width - scaledWidth) / 2;
    const dy = rowCenterY - scaledHeight / 2 - letter.y - (letter.height - scaledHeight) / 2;
    targets.set(letter.keptIndex, { dx, dy, scale, cx: cursor + scaledWidth / 2, cy: rowCenterY });
    cursor += scaledWidth + tracking;
  }

  return targets;
}

/**
 * Deterministic mathematical estimation of compaction targets before native onLayout
 * measurements resolve. Ensures formation slots are immediately available and never null.
 */
export function estimateCompactionTargets(
  keptLetters: string[],
  stage: { width: number; height: number },
  options: CompactionOptions = {},
): Map<number, CompactionTarget> {
  const estimated: MeasuredLetter[] = keptLetters.map((_, index) => ({
    keptIndex: index,
    x: index * 26,
    y: 0,
    width: 22,
    height: 32,
  }));
  return computeCompactionTargets(estimated, stage, options);
}

