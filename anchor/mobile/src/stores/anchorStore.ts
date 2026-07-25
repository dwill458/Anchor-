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
import { useVisualizationSceneStore } from './visualizationSceneStore';
import {
  JOURNEY_MILESTONE_IDS,
  JOURNEY_TEACHING_CONTENT_ID_BY_MILESTONE,
} from '@/constants/milestones';

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
          teaching.queueMilestone(
            JOURNEY_TEACHING_CONTENT_ID_BY_MILESTONE[JOURNEY_MILESTONE_IDS.firstAnchor]
          );
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

      removeAnchor: (id) => {
        const target = get().getAnchorById(id);
        const referenceIds = Array.from(
          new Set([id, target?.id, target?.localId].filter((value): value is string => Boolean(value)))
        );

        // Tombstone the anchor and drop any queued sync retries so a later
        // queue flush (or a late failure callback) cannot resurrect it.
        void AnchorSyncService.markAnchorDeleted(referenceIds).catch((error) => {
          logger.warn('[anchorStore] Failed to invalidate queued sync for removed anchor', error);
        });
        useVisualizationSceneStore.getState().removeForAnchor(referenceIds);

        set((state) => {
          const nextAnchors = state.anchors.filter((anchor) => !matchesAnchorReference(anchor, id));

          return {
            anchors: nextAnchors,
            totalPrimes: calculateTotalPrimes(nextAnchors),
            error: null,
          };
        });
      },

      incrementTotalPrimes: () => {
        const nextTotalPrimes = get().totalPrimes + 1;

        set({
          totalPrimes: nextTotalPrimes,
        });
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
          const existingAnchor = state.anchors.find((candidate) =>
            matchesAnchorReference(candidate, referenceId)
          );

          // The anchor was removed while its sync was in flight — applying the
          // synced snapshot would resurrect it. Keep it deleted.
          if (!existingAnchor) {
            return { error: null };
          }

          const syncedAnchor = {
            ...anchor,
            localId: anchor.localId ?? referenceId,
            // A sync started before a burn must not return the anchor to the
            // active vault: preserve local released/archived state.
            isReleased: existingAnchor.isReleased || anchor.isReleased,
            releasedAt: existingAnchor.releasedAt ?? normalizeDate(anchor.releasedAt),
            archivedAt: existingAnchor.archivedAt ?? normalizeDate(anchor.archivedAt),
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
            // Queued retries hold snapshots that may predate a local delete or
            // burn. Only merge back anchors that still exist locally, and never
            // let a stale snapshot pull a released/archived anchor back into
            // the active vault.
            const applicableAnchors = syncedAnchors.filter((syncedAnchor) => {
              const localAnchor = state.anchors.find(
                (anchor) =>
                  matchesAnchorReference(anchor, syncedAnchor.localId ?? syncedAnchor.id) ||
                  matchesAnchorReference(anchor, syncedAnchor.id)
              );

              if (!localAnchor) {
                return false;
              }

              const localIsRetired = Boolean(localAnchor.isReleased || localAnchor.archivedAt);
              const syncedIsRetired = Boolean(syncedAnchor.isReleased || syncedAnchor.archivedAt);
              return !(localIsRetired && !syncedIsRetired);
            });

            if (applicableAnchors.length === 0) {
              return { error: null };
            }

            const nextAnchors = mergeAnchors(state.anchors, applicableAnchors);

            return {
              anchors: nextAnchors,
              totalPrimes: calculateTotalPrimes(nextAnchors),
              error: null,
            };
          });
          get().markSynced();
        }
      },

      releaseAnchor: (id) => {
        const target = get().getAnchorById(id);
        const referenceIds = Array.from(
          new Set([id, target?.id, target?.localId].filter((value): value is string => Boolean(value)))
        );

        // Drop queued sync retries holding a pre-burn snapshot so a later
        // flush cannot return the burned anchor to the active vault. No
        // tombstone: the anchor still exists locally as released/archived.
        void AnchorSyncService.cancelQueuedSync(referenceIds).catch((error) => {
          logger.warn('[anchorStore] Failed to cancel queued sync for released anchor', error);
        });
        useVisualizationSceneStore.getState().removeForAnchor(referenceIds);

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
        });
      },
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
