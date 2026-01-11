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

      addAnchor: (anchor) =>
        set((state) => ({
          anchors: [anchor, ...state.anchors], // Add to beginning (most recent first)
          error: null,
        })),

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
