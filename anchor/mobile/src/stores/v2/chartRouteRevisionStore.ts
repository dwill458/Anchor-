import { create } from 'zustand';

/**
 * The one "your route was revised" signal from Adjust Route back to the Chart. Adjust fires it only when a revision was
 * actually SAVED and the route actually changed; the Chart consumes it once, when it regains focus, and plays the quiet
 * route-revised scene (R1). Creation reuses the route editor but never fires it.
 *
 * Why a store: Adjust is a separate screen pushed over the Chart, and a route param cannot be consumed once by a screen
 * that never left the stack. Session-only: never persisted. An unconsumed signal goes stale after
 * CHART_ROUTE_REVISION_TTL_MS, so a Chart opened long afterwards never replays an old revision.
 */
export type ChartRouteRevisionSignal = {
  /** Unique per saved revision: the Chart dedupes on it. */
  nonce: number;
  anchorId: string;
  courseId: string;
  at: number;
};

export const CHART_ROUTE_REVISION_TTL_MS = 60_000;

type ChartRouteRevisionState = {
  pending: ChartRouteRevisionSignal | null;
  lastNonce: number;
  /** A revision was saved and changed the route. Returns its nonce. */
  signal: (anchorId: string, courseId: string) => number;
  /** Takes the signal if it is still this one. Returns whether this caller got it (and so owns playing it). */
  consume: (nonce: number) => boolean;
  clear: () => void;
};

export const useChartRouteRevisionStore = create<ChartRouteRevisionState>()((set, get) => ({
  pending: null,
  lastNonce: 0,
  signal: (anchorId, courseId) => {
    const nonce = get().lastNonce + 1;
    set({ lastNonce: nonce, pending: { nonce, anchorId, courseId, at: Date.now() } });
    return nonce;
  },
  consume: (nonce) => {
    if (get().pending?.nonce !== nonce) return false;
    set({ pending: null });
    return true;
  },
  clear: () => set({ pending: null }),
}));

/** True while the signal is still fresh enough to play. */
export function isRouteRevisionFresh(signal: ChartRouteRevisionSignal, now: number = Date.now()): boolean {
  return now - signal.at <= CHART_ROUTE_REVISION_TTL_MS;
}
