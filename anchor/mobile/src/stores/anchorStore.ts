/**
 * Anchor App - Anchor Store
 *
 * Global state management for user's anchors using Zustand.
 * Handles anchor collection, CRUD operations, and sync with backend.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Anchor } from '@/types';
import { useTeachingStore } from './teachingStore';

/**
 * Anchor state interface
 */
interface AnchorState {
  // State
  anchors: Anchor[];
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: Date | null;

  // Actions
  setAnchors: (anchors: Anchor[]) => void;
  addAnchor: (anchor: Anchor) => void;
  updateAnchor: (id: string, updates: Partial<Anchor>) => void;
  removeAnchor: (id: string) => void;
  getAnchorById: (id: string) => Anchor | undefined;
  getActiveAnchors: () => Anchor[];
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  markSynced: () => void;
  clearAnchors: () => void;
}

/**
 * Anchor store with persistence
 */
export const useAnchorStore = create<AnchorState>()(
  persist(
    (set, get) => ({
      // Initial state
      anchors: [],
      isLoading: false,
      error: null,
      lastSyncedAt: null,

      // Actions
      setAnchors: (anchors) =>
        set({
          anchors,
          error: null,
        }),

      addAnchor: (anchor) => {
        const teaching = useTeachingStore.getState();
        // Set first-anchor flag once; queue M1 milestone
        if (!teaching.userFlags.hasCreatedFirstAnchor) {
          teaching.setUserFlag('hasCreatedFirstAnchor', true);
          teaching.queueMilestone('milestone_first_anchor_v1');
        }
        set((state) => ({
          anchors: [anchor, ...state.anchors], // Add to beginning (most recent first)
          error: null,
        }));
      },

      updateAnchor: (id, updates) =>
        set((state) => ({
          anchors: state.anchors.map((anchor) =>
            anchor.id === id
              ? {
                ...anchor,
                ...updates,
                updatedAt: new Date(),
              }
              : anchor
          ),
          error: null,
        })),

      removeAnchor: (id) =>
        set((state) => ({
          anchors: state.anchors.filter((anchor) => anchor.id !== id),
          error: null,
        })),

      getAnchorById: (id) => {
        const state = get();
        return state.anchors.find((anchor) => anchor.id === id);
      },

      getActiveAnchors: () => {
        const state = get();
        return state.anchors.filter(
          (anchor) => !anchor.isReleased && !anchor.archivedAt
        );
      },

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),

      setError: (error) =>
        set({
          error,
          isLoading: false,
        }),

      markSynced: () =>
        set({
          lastSyncedAt: new Date(),
        }),

      clearAnchors: () =>
        set({
          anchors: [],
          error: null,
          lastSyncedAt: null,
        }),
    }),
    {
      name: 'anchor-vault-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist anchors and last sync time
      partialize: (state) => ({
        anchors: state.anchors,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);

/**
 * Temporary storage for large assets that shouldn't be passed via navigation params
 * (e.g., base64 generated images)
 */
interface TempState {
  tempEnhancedImage: string | null;
  setTempEnhancedImage: (image: string | null) => void;
}

export const useTempStore = create<TempState>((set) => ({
  tempEnhancedImage: null,
  setTempEnhancedImage: (image) => set({ tempEnhancedImage: image }),
}));
