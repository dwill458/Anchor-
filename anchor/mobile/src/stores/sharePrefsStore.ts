import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DEFAULT_VISION_SHARE_BACKGROUND_ID,
  type VisionShareBackgroundId,
} from '@/components/share/visionShareBackgrounds';

interface SharePrefsState {
  visionBackgroundId: VisionShareBackgroundId;
  visionBackgroundSource: 'suggested' | 'manual';
  useSuggestedVisionBackground: () => void;
  setVisionBackgroundId: (id: VisionShareBackgroundId) => void;
}

export const SHARE_PREFS_STORAGE_KEY = 'anchor-share-prefs-v1';

export const useSharePrefsStore = create<SharePrefsState>()(
  persist(
    (set) => ({
      visionBackgroundId: DEFAULT_VISION_SHARE_BACKGROUND_ID,
      visionBackgroundSource: 'suggested',
      useSuggestedVisionBackground: () => set({ visionBackgroundSource: 'suggested' }),
      setVisionBackgroundId: (id) => set({ visionBackgroundId: id, visionBackgroundSource: 'manual' }),
    }),
    {
      name: SHARE_PREFS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const saved = persisted as Partial<SharePrefsState> | undefined;
        return { ...current, ...saved,
          // Before source was recorded, a persisted selection was always an explicit choice.
          visionBackgroundSource: saved?.visionBackgroundSource ?? (saved?.visionBackgroundId ? 'manual' : 'suggested') };
      },
      partialize: (state) => ({ visionBackgroundId: state.visionBackgroundId, visionBackgroundSource: state.visionBackgroundSource }),
    }
  )
);
