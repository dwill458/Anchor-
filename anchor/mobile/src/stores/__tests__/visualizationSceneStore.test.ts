import {
  normalizeSuggestionIndex,
  useVisualizationSceneStore,
} from '../visualizationSceneStore';
import type { VisualizationScene } from '@/types/practice';

const ACCOUNT = 'account-1';
const ANCHOR = 'anchor-1';
const BATCH = ['Scene one.', 'Scene two.', 'Scene three.'];

const buildScene = (overrides: Partial<VisualizationScene> = {}): VisualizationScene => ({
  accountId: ACCOUNT,
  anchorId: ANCHOR,
  anchorLocalId: null,
  currentText: 'Scene one.',
  originalSuggestion: 'Scene one.',
  generationSource: 'gemini',
  generationVersion: 'scene-v1',
  clientUpdatedAt: new Date().toISOString(),
  syncState: 'pending',
  ...overrides,
});

const reset = (): void => {
  useVisualizationSceneStore.setState({
    ownerAccountId: null,
    scenes: {},
    suggestions: {},
    selectedSuggestionIndex: {},
    batchSource: {},
    upgradeAttempts: {},
    tombstonedAnchorIds: [],
  });
};

describe('visualizationSceneStore', () => {
  beforeEach(reset);

  describe('normalizeSuggestionIndex', () => {
    it.each([
      [0, 3, 0],
      [2, 3, 2],
      [3, 3, 0], // out of range after the batch shrank
      [-1, 3, 0],
      [undefined, 3, 0],
      [1, 0, 0], // empty batch
      [1.5, 3, 0], // non-integer from a corrupted persist payload
    ])('normalizes index %p against length %i to %i', (index, length, expected) => {
      expect(normalizeSuggestionIndex(index as number | undefined, length)).toBe(expected);
    });
  });

  describe('suggestion batches', () => {
    it('stores a batch and initialises its position', () => {
      const store = useVisualizationSceneStore.getState();
      store.bindAccount(ACCOUNT);
      store.setSuggestions(ANCHOR, BATCH);

      const state = useVisualizationSceneStore.getState();
      expect(state.suggestions[ANCHOR]).toEqual(BATCH);
      expect(state.selectedSuggestionIndex[ANCHOR]).toBe(0);
    });

    it('clamps a retained position when a replacement batch is shorter', () => {
      const store = useVisualizationSceneStore.getState();
      store.bindAccount(ACCOUNT);
      store.setSuggestions(ANCHOR, BATCH);
      store.setSelectedSuggestionIndex(ANCHOR, 2);
      useVisualizationSceneStore.getState().setSuggestions(ANCHOR, ['Only one.']);

      expect(useVisualizationSceneStore.getState().selectedSuggestionIndex[ANCHOR]).toBe(0);
    });

    it('rejects a batch write for a tombstoned anchor', () => {
      const store = useVisualizationSceneStore.getState();
      store.bindAccount(ACCOUNT);
      store.removeForAnchor([ANCHOR]);
      useVisualizationSceneStore.getState().setSuggestions(ANCHOR, BATCH);

      expect(useVisualizationSceneStore.getState().suggestions[ANCHOR]).toBeUndefined();
    });

    it('clears the batch and its position when an anchor is released', () => {
      const store = useVisualizationSceneStore.getState();
      store.bindAccount(ACCOUNT);
      store.setSuggestions(ANCHOR, BATCH);
      store.setScene(buildScene());
      useVisualizationSceneStore.getState().removeForAnchor([ANCHOR]);

      const state = useVisualizationSceneStore.getState();
      expect(state.suggestions[ANCHOR]).toBeUndefined();
      expect(state.selectedSuggestionIndex[ANCHOR]).toBeUndefined();
      expect(state.scenes[ANCHOR]).toBeUndefined();
    });
  });

  describe('rotateSuggestion', () => {
    beforeEach(() => {
      const store = useVisualizationSceneStore.getState();
      store.bindAccount(ACCOUNT);
      store.setSuggestions(ANCHOR, BATCH);
    });

    it('advances one position at a time', () => {
      expect(useVisualizationSceneStore.getState().rotateSuggestion(ANCHOR)).toBe(BATCH[1]);
      expect(useVisualizationSceneStore.getState().selectedSuggestionIndex[ANCHOR]).toBe(1);
      expect(useVisualizationSceneStore.getState().rotateSuggestion(ANCHOR)).toBe(BATCH[2]);
    });

    it('wraps from the last scene back to the first', () => {
      const store = () => useVisualizationSceneStore.getState();
      store().rotateSuggestion(ANCHOR);
      store().rotateSuggestion(ANCHOR);
      expect(store().selectedSuggestionIndex[ANCHOR]).toBe(2);

      expect(store().rotateSuggestion(ANCHOR)).toBe(BATCH[0]);
      expect(store().selectedSuggestionIndex[ANCHOR]).toBe(0);
    });

    it('returns null for an anchor with no batch rather than crashing', () => {
      expect(useVisualizationSceneStore.getState().rotateSuggestion('unknown')).toBeNull();
    });

    it('returns null for an empty batch rather than crashing', () => {
      useVisualizationSceneStore.getState().setSuggestions('empty-anchor', []);
      expect(useVisualizationSceneStore.getState().rotateSuggestion('empty-anchor')).toBeNull();
    });
  });

  describe('account scoping', () => {
    it('wipes batches and positions when the account changes', () => {
      const store = useVisualizationSceneStore.getState();
      store.bindAccount(ACCOUNT);
      store.setSuggestions(ANCHOR, BATCH);
      store.setSelectedSuggestionIndex(ANCHOR, 2);

      useVisualizationSceneStore.getState().bindAccount('account-2');

      const state = useVisualizationSceneStore.getState();
      expect(state.suggestions).toEqual({});
      expect(state.selectedSuggestionIndex).toEqual({});
      expect(state.scenes).toEqual({});
    });

    it('does not wipe when rebinding the same account', () => {
      const store = useVisualizationSceneStore.getState();
      store.bindAccount(ACCOUNT);
      store.setSuggestions(ANCHOR, BATCH);

      useVisualizationSceneStore.getState().bindAccount(ACCOUNT);
      expect(useVisualizationSceneStore.getState().suggestions[ANCHOR]).toEqual(BATCH);
    });

    it('clears batches on sign-out', () => {
      const store = useVisualizationSceneStore.getState();
      store.bindAccount(ACCOUNT);
      store.setSuggestions(ANCHOR, BATCH);

      useVisualizationSceneStore.getState().clearActiveAccount();

      const state = useVisualizationSceneStore.getState();
      expect(state.suggestions).toEqual({});
      expect(state.selectedSuggestionIndex).toEqual({});
      expect(state.ownerAccountId).toBeNull();
    });

    it('refuses a scene write from a foreign account', () => {
      const store = useVisualizationSceneStore.getState();
      store.bindAccount(ACCOUNT);
      store.setScene(buildScene({ accountId: 'someone-else' }));

      expect(useVisualizationSceneStore.getState().scenes[ANCHOR]).toBeUndefined();
    });
  });

  describe('persist migration', () => {
    const migrate = useVisualizationSceneStore.persist.getOptions().migrate!;

    it('initialises the new maps for a v0 payload without touching scenes', () => {
      const v0 = {
        ownerAccountId: ACCOUNT,
        scenes: { [ANCHOR]: buildScene() },
        tombstonedAnchorIds: [],
      };

      const migrated = migrate(v0, 0) as ReturnType<typeof useVisualizationSceneStore.getState>;

      expect(migrated.suggestions).toEqual({});
      expect(migrated.selectedSuggestionIndex).toEqual({});
      expect(migrated.upgradeAttempts).toEqual({});
      expect(migrated.scenes[ANCHOR]).toEqual(v0.scenes[ANCHOR]);
    });

    it('preserves a v1 batch and leaves the upgrade ledger empty', () => {
      const v1 = {
        ownerAccountId: ACCOUNT,
        scenes: {},
        suggestions: { [ANCHOR]: BATCH },
        selectedSuggestionIndex: { [ANCHOR]: 2 },
        tombstonedAnchorIds: [],
      };

      const migrated = migrate(v1, 1) as ReturnType<typeof useVisualizationSceneStore.getState>;
      expect(migrated.suggestions[ANCHOR]).toEqual(BATCH);
      expect(migrated.selectedSuggestionIndex[ANCHOR]).toBe(2);
      // A v1 device has never been offered an upgrade, so it must get one.
      expect(migrated.upgradeAttempts).toEqual({});
    });

    it('passes a v2 payload through with its upgrade ledger intact', () => {
      const attempt = { attemptedAt: new Date().toISOString(), retryable: false };
      const v2 = {
        ownerAccountId: ACCOUNT,
        scenes: {},
        suggestions: { [ANCHOR]: BATCH },
        selectedSuggestionIndex: { [ANCHOR]: 1 },
        upgradeAttempts: { [ANCHOR]: attempt },
        tombstonedAnchorIds: [],
      };

      const migrated = migrate(v2, 2) as ReturnType<typeof useVisualizationSceneStore.getState>;
      expect(migrated.upgradeAttempts[ANCHOR]).toEqual(attempt);
    });

    it('tolerates an undefined payload', () => {
      const migrated = migrate(undefined, 0) as ReturnType<
        typeof useVisualizationSceneStore.getState
      >;
      expect(migrated.suggestions).toEqual({});
      expect(migrated.selectedSuggestionIndex).toEqual({});
      expect(migrated.upgradeAttempts).toEqual({});
    });
  });

  describe('upgrade ledger', () => {
    it('records an attempt with its retryability', () => {
      useVisualizationSceneStore.getState().recordUpgradeAttempt(ANCHOR, { retryable: true, reason: 'client_request_failed', generationVersion: 'scene-v1' });

      const attempt = useVisualizationSceneStore.getState().upgradeAttempts[ANCHOR];
      expect(attempt.retryable).toBe(true);
      expect(Date.parse(attempt.attemptedAt)).not.toBeNaN();
    });

    it('is cleared when the anchor is released', () => {
      const store = useVisualizationSceneStore.getState();
      store.bindAccount(ACCOUNT);
      store.recordUpgradeAttempt(ANCHOR, { retryable: false, reason: 'insufficient_valid_scenes', generationVersion: 'scene-v1' });
      useVisualizationSceneStore.getState().removeForAnchor([ANCHOR]);

      expect(useVisualizationSceneStore.getState().upgradeAttempts[ANCHOR]).toBeUndefined();
    });

    it('is cleared when the account changes', () => {
      const store = useVisualizationSceneStore.getState();
      store.bindAccount(ACCOUNT);
      store.recordUpgradeAttempt(ANCHOR, { retryable: false, reason: 'insufficient_valid_scenes', generationVersion: 'scene-v1' });
      useVisualizationSceneStore.getState().bindAccount('account-2');

      expect(useVisualizationSceneStore.getState().upgradeAttempts).toEqual({});
    });

    it('is persisted so the attempt is not repeated after a restart', () => {
      const partialize = useVisualizationSceneStore.persist.getOptions().partialize!;
      useVisualizationSceneStore.getState().recordUpgradeAttempt(ANCHOR, { retryable: false, reason: 'insufficient_valid_scenes', generationVersion: 'scene-v1' });

      const persisted = partialize(useVisualizationSceneStore.getState()) as Record<
        string,
        unknown
      >;
      expect(persisted.upgradeAttempts).toHaveProperty(ANCHOR);
    });
  });

  describe('persisted shape', () => {
    it('includes the batch and its position so rotation survives a restart', () => {
      const partialize = useVisualizationSceneStore.persist.getOptions().partialize!;
      const store = useVisualizationSceneStore.getState();
      store.bindAccount(ACCOUNT);
      store.setSuggestions(ANCHOR, BATCH);
      store.setSelectedSuggestionIndex(ANCHOR, 1);

      const persisted = partialize(useVisualizationSceneStore.getState()) as Record<
        string,
        unknown
      >;

      expect(persisted.suggestions).toEqual({ [ANCHOR]: BATCH });
      expect(persisted.selectedSuggestionIndex).toEqual({ [ANCHOR]: 1 });
      expect(persisted.ownerAccountId).toBe(ACCOUNT);
    });
  });
});
