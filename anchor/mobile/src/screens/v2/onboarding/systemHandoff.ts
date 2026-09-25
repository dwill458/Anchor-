/**
 * Screen 4 → Screen 5 handoff timeline (ms from Continue).
 *
 * The same one-clock pattern as the 2 → 3 and 3 → 4 handoffs. The category illustration is
 * the transition object: on the first frame of the clock, Screen 4 stops drawing it and
 * Screen 5 draws it at the identical frame, so there is never a second copy or a gap. That
 * one image then rises and shrinks into the Screen 5 hero position. Screen 4's question,
 * choices and CTA clear first; Screen 5's copy and the SEE → REINFORCE → MOVE system arrive
 * in overlapping steps behind it.
 */
import { easeInOutCubic, easeOutCubic, seg, type Window } from "./openingHandoff";

export { easeInOutCubic, easeOutCubic, seg };
export type { Window };

export const SYSTEM_HANDOFF = {
  /** Screen 4's pill, question, support, choices and CTA step back. */
  s4UiOut: [0, 240] as Window,
  /** Screen 5's cream covers Screen 4 only once its copy is fully gone (both are the same cream). */
  s5Backdrop: [240, 280] as Window,
  /** The artwork rises and shrinks from the Screen 4 hero frame to the Screen 5 one. */
  heroFlight: [90, 640] as Window,
  /** A near-invisible settle once it has essentially arrived. */
  heroSettle: [600, 860] as Window,
  /** Progress rolls 04 → 05. */
  progress: [220, 560] as Window,
  pill: [520, 700] as Window,
  headline: [570, 820] as Window,
  support: [650, 880] as Window,
  /** SEE → REINFORCE → MOVE, each overlapping the last; labels follow their art. */
  systemStart: 760,
  systemStagger: 130,
  artDuration: 460,
  labelDelay: 120,
  labelDuration: 300,
  cta: [1160, 1380] as Window,
  /** Screen 4 is released from the screen once it is fully covered. */
  commitStep: 660,
  /** Direct entry (restore, back from Screen 6) starts the clock here, skipping the flight. */
  directFrom: 440,
  /** MOVE, the last piece, finishes here. */
  end: 1480,
} as const;

/** Reduce Motion: fades only — the artwork cross-fades in place rather than travelling. */
export const SYSTEM_HANDOFF_REDUCED = {
  s4UiOut: [0, 180] as Window,
  s5Backdrop: [180, 210] as Window,
  heroFlight: [0, 240] as Window,
  heroSettle: [0, 1] as Window,
  progress: [160, 380] as Window,
  pill: [220, 380] as Window,
  headline: [250, 440] as Window,
  support: [300, 480] as Window,
  systemStart: 340,
  systemStagger: 60,
  artDuration: 240,
  labelDelay: 40,
  labelDuration: 220,
  cta: [520, 700] as Window,
  commitStep: 380,
  directFrom: 200,
  end: 720,
} as const;

export type SystemHandoffTimeline = typeof SYSTEM_HANDOFF | typeof SYSTEM_HANDOFF_REDUCED;

export function systemHandoffTimeline(reduceMotion: boolean): SystemHandoffTimeline {
  return reduceMotion ? SYSTEM_HANDOFF_REDUCED : SYSTEM_HANDOFF;
}

/** Art and label windows for SEE (0), REINFORCE (1) and MOVE (2). */
export function systemPieceWindows(timeline: SystemHandoffTimeline, index: number): { art: Window; label: Window } {
  const start = timeline.systemStart + index * timeline.systemStagger;
  const labelStart = start + timeline.labelDelay;
  return {
    art: [start, start + timeline.artDuration],
    label: [labelStart, labelStart + timeline.labelDuration],
  };
}
