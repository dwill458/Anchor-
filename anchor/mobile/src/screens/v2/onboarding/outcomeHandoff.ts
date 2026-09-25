/**
 * Screen 3 → Screen 4 handoff timeline (ms from Continue).
 *
 * One clock drives both screens, exactly like the Screen 2 → 3 handoff in `openingHandoff.ts`.
 * The selected category illustration is the transition object: it detaches from its Screen 3
 * card and travels to the Screen 4 hero position while Screen 3's question, cards and CTA
 * fade back and its runner environment recedes underneath. There is no navigation push, no
 * blank frame and never two copies of the artwork on screen at once.
 */
import { easeInOutCubic, easeOutCubic, seg, type Window } from "./openingHandoff";

export { easeInOutCubic, easeOutCubic, seg };
export type { Window };

/** The selected card's on-screen frame at the moment Continue is pressed, in window coordinates. */
export type OutcomeOriginFrame = { x: number; y: number; width: number; height: number };

export const OUTCOME_HANDOFF = {
  /** Phase A: question, support copy, unselected cards and the CTA step back. */
  s3UiOut: [0, 240] as Window,
  /** The selected card's shell (background, border, footer) empties out just after its
   * artwork has already handed off to the travelling clone. */
  s3CardShell: [40, 260] as Window,
  /** Phase B: the runner environment recedes underneath the departing card. */
  s3EnvOut: [140, 620] as Window,
  /** The artwork's flight from its measured card frame to the Screen 4 hero frame. */
  heroFlight: [80, 600] as Window,
  /** Phase C: an extremely subtle settle once the artwork arrives. */
  heroSettle: [560, 860] as Window,
  /** Progress rolls 03 → 04. */
  progress: [260, 600] as Window,
  category: [660, 820] as Window,
  question: [700, 920] as Window,
  support: [780, 980] as Window,
  choicesStart: 840,
  choiceStagger: 50,
  choiceDuration: 240,
  cta: [1000, 1200] as Window,
  /** Screen 3 is unmounted once every one of its layers is transparent. */
  commitStep: 660,
  end: 1200,
} as const;

/** Reduce Motion: fades only — the artwork settles into place rather than travelling. */
export const OUTCOME_HANDOFF_REDUCED = {
  s3UiOut: [0, 180] as Window,
  s3CardShell: [20, 180] as Window,
  s3EnvOut: [0, 220] as Window,
  heroFlight: [0, 1] as Window,
  heroSettle: [0, 240] as Window,
  progress: [160, 380] as Window,
  category: [220, 380] as Window,
  question: [260, 460] as Window,
  support: [320, 500] as Window,
  choicesStart: 360,
  choiceStagger: 0,
  choiceDuration: 220,
  cta: [420, 620] as Window,
  commitStep: 380,
  end: 650,
} as const;

export type OutcomeHandoffTimeline = typeof OUTCOME_HANDOFF | typeof OUTCOME_HANDOFF_REDUCED;

export function outcomeHandoffTimeline(reduceMotion: boolean): OutcomeHandoffTimeline {
  return reduceMotion ? OUTCOME_HANDOFF_REDUCED : OUTCOME_HANDOFF;
}
