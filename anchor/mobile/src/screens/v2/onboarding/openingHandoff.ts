/**
 * Screen 2 → Screen 3 handoff timeline (ms from Continue).
 *
 * One clock drives both screens. Screen 3 is already mounted and decoded beneath Screen 2,
 * so the handoff is a layered dissolve: Screen 2's world thins over a runner plate that is
 * already moving, rather than one page fading out before the next appears.
 */
export type Window = readonly [number, number];

export const HANDOFF = {
  /** Phase A: Screen 2 copy, verbs and CTA step back. */
  s2Ui: [0, 250] as Window,
  /** The example Anchor survives into the move, shrinks and lifts, and is gone before the question. */
  anchor: [60, 700] as Window,
  /** Phase B: Screen 2's world thins while its camera keeps travelling left. */
  s2World: [150, 650] as Window,
  /** Screen 2's dark copy ground lingers a beat, so the runner lands first and the lower
   * panel turns from ink to paper as the question arrives, not as a mid-grey wash. */
  s2Ground: [300, 700] as Window,
  s2Drift: [150, 900] as Window,
  /** Screen 3 camera settles from the right; revealed as Screen 2 thins above it. */
  s3Camera: [150, 1050] as Window,
  /** Progress rolls 02 → 03. */
  progress: [300, 650] as Window,
  question: [620, 870] as Window,
  support: [700, 950] as Window,
  cardsStart: 760,
  cardStagger: 50,
  cardDuration: 260,
  cta: [900, 1160] as Window,
  /** Screen 2 is unmounted once every one of its layers is transparent. */
  commitStep: 720,
  end: 1180,
} as const;

/** Reduce Motion: fades only — no lateral travel, drift or scale. */
export const HANDOFF_REDUCED = {
  s2Ui: [0, 200] as Window,
  anchor: [0, 360] as Window,
  s2World: [100, 500] as Window,
  s2Ground: [100, 500] as Window,
  s2Drift: [0, 1] as Window,
  s3Camera: [0, 1] as Window,
  progress: [250, 500] as Window,
  question: [450, 700] as Window,
  support: [480, 730] as Window,
  cardsStart: 500,
  cardStagger: 0,
  cardDuration: 250,
  cta: [520, 770] as Window,
  commitStep: 520,
  end: 780,
} as const;

export type HandoffTimeline = typeof HANDOFF | typeof HANDOFF_REDUCED;

export function handoffTimeline(reduceMotion: boolean): HandoffTimeline {
  return reduceMotion ? HANDOFF_REDUCED : HANDOFF;
}

export function seg(t: number, window: Window): number {
  "worklet";
  return Math.min(1, Math.max(0, (t - window[0]) / (window[1] - window[0])));
}

export function easeOutCubic(p: number): number {
  "worklet";
  return 1 - (1 - p) * (1 - p) * (1 - p);
}

export function easeInOutCubic(p: number): number {
  "worklet";
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}
