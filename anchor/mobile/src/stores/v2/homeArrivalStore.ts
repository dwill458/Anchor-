import { create } from 'zustand';

import type { AnchorExpression } from '@/constants/v2/creation';

export type ArrivalRect = { x: number; y: number; width: number; height: number };

/**
 * A just-created Anchor arriving on Home.
 *
 * Creation stages the arrival while it still covers Home; Home, mounted underneath, poses
 * itself for it (content hidden, the mark where creation left it) and reports where the mark
 * will rest. Only then does creation let go, so the frame after the route change is the same
 * frame the user was already looking at. Session-only: never persisted.
 */
export type HomeArrival = {
  id: number;
  anchorId: string;
  svg: string;
  category?: string;
  expression: AnchorExpression;
  /** The mark's square as creation last showed it (window coordinates). Null skips the flight. */
  fromRect: ArrivalRect | null;
  /** Where Home will draw the mark at rest (window coordinates). */
  targetRect: ArrivalRect | null;
  phase: 'staging' | 'ready' | 'arriving';
};

type HomeArrivalState = {
  arrival: HomeArrival | null;
  stage: (input: Omit<HomeArrival, 'id' | 'targetRect' | 'phase'>) => number;
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
  reportReady: (id, rect) => {
    const arrival = get().arrival;
    if (!arrival || arrival.id !== id || arrival.phase !== 'staging') return;
    set({ arrival: { ...arrival, targetRect: rect, phase: 'ready' } });
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
