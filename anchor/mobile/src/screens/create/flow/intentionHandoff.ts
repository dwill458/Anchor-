import { create } from 'zustand';

/**
 * Who is drawing the typed words. The Intention screen stays mounted underneath the creation
 * flow while it fades in; once the flow's canvas has drawn its first frame it owns the glyphs,
 * and the Intention field stops drawing them on that same frame (no doubled text). Session-only.
 */
interface IntentionHandoffState {
  glyphsOwnedByFlow: boolean;
  claim: () => void;
  release: () => void;
}

export const useIntentionHandoffStore = create<IntentionHandoffState>()((set) => ({
  glyphsOwnedByFlow: false,
  claim: () => set({ glyphsOwnedByFlow: true }),
  release: () => set({ glyphsOwnedByFlow: false }),
}));
