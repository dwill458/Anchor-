import { create } from 'zustand';

import type { AnchorExpression } from '@/constants/v2/creation';

export type ArrivalRect = { x: number; y: number; width: number; height: number };

/**
 * `first` only when the user has never seen a first-Anchor arrival (the persisted once-ever flag is
 * unset) and the just-saved Anchor is the only Anchor in the store (archived and released Anchors
 * count). `repeat` for every other case; the default when unsure.
 */
export type HomeArrivalKind = 'first' | 'repeat' | 'practice';

/** The Thread Strength figure a finished practice showed, and where (window coordinates). */
export type ArrivalNumber = { text: string; rect: ArrivalRect };

/** The atmosphere behind the mark on the practice-complete screen, carried with it. */
export type ArrivalGlow = {
  color: string;
  opacity: number;
  /** The glow's diameter as a multiple of the mark's square. */
  scale: number;
};

/**
 * A just-created Anchor arriving on Home (`first`, `repeat`), or the Anchor of a practice that has
 * just been completed returning to Home (`practice`).
 *
 * Creation stages the arrival while it still covers Home; Home, mounted underneath, poses
 * itself for it (content hidden, the mark where creation left it) and reports where the mark
 * will rest. Only then does creation let go, so the frame after the route change is the same
 * frame the user was already looking at. Session-only: never persisted.
 */
export type HomeArrival = {
  id: number;
  anchorId: string;
  /** Decides the arrival's length, choreography and celebration level (see homeArrival.tsx). */
  kind: HomeArrivalKind;
  svg: string;
  category?: string;
  /** Absent for an Anchor that never recorded one (its stored SVG renders as it always has). */
  expression?: AnchorExpression;
  /** `practice` only: the completed session, so Home can tell what this completion changed. */
  sessionId?: string | null;
  /** `practice` only: the figure on the complete screen, which fades out in place as Home's arrives. */
  number?: ArrivalNumber | null;
  /** `practice` only: the glow that rides with the mark and hands over to Home's own. */
  glow?: ArrivalGlow | null;
  /** The chosen interpretation, when one was kept: it travels as itself, in its circle. */
  imageUrl?: string;
  /** The mark's square as creation last showed it (window coordinates). Null skips the flight. */
  fromRect: ArrivalRect | null;
  /** Where Home will draw the mark at rest (window coordinates). */
  targetRect: ArrivalRect | null;
  phase: 'staging' | 'ready' | 'arriving';
};

type HomeArrivalState = {
  arrival: HomeArrival | null;
  stage: (input: Omit<HomeArrival, 'id' | 'targetRect' | 'phase'>) => number;
  /** Where creation last showed the mark, once it is known (staging can begin before). */
  setFromRect: (id: number, rect: ArrivalRect | null) => void;
  /** Home is posed; `rect` is where the mark will land (null when it could not be measured). */
  reportReady: (id: number, rect: ArrivalRect | null) => void;
  /** Creation has let go; Home plays the arrival. */
  release: (id: number) => void;
  clear: (id?: number) => void;
};

let serial = 0;

export const useHomeArrivalStore = create<HomeArrivalState>()((set, get) => ({
  arrival: null,
  stage: (input) => {
    serial += 1;
    set({ arrival: { ...input, id: serial, targetRect: null, phase: 'staging' } });
    return serial;
  },
  setFromRect: (id, rect) => {
    const arrival = get().arrival;
    if (!arrival || arrival.id !== id || arrival.phase === 'arriving') return;
    set({ arrival: { ...arrival, fromRect: rect } });
  },
  reportReady: (id, rect) => {
    const arrival = get().arrival;
    if (!arrival || arrival.id !== id) return;
    // A measurement that lands after Home gave up waiting still gives the flight its target,
    // as long as creation has not let go yet.
    const upgrade = arrival.phase === 'ready' && !arrival.targetRect && rect;
    if (arrival.phase !== 'staging' && !upgrade) return;
    set({ arrival: { ...arrival, targetRect: rect ?? arrival.targetRect, phase: 'ready' } });
  },
  release: (id) => {
    const arrival = get().arrival;
    if (!arrival || arrival.id !== id) return;
    set({ arrival: { ...arrival, phase: 'arriving' } });
  },
  clear: (id) => {
    const arrival = get().arrival;
    if (!arrival || (id !== undefined && arrival.id !== id)) return;
    set({ arrival: null });
  },
}));

/** Resolves true once Home reports ready for arrival `id`, or false after `timeoutMs`. */
export function whenHomeReady(id: number, timeoutMs: number): Promise<boolean> {
  const current = useHomeArrivalStore.getState().arrival;
  if (current?.id === id && current.phase !== 'staging') return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(ready);
    };
    const unsubscribe = useHomeArrivalStore.subscribe((state) => {
      if (state.arrival?.id === id && state.arrival.phase !== 'staging') finish(true);
      if (!state.arrival || state.arrival.id !== id) finish(false);
    });
    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}
