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
import { HomeStartupProfiler } from '@/utils/homeStartupProfiler';
import { perfLog } from '@/utils/perfDiagnostics';
import { useVisualizationSceneStore } from './visualizationSceneStore';
import {
  JOURNEY_MILESTONE_IDS,
  JOURNEY_TEACHING_CONTENT_ID_BY_MILESTONE,
} from '@/constants/milestones';

const normalizeDate = (value?: Date | string): Date | undefined => {
  if (!value) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const isMarkedMissingUpdatedAt = (value: unknown): boolean =>
  Boolean(
    value &&
      typeof value === 'object' &&
      (value as { __missingUpdatedAt?: boolean }).__missingUpdatedAt === true
  );

const createMissingUpdatedAtDate = (fallback?: Date): Date => {
  const date = new Date(fallback ? fallback.getTime() : Date.now());
  Object.defineProperty(date, '__missingUpdatedAt', {
    value: true,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(date, 'toJSON', {
    value: () => null,
    enumerable: false,
    configurable: true,
  });
  return date;
};

const defineMissingUpdatedAtMarker = (anchor: Anchor): Anchor => {
  if ('__missingUpdatedAt' in anchor) {
    delete (anchor as { __missingUpdatedAt?: boolean }).__missingUpdatedAt;
  }
  Object.defineProperty(anchor, '__missingUpdatedAt', {
    value: true,
    enumerable: false,
    configurable: true,
  });
  return anchor;
};

const normalizeAnchor = (anchor: Anchor): Anchor => {
  const rawUpdatedAt = isMarkedMissingUpdatedAt(anchor.updatedAt)
    ? undefined
    : normalizeDate(anchor.updatedAt);
  const hadMissingUpdatedAt =
    !rawUpdatedAt ||
    isMarkedMissingUpdatedAt(anchor) ||
    isMarkedMissingUpdatedAt(anchor.updatedAt);
  const createdAt =
    anchor.createdAt instanceof Date && !Number.isNaN(anchor.createdAt.getTime())
      ? anchor.createdAt
      : normalizeDate(anchor.createdAt) ?? new Date();
  const fallbackUpdatedAt = normalizeDate(anchor.updatedAt) ?? createdAt;
  const normalized: Anchor = {
    ...anchor,
    createdAt,
    updatedAt: hadMissingUpdatedAt
      ? createMissingUpdatedAtDate(fallbackUpdatedAt)
      : rawUpdatedAt,
    chargedAt: anchor.chargedAt instanceof Date ? anchor.chargedAt : normalizeDate(anchor.chargedAt),
    firstChargedAt: anchor.firstChargedAt instanceof Date ? anchor.firstChargedAt : normalizeDate(anchor.firstChargedAt),
    ignitedAt: anchor.ignitedAt instanceof Date ? anchor.ignitedAt : normalizeDate(anchor.ignitedAt),
    lastActivatedAt: anchor.lastActivatedAt instanceof Date ? anchor.lastActivatedAt : normalizeDate(anchor.lastActivatedAt),
    releasedAt: anchor.releasedAt instanceof Date ? anchor.releasedAt : normalizeDate(anchor.releasedAt),
    archivedAt: anchor.archivedAt instanceof Date ? anchor.archivedAt : normalizeDate(anchor.archivedAt),
  };
  if ('__missingUpdatedAt' in normalized) {
    delete (normalized as { __missingUpdatedAt?: boolean }).__missingUpdatedAt;
  }
  if (hadMissingUpdatedAt) {
    defineMissingUpdatedAtMarker(normalized);
  }
  return normalized;
};

const matchesAnchorReference = (anchor: Anchor, referenceId: string): boolean =>
  anchor.id === referenceId || anchor.localId === referenceId;

/**
 * `evolvedFrom` is local only: a server copy of an Anchor never carries it. Every path that brings
 * server anchors in (a full refresh, one synced anchor, a flushed retry) merges it forward from the
 * local record, matched by id or localId in either direction, so a sync can never erase the link.
 */
const carryForwardEvolvedFrom = (incomingAnchors: Anchor[], localAnchors: Anchor[]): Anchor[] => {
  const linked = localAnchors.filter((anchor) => anchor.evolvedFrom);
  if (linked.length === 0) return incomingAnchors;

  return incomingAnchors.map((anchor) => {
    if (anchor.evolvedFrom) return anchor;
    const local = linked.find(
      (candidate) =>
        matchesAnchorReference(candidate, anchor.id) ||
        (anchor.localId ? matchesAnchorReference(candidate, anchor.localId) : false)
    );
    if (!local) return anchor;
    const nextAnchor: Anchor = { ...anchor, evolvedFrom: local.evolvedFrom };
    if (isMarkedMissingUpdatedAt(anchor) || isMarkedMissingUpdatedAt(anchor.updatedAt)) {
      defineMissingUpdatedAtMarker(nextAnchor);
    }
    return nextAnchor;
  });
};

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
  /** Local encrypted store has finished rehydrating this process. */
  persistedHydrated: boolean;
  /** A successful server confirmation is required before showing the empty state. */
  remoteAnchorState: 'unknown' | 'loading' | 'confirmed' | 'error';
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
  setRemoteAnchorState: (state: AnchorState['remoteAnchorState']) => void;
  setPersistedHydrated: (hydrated: boolean) => void;
  setError: (error: string | null) => void;
  markSynced: () => void;
  clearAnchors: () => void;
  setCurrentAnchor: (id: string | undefined) => void;
  applySyncedAnchor: (referenceId: string, anchor: Anchor) => void;
  flushPendingSync: () => Promise<void>;
  releaseAnchor: (id: string) => void;
  /**
   * Record, on the successor of a completed evolve, the released Anchor it continues from. Local only:
   * no sync, no `updatedAt` change. Written once; a successor that is already linked, is itself
   * released/archived, or is the released Anchor itself is left untouched.
   */
  linkEvolvedFrom: (successorId: string, from: { anchorId: string; intention: string }) => void;
}

/**
 * Anchor store with persistence
 */
export const useAnchorStore = create<AnchorState>()(
  persist(
    (set, get) => ({
      // Initial state
      anchors: [],
      persistedHydrated: false,
      remoteAnchorState: 'unknown',
      totalPrimes: 0,
      primeStreak: 0,
      lastPrimedDate: null,
      isLoading: false,
      error: null,
      lastSyncedAt: null,
      currentAnchorId: undefined,

      // Actions
      setAnchors: (anchors) =>
        set((state) => {
          if (anchors && anchors.length > 0) {
            const teaching = useTeachingStore.getState();
            if (!teaching.userFlags.hasCreatedFirstAnchor) {
              teaching.setUserFlag('hasCreatedFirstAnchor', true);
            }
          }
          return {
            anchors: mergeAnchors([], carryForwardEvolvedFrom(anchors, state.anchors)),
            totalPrimes: calculateTotalPrimes(anchors),
            error: null,
          };
        }),

      addAnchor: (anchor) => {
        const normalizedAnchor = normalizeAnchor(anchor);
        const teaching = useTeachingStore.getState();
        // Set first-anchor flag once; queue M1 milestone
        if (!teaching.userFlags.hasCreatedFirstAnchor) {
          teaching.setUserFlag('hasCreatedFirstAnchor', true);
          teaching.queueMilestone(
            JOURNEY_TEACHING_CONTENT_ID_BY_MILESTONE[JOURNEY_MILESTONE_IDS.firstAnchor]
          );
        }
        set((state) => ({
          anchors: [normalizedAnchor, ...state.anchors], // Add to beginning (most recent first)
          totalPrimes: state.totalPrimes + (normalizedAnchor.activationCount ?? 0),
          error: null,
        }));

        const authStore = useAuthStore.getState();
        if (AnchorSyncService.isConfigured() && authStore.isAuthenticated && authStore.user?.id) {
          void AnchorSyncService.upsertAnchor(normalizedAnchor, authStore.user.id)
            .then((syncedAnchor) => {
              get().applySyncedAnchor(normalizedAnchor.localId ?? normalizedAnchor.id, syncedAnchor);
              get().markSynced();
            })
            .catch(async (error) => {
              logger.warn('[anchorStore] Failed to sync new anchor, queueing retry', error);
              await AnchorSyncService.enqueueRetry(normalizedAnchor, authStore.user!.id);
            });
        }
      },

      updateAnchor: (id, updates) =>
        set((state) => {
          const shouldPromoteCurrent =
            updates.lastActivatedAt != null || updates.chargedAt != null;
          const hasExplicitMissingUpdatedAt =
            'updatedAt' in updates &&
            (isMarkedMissingUpdatedAt(updates.updatedAt) || !normalizeDate(updates.updatedAt));

          const nextAnchors = state.anchors.map((anchor) => {
            if (!matchesAnchorReference(anchor, id)) {
              return anchor;
            }
            if (hasExplicitMissingUpdatedAt) {
              return normalizeAnchor({
                ...anchor,
                ...updates,
                updatedAt: undefined as unknown as Date,
              });
            }
            const nextUpdatedAt =
              'updatedAt' in updates && normalizeDate(updates.updatedAt)
                ? normalizeDate(updates.updatedAt)!
                : new Date();
            const updated: Anchor = {
              ...anchor,
              ...updates,
              updatedAt: nextUpdatedAt,
            };
            if ('__missingUpdatedAt' in updated) {
              delete (updated as { __missingUpdatedAt?: boolean }).__missingUpdatedAt;
            }
            return updated;
          });

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

      setRemoteAnchorState: (remoteAnchorState) => set({ remoteAnchorState }),
      setPersistedHydrated: (persistedHydrated) => set({ persistedHydrated }),

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
          remoteAnchorState: 'unknown',
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
            // Local only: the server copy never has it.
            ...(anchor.evolvedFrom ?? existingAnchor.evolvedFrom
              ? { evolvedFrom: anchor.evolvedFrom ?? existingAnchor.evolvedFrom }
              : {}),
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

            const nextAnchors = mergeAnchors(state.anchors, carryForwardEvolvedFrom(applicableAnchors, state.anchors));

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

      linkEvolvedFrom: (successorId, from) =>
        set((state) => {
          const successor = state.anchors.find((anchor) => matchesAnchorReference(anchor, successorId));
          if (!successor || successor.evolvedFrom) return state;
          // Never onto a released or archived Anchor, and never onto the Anchor that was released.
          if (successor.isReleased || successor.archivedAt) return state;
          if (matchesAnchorReference(successor, from.anchorId)) return state;

          return {
            anchors: state.anchors.map((anchor) => {
              if (anchor !== successor) return anchor;
              const nextAnchor: Anchor = {
                ...anchor,
                evolvedFrom: { anchorId: from.anchorId, intention: from.intention },
              };
              if (isMarkedMissingUpdatedAt(anchor) || isMarkedMissingUpdatedAt(anchor.updatedAt)) {
                defineMissingUpdatedAtMarker(nextAnchor);
              }
              return nextAnchor;
            }),
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
      onRehydrateStorage: () => {
        const span = HomeStartupProfiler.start('anchor_store_persisted_hydration');
        return (state, error) => {
          perfLog('store-hydration-finished', { store: 'anchor', ok: !error, anchorCount: state?.anchors?.length ?? 0, hasState: Boolean(state) });
          if (!state) {
            useAnchorStore.getState().setPersistedHydrated(true);
            span({ ok: false, error: Boolean(error) });
            return;
          }

          state.anchors = mergeAnchors([], state.anchors ?? []);
          state.totalPrimes = calculateTotalPrimes(state.anchors);
          if (state.anchors.length > 0) {
            const teaching = useTeachingStore.getState();
            if (!teaching.userFlags.hasCreatedFirstAnchor) {
              teaching.setUserFlag('hasCreatedFirstAnchor', true);
            }
          }
          state.setPersistedHydrated(true);
          span({ ok: !error, anchorCount: state.anchors.length, hasSelectedAnchor: Boolean(state.currentAnchorId) });
        };
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
