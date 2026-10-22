import { create } from 'zustand';
import type { ArrivalRect } from '@/stores/v2/homeArrivalStore';

/**
 * Session-only hand-off slot for the post-first-practice reminder invitation. Never persisted.
 *
 * `handOffPracticeToInvitation` stages where the Anchor's mark stood on the practice-complete screen
 * (`fromRect`) so the invitation can fly the same mark into its hero; the session id rides along so
 * the way out can hand the Anchor to Home through the existing practice hand-off.
 */
export type StagedInvitation = {
  anchorId: string;
  sessionId: string | null;
  /** Window rect of the mark square on the complete screen, or null (crossfade instead of flight). */
  fromRect: ArrivalRect | null;
};

type ReminderInvitationStore = {
  staged: StagedInvitation | null;
  /** Set once an invitation has been opened in this app session: it never opens twice per launch. */
  shownThisSession: boolean;
  stage: (input: StagedInvitation) => void;
  /** The staged fromRect for this Anchor, once; later calls (remounts) get null. */
  takeFromRect: (anchorId: string) => ArrivalRect | null;
  markShown: () => void;
  reset: () => void;
};

export const useReminderInvitationStore = create<ReminderInvitationStore>((set, get) => ({
  staged: null,
  shownThisSession: false,
  stage: (input) => set({ staged: { ...input } }),
  takeFromRect: (anchorId) => {
    const staged = get().staged;
    if (!staged || staged.anchorId !== anchorId || !staged.fromRect) return null;
    const rect = staged.fromRect;
    set({ staged: { ...staged, fromRect: null } });
    return rect;
  },
  markShown: () => set({ shownThisSession: true }),
  reset: () => set({ staged: null, shownThisSession: false }),
}));
