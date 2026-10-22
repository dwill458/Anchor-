/**
 * Question → creation handoff timeline (ms from the tap).
 *
 * One clock drives the whole beat. The tapped card registers, the question and the other
 * rows step back, and one line — "Health. Good — let's
 * give it a shape." — holds before creation opens on the same cream. Nothing here waits on
 * the network, and creation is already hydrated when it mounts.
 *
 * Durations are deliberately a little longer than they look on paper: ceremonial motion on a
 * device reads faster than in a prototype.
 */
import { easeInOutCubic, easeOutCubic, seg, type Window } from "./openingHandoff";

export { easeInOutCubic, easeOutCubic, seg };
export type { Window };

export const CATEGORY_HANDOFF = {
  /** The question, support copy and cards step back; the chosen card is held a beat longer. */
  uiOut: [120, 380] as Window,
  /** The progress header rolls 03 → 04. */
  progress: [200, 560] as Window,
  /** The line arrives, holds, and leaves before creation mounts. */
  messageIn: [380, 680] as Window,
  messageOut: [1120, 1380] as Window,
  /** Creation mounts; every layer of this screen is transparent by now. */
  commitStep: 1420,
  end: 1420,
} as const;

/** Reduce Motion: fades only. */
export const CATEGORY_HANDOFF_REDUCED = {
  uiOut: [60, 240] as Window,
  progress: [100, 320] as Window,
  messageIn: [240, 440] as Window,
  messageOut: [880, 1060] as Window,
  commitStep: 1100,
  end: 1100,
} as const;

export type CategoryHandoffTimeline = typeof CATEGORY_HANDOFF | typeof CATEGORY_HANDOFF_REDUCED;

export function categoryHandoffTimeline(reduceMotion: boolean): CategoryHandoffTimeline {
  return reduceMotion ? CATEGORY_HANDOFF_REDUCED : CATEGORY_HANDOFF;
}
