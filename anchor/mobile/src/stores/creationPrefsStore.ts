import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Non-sensitive creation-flow preferences. Deliberately plain AsyncStorage (not the encrypted
 * store): it holds a style id and a counter, never intention text.
 */
interface CreationPrefsState {
  /** The style the person last committed; becomes the next pre-selected default. */
  lastStyleId?: string;
  /** Incremented on every sealed anchor; offsets which styles rotate into the style chips. */
  rotationCounter: number;
  setLastStyleId: (styleId: string) => void;
  incrementRotation: () => void;
}

export const CREATION_PREFS_STORAGE_KEY = 'anchor-creation-prefs-v1';

export const useCreationPrefsStore = create<CreationPrefsState>()(
  persist(
    (set) => ({
      lastStyleId: undefined,
      rotationCounter: 0,
      setLastStyleId: (styleId) => set({ lastStyleId: styleId }),
      incrementRotation: () => set((state) => ({ rotationCounter: state.rotationCounter + 1 })),
    }),
    {
      name: CREATION_PREFS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lastStyleId: state.lastStyleId, rotationCounter: state.rotationCounter }),
    }
  )
);
