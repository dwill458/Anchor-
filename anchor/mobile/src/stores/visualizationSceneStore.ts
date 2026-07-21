import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { encryptedPersistStorage } from './encryptedPersistStorage';
import type { VisualizationScene } from '@/types/practice';

interface VisualizationSceneState {
  ownerAccountId: string | null;
  scenes: Record<string, VisualizationScene>;
  suggestions: Record<string, string[]>;
  tombstonedAnchorIds: string[];
  bindAccount: (accountId: string | null) => void;
  setScene: (scene: VisualizationScene) => void;
  setSuggestions: (anchorId: string, suggestions: string[]) => void;
  markSynced: (anchorId: string, remote: Partial<VisualizationScene>) => void;
  removeForAnchor: (referenceIds: string[]) => void;
  clearActiveAccount: () => void;
}

export const useVisualizationSceneStore = create<VisualizationSceneState>()(
  persist(
    (set, get) => ({
      ownerAccountId: null,
      scenes: {},
      suggestions: {},
      tombstonedAnchorIds: [],
      bindAccount: accountId => {
        if (get().ownerAccountId === accountId) return;
        set({ ownerAccountId: accountId, scenes: {}, suggestions: {}, tombstonedAnchorIds: [] });
      },
      setScene: scene => {
        if (get().ownerAccountId !== scene.accountId) return;
        if (get().tombstonedAnchorIds.includes(scene.anchorId)) return;
        set(state => ({ scenes: { ...state.scenes, [scene.anchorId]: scene } }));
      },
      setSuggestions: (anchorId, suggestions) =>
        set(state => ({ suggestions: { ...state.suggestions, [anchorId]: suggestions } })),
      markSynced: (anchorId, remote) =>
        set(state => {
          const current = state.scenes[anchorId];
          if (!current) return state;
          return {
            scenes: {
              ...state.scenes,
              [anchorId]: { ...current, ...remote, syncState: 'synced' },
            },
          };
        }),
      removeForAnchor: referenceIds =>
        set(state => {
          const refs = new Set(referenceIds);
          const scenes = Object.fromEntries(
            Object.entries(state.scenes).filter(
              ([anchorId, scene]) =>
                !refs.has(anchorId) &&
                !refs.has(scene.anchorId) &&
                !(scene.anchorLocalId && refs.has(scene.anchorLocalId))
            )
          );
          const suggestions = Object.fromEntries(
            Object.entries(state.suggestions).filter(([anchorId]) => !refs.has(anchorId))
          );
          return {
            scenes,
            suggestions,
            tombstonedAnchorIds: Array.from(
              new Set([...state.tombstonedAnchorIds, ...referenceIds])
            ).slice(-200),
          };
        }),
      clearActiveAccount: () => set({ ownerAccountId: null, scenes: {}, suggestions: {} }),
    }),
    {
      name: 'anchor-visualization-scenes-v1',
      storage: createJSONStorage(() => encryptedPersistStorage),
      partialize: state => ({
        ownerAccountId: state.ownerAccountId,
        scenes: state.scenes,
        tombstonedAnchorIds: state.tombstonedAnchorIds,
      }),
    }
  )
);
