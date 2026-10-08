import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * The Thread Strength each Anchor last showed on Home. The glow behind the Anchor eases from this
 * value to the current one only when the value has moved since then. Plain AsyncStorage: one number
 * per Anchor, nothing sensitive.
 */
export const HOME_GLOW_SEEN_STORAGE_KEY = '@anchor/v2/home-glow-seen';

type HomeGlowSeenState = {
  /** Thread Strength (0..100) last shown on Home, keyed by Anchor id. */
  seen: Record<string, number>;
  /** False until the stored record has been read. Never persisted. */
  hydrated: boolean;
  setSeen: (anchorId: string, value: number) => void;
  getSeen: (anchorId: string) => number | undefined;
};

type PersistedHomeGlowSeen = { seen?: Record<string, number> };

export const useHomeGlowSeenStore = create<HomeGlowSeenState>()(
  persist(
    (set, get) => ({
      seen: {},
      hydrated: false,
      // Nothing is recorded before the stored record has been read. Against an empty record a write
      // would look like a first sight and hide a change made while the app was closed.
      setSeen: (anchorId, value) => {
        if (!get().hydrated) return;
        set((state) => ({ seen: { ...state.seen, [anchorId]: value } }));
      },
      getSeen: (anchorId) => get().seen[anchorId],
    }),
    {
      name: HOME_GLOW_SEEN_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ seen: state.seen }),
      // setSeen records nothing before hydration, so any session value here was written after the stored
      // record was read and is newer than it.
      merge: (persistedState, currentState) => ({
        ...currentState,
        seen: { ...((persistedState as PersistedHomeGlowSeen | undefined)?.seen ?? {}), ...currentState.seen },
      }),
      // Runs on success and on failure: an unreadable record must not leave the glow waiting forever.
      onRehydrateStorage: () => () => {
        useHomeGlowSeenStore.setState({ hydrated: true });
      },
    }
  )
);

/**
 * Whether the glow should ease from `seen` to `current`. Only a measured value that differs from a
 * value already recorded for this Anchor qualifies. An unmeasured thread (null) never animates, and
 * an Anchor with no record yet settles on its current value and is recorded.
 */
export function shouldAnimateGlow(seen: number | null | undefined, current: number | null | undefined): boolean {
  if (typeof current !== 'number' || !Number.isFinite(current)) return false;
  if (typeof seen !== 'number' || !Number.isFinite(seen)) return false;
  return seen !== current;
}
