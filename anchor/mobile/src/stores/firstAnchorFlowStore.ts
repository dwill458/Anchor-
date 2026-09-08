import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { encryptedPersistStorage } from './encryptedPersistStorage';

export type OnboardingUseCase = 'deep_work' | 'physical' | 'high_stakes' | 'personal' | 'other';
export type FirstAnchorStructure = 'balanced' | 'compact' | 'minimal' | 'drawn';

/**
 * Private, device-local state for an unfinished first Anchor. This keeps the
 * creation flow recoverable without broadening any backend contract or
 * storing intentions in plaintext AsyncStorage.
 */
export interface FirstAnchorFlowDraft {
  onboardingName?: string;
  onboardingUseCase?: OnboardingUseCase;
  originalIntention?: string;
  distilledLetters?: string[];
  structure?: FirstAnchorStructure;
  traceSvg?: string;
  drawingSvg?: string;
  selectedStyleId?: string;
  generationStatus?: 'idle' | 'generating' | 'error' | 'complete';
  selectedExpressionId?: string;
  updatedAt: string;
}

type FirstAnchorFlowState = {
  draft: FirstAnchorFlowDraft | null;
  updateDraft: (updates: Omit<Partial<FirstAnchorFlowDraft>, 'updatedAt'>) => void;
  clearDraft: () => void;
};

const FIRST_ANCHOR_FLOW_STORAGE_KEY = 'anchor-first-anchor-flow-v1';

export const useFirstAnchorFlowStore = create<FirstAnchorFlowState>()(
  persist(
    (set) => ({
      draft: null,
      updateDraft: (updates) =>
        set((state) => ({
          draft: {
            ...state.draft,
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        })),
      clearDraft: () => set({ draft: null }),
    }),
    {
      name: FIRST_ANCHOR_FLOW_STORAGE_KEY,
      storage: createJSONStorage(() => encryptedPersistStorage),
      partialize: (state) => ({ draft: state.draft }),
    }
  )
);
