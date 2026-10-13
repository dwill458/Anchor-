import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DEFAULT_VISION_SHARE_BACKGROUND_ID,
  type VisionShareBackgroundId,
} from '@/components/share/visionShareBackgrounds';

interface SharePrefsState {
  visionBackgroundId: VisionShareBackgroundId;
  setVisionBackgroundId: (id: VisionShareBackgroundId) => void;
}

export const SHARE_PREFS_STORAGE_KEY = 'anchor-share-prefs-v1';

export const useSharePrefsStore = create<SharePrefsState>()(
  persist(
    (set) => ({
      visionBackgroundId: DEFAULT_VISION_SHARE_BACKGROUND_ID,
      setVisionBackgroundId: (id) => set({ visionBackgroundId: id }),
    }),
    {
      name: SHARE_PREFS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ visionBackgroundId: state.visionBackgroundId }),
    }
  )
);
