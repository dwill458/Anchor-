/**
 * Pacing and switches for the one-screen creation flow. Every duration is in seconds so it can be
 * read straight against the prototype; the timeline hook is the only consumer that converts.
 */

/**
 * DECISION D4: speculative generation is OFF. Firing the default style's generation early would
 * hide latency but burns the daily AI limiter (10/day, 20/hr) and money when the person picks a
 * different style. The seam exists so it can be enabled later without restructuring.
 * DEFERRED: wire a speculative request in StyleScene when this is true.
 */
export const SPECULATIVE_GENERATION = false;

export type CreationMode = 'first' | 'repeat';

export interface SegmentTimes {
  /** Intention → flow handoff (glide + ink rise). */
  handoff: number;
  distill: number;
  /** The map duration scales with letter count: clamp(base + perLetter * n, min, max). */
  map: { base: number; perLetter: number; min: number; max: number };
  forget: number;
  /** Nothing moves. Required before Style. */
  stillness: number;
  /** Auto-commit countdown for the pre-selected style. */
  styleCountdown: number;
  /** Shortest the Form scene may last, even when generation resolves instantly. */
  formMin: number;
  sweep: number;
}

export const SEGMENT_TIMES: Record<CreationMode, SegmentTimes> = {
  first: {
    handoff: 1.3,
    distill: 3.0,
    map: { base: 0.5, perLetter: 0.42, min: 4, max: 6 },
    forget: 2.0,
    stillness: 0.45,
    styleCountdown: 4.0,
    formMin: 1.4,
    sweep: 1.1,
  },
  repeat: {
    handoff: 0.5,
    distill: 1.5,
    // Map is half the first-anchor duration.
    map: { base: 0.25, perLetter: 0.21, min: 2, max: 3 },
    forget: 1.0,
    stillness: 0.25,
    styleCountdown: 2.2,
    formMin: 1.4,
    sweep: 0.8,
  },
};

/** The draw path replaces Distill and Map; its Forget-settle is slightly shorter. */
export const DRAWN_FORGET_SECONDS: Record<CreationMode, number> = { first: 1.6, repeat: 0.8 };

/** Draw path: the ink band rises 618 -> 98 over this long while the big text fades out. */
export const DRAW_RISE_SECONDS = 0.9;

/** Generation wait thresholds (seconds) for the Form scene captions. */
export const FORM_SLOW_CAPTION_AFTER = 12;
export const FORM_RETRY_AFTER = 45;

/** Seal gesture. The unreachable SealAnchorScreen uses 3000 ms; the creation flow uses 1.1 s. */
export const SEAL_HOLD_MS = 1100;
/** After the medallion forms, the page rests on cream this long before the flow moves on. */
export const SEAL_SETTLE_SECONDS = 0.6;
/** Release before completion drains the ring this many times faster than it filled. */
export const SEAL_DRAIN_RATE = 2.6;
/** A sideways finger move beyond this cancels a hold and becomes a swipe. */
export const SEAL_CANCEL_SLOP_PX = 10;

/** Haptic floor so Map's per-letter ticks never stack faster than this. */
export const MIN_HAPTIC_GAP_MS = 90;

/** Design space the prototype was drawn in; scenes scale with a single factor `width / 390`. */
export const DESIGN_WIDTH = 390;
export const DESIGN_HEIGHT = 844;

/** Ink-band boundary positions (design px). */
export const INK_BOUNDARY = {
  /** Added to the design height to start fully below the screen. */
  offscreenOffset: 90,
  afterHandoff: 618,
  afterDistill: 104,
  held: 98,
} as const;
