import type { ArrivalGlow, ArrivalNumber, ArrivalRect } from '@/stores/v2/homeArrivalStore';

/**
 * What the practice-complete screen knows about itself at the moment Continue is tapped, handed to
 * whoever carries the user back to Home ("Complete to Home", see navigation/v2/practiceHandoff.ts).
 *
 * It travels through this small hand-off slot rather than through the screen's callbacks so the
 * complete screen's existing `onDone`, `onCompleted` and `onSessionCompleted` contracts stay as they
 * are. Session-only: never persisted.
 */
export type PracticeDepartureMeasure = {
  /** The Anchor's mark square on the complete screen (window coordinates), as the arrival's fromRect. */
  fromRect: ArrivalRect;
  /** The new Thread Strength figure and where it stands, when the screen shows one. */
  number: ArrivalNumber | null;
  /** The glow behind the artwork, when the screen draws one. */
  glow: ArrivalGlow | null;
};

export type PracticeDeparture = {
  /** The completed session, or null when the screen has none. */
  sessionId: string | null;
  /** When Continue was tapped (ms since epoch): the prototype's t = 0. */
  at: number;
  /** Measures the screen. Resolves null if it cannot be measured; never rejects. */
  measure: () => Promise<PracticeDepartureMeasure | null>;
};

/** A departure older than this belongs to a tap whose completion went elsewhere. */
const DEPARTURE_MAX_AGE_MS = 3000;

let pending: PracticeDeparture | null = null;

/** The complete screen offers its departure just before it calls `onDone`. */
export function offerPracticeDeparture(departure: PracticeDeparture): void {
  pending = departure;
}

/** Takes (and clears) the offered departure, or null if there is none or it is stale. */
export function takePracticeDeparture(now: number = Date.now()): PracticeDeparture | null {
  const taken = pending;
  pending = null;
  if (!taken || now - taken.at > DEPARTURE_MAX_AGE_MS) return null;
  return taken;
}
