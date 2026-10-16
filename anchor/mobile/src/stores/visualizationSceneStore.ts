import { privateJsonStorage, sqlCipherEnabled, resetSceneViewWithoutPersistence, readPersistedSceneOwner, mergeSceneDocuments } from '@/storage/sqlcipher/persistence';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { encryptedPersistStorage } from './encryptedPersistStorage';
import { perfLog } from '@/utils/perfDiagnostics';
import type { VisualizationScene } from '@/types/practice';

/** Where a persisted batch came from. Decides whether it is provisional. */
export type VisualizationBatchSource =
  | 'gemini'
  | 'deterministic_fallback'
  | 'seeded_legacy';

/**
 * Records the attempt to replace a legacy canned scene with a real batch.
 *
 * `generationVersion` is what makes terminal failures recoverable without a
 * store migration: bumping SCENE_GENERATION_VERSION makes every attempt
 * recorded under the old version eligible again.
 */
export interface SceneUpgradeAttempt {
  attemptedAt: string;
  retryable: boolean;
  reason: string | null;
  generationVersion: string;
}

interface VisualizationSceneState {
  storageRecoveryRequired: boolean;
  ownerRestoring: boolean;
  ownerAccountId: string | null;
  scenes: Record<string, VisualizationScene>;
  /** Persisted since v1 so rotation costs nothing and works offline. */
  suggestions: Record<string, string[]>;
  /** Position within `suggestions[anchorId]`. Persisted alongside the batch. */
  selectedSuggestionIndex: Record<string, number>;
  /** Provenance per batch. Absent means legacy/unknown — treated as provisional. */
  batchSource: Record<string, VisualizationBatchSource>;
  /** Persisted since v2. Absence means the upgrade has never been attempted. */
  upgradeAttempts: Record<string, SceneUpgradeAttempt>;
  tombstonedAnchorIds: string[];
  bindAccount: (accountId: string | null) => void;
  setScene: (scene: VisualizationScene) => void;
  setSuggestions: (
    anchorId: string,
    suggestions: string[],
    source?: VisualizationBatchSource
  ) => void;
  setSelectedSuggestionIndex: (anchorId: string, index: number) => void;
  /** Advances one position with wraparound. Returns the newly selected text. */
  rotateSuggestion: (anchorId: string) => string | null;
  recordUpgradeAttempt: (
    anchorId: string,
    attempt: Omit<SceneUpgradeAttempt, 'attemptedAt'>
  ) => void;
  markSynced: (anchorId: string, remote: Partial<VisualizationScene>) => void;
  removeForAnchor: (referenceIds: string[]) => void;
  clearActiveAccount: () => void;
}

/** Keeps a persisted index usable after a batch shrinks or fails to hydrate. */
export const normalizeSuggestionIndex = (
  index: number | undefined,
  length: number
): number => {
  if (length <= 0) return 0;
  if (!Number.isInteger(index) || index === undefined || index < 0) return 0;
  return index < length ? index : 0;
};

let explicitSceneBinding = false;
let sceneBindingGeneration = 0;
export const useVisualizationSceneStore = create<VisualizationSceneState>()(
  persist(
    (set, get) => ({
      ownerAccountId: null,
      storageRecoveryRequired: false,
      ownerRestoring: false,
      scenes: {},
      suggestions: {},
      selectedSuggestionIndex: {},
      batchSource: {},
      upgradeAttempts: {},
      tombstonedAnchorIds: [],
      bindAccount: accountId => {
        if (get().ownerAccountId === accountId && !get().storageRecoveryRequired) return;
        explicitSceneBinding = true;
        const generation = ++sceneBindingGeneration;
        const reset = () => set({
          ownerAccountId: accountId,
          storageRecoveryRequired: false,
          ownerRestoring: sqlCipherEnabled(),
          scenes: {},
          suggestions: {},
          selectedSuggestionIndex: {},
          batchSource: {},
          upgradeAttempts: {},
          tombstonedAnchorIds: [],
        });
        if (!sqlCipherEnabled()) { reset(); return; }
        resetSceneViewWithoutPersistence(reset);
        void readPersistedSceneOwner(accountId).then((saved) => {
          if (generation !== sceneBindingGeneration || get().ownerAccountId !== accountId) return;
          if (!saved) { resetSceneViewWithoutPersistence(() => set({ ownerRestoring: false })); return; }
          const state = saved.state as Partial<VisualizationSceneState>;
          if (state.ownerAccountId !== accountId) throw new Error('Scene owner mismatch requires recovery');
          const live = get();
          const tombstones = new Set([...(state.tombstonedAnchorIds ?? []), ...live.tombstonedAnchorIds]);
          const restoredMap = <T,>(saved: Record<string, T> | undefined, current: Record<string, T>) => Object.fromEntries(Object.entries({ ...saved, ...current }).filter(([id]) => !tombstones.has(id)));
          set({ ownerRestoring: false, storageRecoveryRequired: false, scenes: restoredMap(state.scenes, live.scenes), suggestions: restoredMap(state.suggestions, live.suggestions),
            selectedSuggestionIndex: restoredMap(state.selectedSuggestionIndex, live.selectedSuggestionIndex),
            batchSource: restoredMap(state.batchSource, live.batchSource), upgradeAttempts: restoredMap(state.upgradeAttempts, live.upgradeAttempts),
            tombstonedAnchorIds: [...tombstones] });
        }).catch(() => {
          if (generation === sceneBindingGeneration && get().ownerAccountId === accountId) resetSceneViewWithoutPersistence(() => set({ ownerRestoring: false, storageRecoveryRequired: true }));
        });
      },
      setScene: scene => {
        if (get().ownerRestoring || get().storageRecoveryRequired) return;
        if (get().ownerAccountId !== scene.accountId) return;
        if (get().tombstonedAnchorIds.includes(scene.anchorId)) return;
        set(state => ({ scenes: { ...state.scenes, [scene.anchorId]: scene } }));
      },
      setSuggestions: (anchorId, suggestions, source) => {
        if (get().ownerRestoring || get().storageRecoveryRequired) return;
        // A released anchor must not receive a late batch write.
        if (get().tombstonedAnchorIds.includes(anchorId)) return;
        set(state => ({
          suggestions: { ...state.suggestions, [anchorId]: suggestions },
          selectedSuggestionIndex: {
            ...state.selectedSuggestionIndex,
            [anchorId]: normalizeSuggestionIndex(
              state.selectedSuggestionIndex[anchorId],
              suggestions.length
            ),
          },
          batchSource: source
            ? { ...state.batchSource, [anchorId]: source }
            : state.batchSource,
        }));
      },
      setSelectedSuggestionIndex: (anchorId, index) =>
        set(state => ({
          selectedSuggestionIndex: {
            ...state.selectedSuggestionIndex,
            [anchorId]: normalizeSuggestionIndex(
              index,
              state.suggestions[anchorId]?.length ?? 0
            ),
          },
        })),
      rotateSuggestion: anchorId => {
        const state = get();
        const batch = state.suggestions[anchorId] ?? [];
        if (batch.length === 0) return null;
        const current = normalizeSuggestionIndex(
          state.selectedSuggestionIndex[anchorId],
          batch.length
        );
        const next = (current + 1) % batch.length;
        set({
          selectedSuggestionIndex: {
            ...state.selectedSuggestionIndex,
            [anchorId]: next,
          },
        });
        return batch[next] ?? null;
      },
      recordUpgradeAttempt: (anchorId, attempt) =>
        set(state => ({
          upgradeAttempts: {
            ...state.upgradeAttempts,
            [anchorId]: { attemptedAt: new Date().toISOString(), ...attempt },
          },
        })),
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
          const selectedSuggestionIndex = Object.fromEntries(
            Object.entries(state.selectedSuggestionIndex).filter(
              ([anchorId]) => !refs.has(anchorId)
            )
          );
          const upgradeAttempts = Object.fromEntries(
            Object.entries(state.upgradeAttempts).filter(([anchorId]) => !refs.has(anchorId))
          );
          const batchSource = Object.fromEntries(
            Object.entries(state.batchSource).filter(([anchorId]) => !refs.has(anchorId))
          );
          return {
            scenes,
            suggestions,
            selectedSuggestionIndex,
            batchSource,
            upgradeAttempts,
            tombstonedAnchorIds: Array.from(
              new Set([...state.tombstonedAnchorIds, ...referenceIds])
            ).slice(-200),
          };
        }),
      clearActiveAccount: () =>
        set({
          ownerAccountId: null,
          scenes: {},
          suggestions: {},
          selectedSuggestionIndex: {},
          batchSource: {},
          upgradeAttempts: {},
        }),
    }),
    {
      name: 'anchor-visualization-scenes-v1',
      storage: privateJsonStorage(encryptedPersistStorage),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<VisualizationSceneState>;
        if (sqlCipherEnabled() && explicitSceneBinding && saved.ownerAccountId !== current.ownerAccountId) return current;
        if (sqlCipherEnabled() && saved.ownerAccountId === current.ownerAccountId) {
          return { ...current, ...mergeSceneDocuments({ state: saved }, { state: current }).state, storageRecoveryRequired: false, ownerRestoring: false };
        }
        return { ...current, ...saved, storageRecoveryRequired: false, ownerRestoring: false };
      },
      version: 2,
      // v0 persisted scenes only, so every rotation after a restart cost a
      // provider request. v1 adds the batch and its position. v2 adds the
      // one-time upgrade ledger. Every step only adds maps — saved scenes are
      // carried through untouched at each version.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<VisualizationSceneState>;
        return {
          ...state,
          suggestions: state.suggestions ?? {},
          selectedSuggestionIndex: state.selectedSuggestionIndex ?? {},
          // Absent for v0 and v1, which is exactly right: those anchors have
          // never been offered an upgrade and should get one attempt.
          upgradeAttempts: version >= 2 ? (state.upgradeAttempts ?? {}) : {},
          // A v1 batch has unknown provenance. Leaving it absent marks it
          // provisional, so a legacy anchor still gets its upgrade attempt.
          batchSource: version >= 2 ? (state.batchSource ?? {}) : {},
        } as VisualizationSceneState;
      },
      partialize: state => ({
        ownerAccountId: state.ownerAccountId,
        scenes: state.scenes,
        suggestions: state.suggestions,
        selectedSuggestionIndex: state.selectedSuggestionIndex,
        batchSource: state.batchSource,
        upgradeAttempts: state.upgradeAttempts,
        tombstonedAnchorIds: state.tombstonedAnchorIds,
      }),
      // Hydration can restore a batch/index pair that no longer agrees (e.g. a
      // partial write); clamp every index so rotation can never read undefined.
      onRehydrateStorage: () => (hydrated, error) => {
        perfLog('store-hydration-finished', { store: 'visualizationScene', ok: !error, sceneCount: Object.keys(hydrated?.scenes ?? {}).length, hasState: Boolean(hydrated) });
        if (!hydrated) return;
        const repaired: Record<string, number> = {};
        for (const [anchorId, batch] of Object.entries(hydrated.suggestions ?? {})) {
          repaired[anchorId] = normalizeSuggestionIndex(
            hydrated.selectedSuggestionIndex?.[anchorId],
            batch?.length ?? 0
          );
        }
        useVisualizationSceneStore.setState({ selectedSuggestionIndex: repaired });
      },
    }
  )
);
