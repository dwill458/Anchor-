/**
 * Anchor App - Anchor Store
 *
 * Global state management for user's anchors using Zustand.
 * Handles anchor collection, CRUD operations, and sync with backend.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { encryptedPersistStorage } from './encryptedPersistStorage';
import type { Anchor } from '@/types';
import { useTeachingStore } from './teachingStore';
import AnchorSyncService from '@/services/AnchorSyncService';
import { useAuthStore } from '@/stores/authStore';
import { getAdjustedDateString } from '@/utils/dateUtils';
import { logger } from '@/utils/logger';
import { checkAndRecordMilestones } from '@/utils/milestoneTracking';

const normalizeDate = (value?: Date | string): Date | undefined => {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
};

const normalizeAnchor = (anchor: Anchor): Anchor => ({
  ...anchor,
  createdAt: normalizeDate(anchor.createdAt) ?? new Date(),
  updatedAt: normalizeDate(anchor.updatedAt) ?? new Date(),
  chargedAt: normalizeDate(anchor.chargedAt),
  firstChargedAt: normalizeDate(anchor.firstChargedAt),
  ignitedAt: normalizeDate(anchor.ignitedAt),
  lastActivatedAt: normalizeDate(anchor.lastActivatedAt),
  releasedAt: normalizeDate(anchor.releasedAt),
  archivedAt: normalizeDate(anchor.archivedAt),
});

const matchesAnchorReference = (anchor: Anchor, referenceId: string): boolean =>
  anchor.id === referenceId || anchor.localId === referenceId;

const mergeAnchors = (existingAnchors: Anchor[], incomingAnchors: Anchor[]): Anchor[] => {
  const merged = new Map<string, Anchor>();

  existingAnchors.forEach((anchor) => {
    const normalizedAnchor = normalizeAnchor(anchor);
    merged.set(normalizedAnchor.localId ?? normalizedAnchor.id, normalizedAnchor);
  });

  incomingAnchors.forEach((anchor) => {
    const normalizedAnchor = normalizeAnchor(anchor);
    merged.set(normalizedAnchor.localId ?? normalizedAnchor.id, normalizedAnchor);
  });

  return Array.from(merged.values()).sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()
  );
};

const calculateTotalPrimes = (anchors: Anchor[]): number =>
  anchors.reduce((sum, anchor) => sum + (anchor.activationCount ?? 0), 0);

/**
 * Anchor state interface
 */
interface AnchorState {
  // State
  anchors: Anchor[];
  totalPrimes: number;
  primeStreak: number;
  lastPrimedDate: string | null;
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: Date | null;
  currentAnchorId: string | undefined;

  // Actions
  setAnchors: (anchors: Anchor[]) => void;
  addAnchor: (anchor: Anchor) => void;
  updateAnchor: (id: string, updates: Partial<Anchor>) => void;
  removeAnchor: (id: string) => void;
  incrementTotalPrimes: () => void;
  recordPrimeSession: () => void;
  getAnchorById: (id: string) => Anchor | undefined;
  getActiveAnchors: () => Anchor[];
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  markSynced: () => void;
  clearAnchors: () => void;
  setCurrentAnchor: (id: string | undefined) => void;
  applySyncedAnchor: (referenceId: string, anchor: Anchor) => void;
  flushPendingSync: () => Promise<void>;
  releaseAnchor: (id: string) => void;
}

/**
 * Anchor store with persistence
 */
export const useAnchorStore = create<AnchorState>()(
  persist(
    (set, get) => ({
      // Initial state
      anchors: [],
      totalPrimes: 0,
      primeStreak: 0,
      lastPrimedDate: null,
      isLoading: false,
      error: null,
      lastSyncedAt: null,
      currentAnchorId: undefined,

      // Actions
      setAnchors: (anchors) =>
        set({
          anchors: mergeAnchors([], anchors),
          totalPrimes: calculateTotalPrimes(anchors),
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
          totalPrimes: state.totalPrimes + (anchor.activationCount ?? 0),
          error: null,
        }));

        const authStore = useAuthStore.getState();
        if (AnchorSyncService.isConfigured() && authStore.isAuthenticated && authStore.user?.id) {
          void AnchorSyncService.upsertAnchor(anchor, authStore.user.id)
            .then((syncedAnchor) => {
              get().applySyncedAnchor(anchor.localId ?? anchor.id, syncedAnchor);
              get().markSynced();
            })
            .catch(async (error) => {
              logger.warn('[anchorStore] Failed to sync new anchor, queueing retry', error);
              await AnchorSyncService.enqueueRetry(anchor, authStore.user!.id);
            });
        }
      },

      updateAnchor: (id, updates) =>
        set((state) => {
          const shouldPromoteCurrent =
            updates.lastActivatedAt != null || updates.chargedAt != null;

          const nextAnchors = state.anchors.map((anchor) =>
            matchesAnchorReference(anchor, id)
              ? {
                ...anchor,
                ...updates,
                updatedAt: new Date(),
              }
              : anchor
          );

          const updatedAnchor = nextAnchors.find((anchor) => matchesAnchorReference(anchor, id));

          const authStore = useAuthStore.getState();
          if (
            AnchorSyncService.isConfigured() &&
            updatedAnchor &&
            authStore.isAuthenticated &&
            authStore.user?.id
          ) {
            void AnchorSyncService.upsertAnchor(updatedAnchor, authStore.user.id)
              .then((syncedAnchor) => {
                get().applySyncedAnchor(updatedAnchor.localId ?? updatedAnchor.id, syncedAnchor);
                get().markSynced();
              })
              .catch(async (error) => {
                logger.warn('[anchorStore] Failed to sync anchor update, queueing retry', error);
                await AnchorSyncService.enqueueRetry(updatedAnchor, authStore.user!.id);
              });
          }

          return {
            anchors: nextAnchors,
            currentAnchorId: shouldPromoteCurrent ? id : state.currentAnchorId,
            error: null,
          };
        }),

      removeAnchor: (id) =>
        set((state) => {
          const nextAnchors = state.anchors.filter((anchor) => !matchesAnchorReference(anchor, id));

          return {
            anchors: nextAnchors,
            totalPrimes: calculateTotalPrimes(nextAnchors),
            error: null,
          };
        }),

      incrementTotalPrimes: () => {
        const nextTotalPrimes = get().totalPrimes + 1;

        set({
          totalPrimes: nextTotalPrimes,
        });

        checkAndRecordMilestones(nextTotalPrimes).catch(() => {});
      },

      recordPrimeSession: () => {
        const today = getAdjustedDateString();
        const { lastPrimedDate, primeStreak } = get();

        if (lastPrimedDate === today) {
          return;
        }

        const yesterday = getAdjustedDateString(
          new Date(Date.now() - 24 * 60 * 60 * 1000)
        );

        const newStreak =
          lastPrimedDate === yesterday
            ? primeStreak + 1
            : 1;

        set({ primeStreak: newStreak, lastPrimedDate: today });
      },

      getAnchorById: (id) => {
        const state = get();
        return state.anchors.find((anchor) => matchesAnchorReference(anchor, id));
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
          totalPrimes: 0,
          primeStreak: 0,
          lastPrimedDate: null,
          error: null,
          lastSyncedAt: null,
          currentAnchorId: undefined,
        }),

      setCurrentAnchor: (id) =>
        set({
          currentAnchorId: id,
        }),

      applySyncedAnchor: (referenceId, anchor) =>
        set((state) => {
          const syncedAnchor = {
            ...anchor,
            localId: anchor.localId ?? referenceId,
          };

          return {
            anchors: mergeAnchors(
              state.anchors.filter((existingAnchor) => !matchesAnchorReference(existingAnchor, referenceId)),
              [syncedAnchor]
            ),
            totalPrimes: calculateTotalPrimes(
              mergeAnchors(
                state.anchors.filter((existingAnchor) => !matchesAnchorReference(existingAnchor, referenceId)),
                [syncedAnchor]
              )
            ),
            currentAnchorId:
              state.currentAnchorId && state.currentAnchorId === referenceId
                ? syncedAnchor.id
                : state.currentAnchorId,
            error: null,
          };
        }),

      flushPendingSync: async () => {
        const authStore = useAuthStore.getState();
        if (
          !AnchorSyncService.isConfigured() ||
          !authStore.isAuthenticated ||
          !authStore.user?.id
        ) {
          return;
        }

        const syncedAnchors = await AnchorSyncService.flushRetryQueue(authStore.user.id);
        if (syncedAnchors.length > 0) {
          set((state) => {
            const nextAnchors = mergeAnchors(state.anchors, syncedAnchors);

            return {
              anchors: nextAnchors,
              totalPrimes: calculateTotalPrimes(nextAnchors),
              error: null,
            };
          });
          get().markSynced();
        }
      },

      releaseAnchor: (id) =>
        set((state) => {
          const nextAnchors = state.anchors.map((anchor) =>
            matchesAnchorReference(anchor, id)
              ? {
                ...anchor,
                isReleased: true,
                releasedAt: new Date(),
                updatedAt: new Date(),
              }
              : anchor
          );

          return {
            anchors: nextAnchors,
            error: null,
          };
        }),
    }),
    {
      name: 'anchor-vault-storage',
      storage: createJSONStorage(() => encryptedPersistStorage),
      // Persist anchors, last sync time, and currentAnchorId
      partialize: (state) => ({
        anchors: state.anchors,
        totalPrimes: state.totalPrimes,
        primeStreak: state.primeStreak,
        lastPrimedDate: state.lastPrimedDate,
        lastSyncedAt: state.lastSyncedAt,
        currentAnchorId: state.currentAnchorId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }

        state.anchors = mergeAnchors([], state.anchors ?? []);
        state.totalPrimes = calculateTotalPrimes(state.anchors);
      },
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
