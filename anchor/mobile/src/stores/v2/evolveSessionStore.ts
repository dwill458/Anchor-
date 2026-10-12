import { create } from 'zustand';

/**
 * The one in-flight "Evolve it" choice made on the Release screen. Creation runs in screens that
 * Release pushes on top of itself, and route params cannot carry a callback, so this store is the
 * result channel: creation attaches the sealed Anchor here and returns to Release.
 *
 * - `pending`: the user chose Evolve and is somewhere in creation. Nothing has been created yet.
 * - `successor`: creation sealed a real Anchor. It is only attached, never linked: the link to the
 *   released Anchor is made when the Release hold completes (useV2Release is called with it then).
 *
 * Session-only: never persisted. An abandoned session leaves the new Anchor as an ordinary active
 * Anchor; nothing is deleted.
 */
export type EvolveSessionOrigin = { fromAnchorId: string; fromIntention: string };
export type EvolveSessionSuccessor = { anchorId: string; intentionText: string; fromAnchorId?: string };

type EvolveSessionState = {
  pending: EvolveSessionOrigin | null;
  successor: EvolveSessionSuccessor | null;
  /** The user chose Evolve on this Anchor's Release screen. Starts a fresh session. */
  begin: (from: EvolveSessionOrigin) => void;
  /** Creation sealed this Anchor. Ends the pending phase. */
  attach: (successor: EvolveSessionSuccessor) => void;
  /** Creation was cancelled, or the Release screen is gone. Nothing stays attached. */
  clear: () => void;
};

export const useEvolveSessionStore = create<EvolveSessionState>()((set) => ({
  pending: null,
  successor: null,
  begin: (from) => set({ pending: { ...from }, successor: null }),
  attach: (successor) => set((state) => ({
    pending: null,
    successor: { ...successor, fromAnchorId: successor.fromAnchorId ?? state.pending?.fromAnchorId },
  })),
  clear: () => set({ pending: null, successor: null }),
}));
