jest.mock('../ApiClient', () => {
  const actual = jest.requireActual('../ApiClient');
  return {
    ...actual,
    apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  };
});
jest.mock('../BackendAnchorService', () => ({ isBackendAnchorId: () => true }));

import VisualizationSceneService, {
  buildFallbackSceneSuggestions,
  classifyClientRequestFailure,
  isDeterministicSceneText,
  isRetryableUpgradeReason,
  normalizeVisualizationSceneText,
  SCENE_GENERATION_VERSION,
  SCENE_UPGRADE_RETRY_COOLDOWN_MS,
  validateVisualizationSceneText,
  visualizationLatencyBucket,
  type EnsureBatchOutcome,
  type GenerateResult,
} from '../VisualizationSceneService';
import { apiClient, ApiClientError } from '../ApiClient';
import { useVisualizationSceneStore } from '@/stores/visualizationSceneStore';
import type { Anchor } from '@/types';
import type { VisualizationScene } from '@/types/practice';

const mockedApi = apiClient as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
};

const ACCOUNT = 'account-1';
const AI_BATCH = [
  'I silence my phone and open only the file I planned to work on.',
  'I notice the pull to check messages, let it pass, and return to the work.',
  'I close the extra tabs and begin the task I chose before I sat down.',
];

const anchor = {
  id: 'anchor-1',
  localId: null,
  category: 'career',
  intentionText: 'Protect my 2 hours of deep focus',
} as unknown as Anchor;

const resetStore = (): void => {
  useVisualizationSceneStore.setState({
    ownerAccountId: ACCOUNT,
    scenes: {},
    suggestions: {},
    selectedSuggestionIndex: {},
    upgradeAttempts: {},
    tombstonedAnchorIds: [],
  });
};

/** Drains the non-blocking upgrade promise, if the outcome carried one. */
const awaitUpgrade = async (
  outcome: EnsureBatchOutcome,
): Promise<GenerateResult | null> => {
  if (outcome.kind === 'generated') return outcome.result;
  return outcome.upgrade ? await outcome.upgrade : null;
};

/** The exact canned string a pre-AI "Protect my focus" anchor would hold. */
const CANNED_SCENE =
  'I recognize the boundary I need, state it clearly, and stay steady when the moment asks me to bend it.';

const buildScene = (
  overrides: Partial<VisualizationScene> = {},
): VisualizationScene => ({
  accountId: ACCOUNT,
  anchorId: anchor.id,
  anchorLocalId: null,
  currentText: CANNED_SCENE,
  originalSuggestion: CANNED_SCENE,
  generationSource: 'deterministic_fallback',
  generationVersion: 'scene-v1',
  clientUpdatedAt: new Date().toISOString(),
  syncState: 'synced',
  ...overrides,
});

describe('mobile visualization scenes', () => {
  it('normalizes whitespace and validates the 180 character/two sentence contract', () => {
    expect(normalizeVisualizationSceneText('  I   pause.  ')).toBe('I pause.');
    expect(validateVisualizationSceneText('I pause. I choose calmly.')).toBeNull();
    expect(validateVisualizationSceneText('x'.repeat(181))).toMatch(/180/);
    expect(validateVisualizationSceneText('One. Two. Three.')).toMatch(/one or two/i);
  });

  it('provides three valid deterministic offline suggestions for every category', () => {
    for (const category of ['desire', 'health', 'career', 'relationships', 'creativity', 'spirituality', 'abundance', 'family', 'learning', 'adventure', 'custom'] as const) {
      const suggestions = buildFallbackSceneSuggestions({ category });
      expect(suggestions).toHaveLength(3);
      expect(suggestions.every((suggestion) => validateVisualizationSceneText(suggestion) == null)).toBe(true);
    }
  });

  // Phase 0 diagnostics — the two fallback reasons only the client can observe.
  describe('classifyClientRequestFailure', () => {
    it('distinguishes a server-disabled feature from a request failure', () => {
      expect(
        classifyClientRequestFailure(
          new ApiClientError('Visualize is not available', 'FEATURE_DISABLED', 403),
        ),
      ).toBe('feature_disabled');
    });

    it('classifies an offline network error as client_request_failed', () => {
      expect(classifyClientRequestFailure(new Error('Network error.'))).toBe(
        'client_request_failed',
      );
    });

    it('does not mistake an entitlement failure for a disabled feature', () => {
      expect(
        classifyClientRequestFailure(
          new ApiClientError('Requires Pro', 'PREMIUM_PRACTICE_LOCKED', 403),
        ),
      ).toBe('client_request_failed');
    });

    it('handles a non-Error throw', () => {
      expect(classifyClientRequestFailure(undefined)).toBe('client_request_failed');
    });
  });

  // ==========================================================================
  // Cache-first generation and local rotation
  // ==========================================================================
  describe('batch caching and rotation', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      resetStore();
      mockedApi.put.mockResolvedValue({ data: { data: null } });
      mockedApi.post.mockResolvedValue({
        data: {
          data: {
            suggestions: AI_BATCH,
            source: 'gemini',
            version: 'scene-v1',
            fallbackReason: null,
            model: 'gemini-2.0-flash',
            latencyMs: 700,
            rawCandidateCount: 3,
            validCandidateCount: 3,
          },
        },
      });
    });

    it('persists every returned suggestion on first generation', async () => {
      await VisualizationSceneService.generate(anchor, ACCOUNT);

      expect(useVisualizationSceneStore.getState().suggestions[anchor.id]).toEqual(AI_BATCH);
      expect(useVisualizationSceneStore.getState().selectedSuggestionIndex[anchor.id]).toBe(0);
    });

    it('does not request generation when a batch is already cached', async () => {
      await VisualizationSceneService.generate(anchor, ACCOUNT);
      mockedApi.post.mockClear();

      const result = await VisualizationSceneService.ensureBatch(anchor, ACCOUNT);

      expect(result.kind).toBe('cached');
      expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it('coalesces concurrent generate calls into one request', async () => {
      await Promise.all([
        VisualizationSceneService.generate(anchor, ACCOUNT),
        VisualizationSceneService.generate(anchor, ACCOUNT),
        VisualizationSceneService.generate(anchor, ACCOUNT),
      ]);

      const suggestionCalls = mockedApi.post.mock.calls.filter(([url]) =>
        String(url).includes('/suggestions'),
      );
      expect(suggestionCalls).toHaveLength(1);
    });

    it('persists the fallback batch so rotation still works offline', async () => {
      mockedApi.post.mockRejectedValue(new Error('Network error.'));

      const result = await VisualizationSceneService.generate(anchor, ACCOUNT);

      expect(result.fallbackUsed).toBe(true);
      expect(result.diagnostics.fallbackReason).toBe('client_request_failed');
      const cached = useVisualizationSceneStore.getState().suggestions[anchor.id];
      expect(cached).toEqual(buildFallbackSceneSuggestions(anchor));
      expect(cached).toHaveLength(3);
    });

    it('rotates locally without any network call', async () => {
      await VisualizationSceneService.generate(anchor, ACCOUNT);
      mockedApi.post.mockClear();
      mockedApi.get.mockClear();

      const rotated = VisualizationSceneService.rotate(anchor);

      expect(rotated.text).toBe(AI_BATCH[1]);
      expect(rotated.index).toBe(1);
      expect(rotated.count).toBe(3);
      expect(mockedApi.post).not.toHaveBeenCalled();
      expect(mockedApi.get).not.toHaveBeenCalled();
    });

    it('wraps from the last suggestion back to the first without regenerating', async () => {
      await VisualizationSceneService.generate(anchor, ACCOUNT);
      mockedApi.post.mockClear();

      VisualizationSceneService.rotate(anchor);
      VisualizationSceneService.rotate(anchor);
      const wrapped = VisualizationSceneService.rotate(anchor);

      expect(wrapped.text).toBe(AI_BATCH[0]);
      expect(wrapped.index).toBe(0);
      expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it('exposes the selected suggestion for restore, not the first', async () => {
      await VisualizationSceneService.generate(anchor, ACCOUNT);
      VisualizationSceneService.rotate(anchor);
      VisualizationSceneService.rotate(anchor);

      const index = VisualizationSceneService.getSelectedIndex(anchor);
      expect(VisualizationSceneService.getSuggestions(anchor)[index]).toBe(AI_BATCH[2]);
    });

    it('seeds a batch from a synced scene without calling the provider', async () => {
      const result = await VisualizationSceneService.ensureBatch(
        anchor,
        ACCOUNT,
        buildScene({ currentText: 'A scene restored from the server.' }),
      );

      expect(result.kind).toBe('cached');
      expect(mockedApi.post).not.toHaveBeenCalled();
      const cached = useVisualizationSceneStore.getState().suggestions[anchor.id];
      expect(cached[0]).toBe('A scene restored from the server.');
      expect(cached).toHaveLength(3);
    });

    it('returns no rotation target for an anchor with no batch', () => {
      expect(VisualizationSceneService.rotate(anchor).text).toBeNull();
    });
  });

  // ==========================================================================
  // One-time upgrade for anchors created before AI generation worked
  // ==========================================================================
  describe('legacy scene upgrade', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      resetStore();
      mockedApi.put.mockResolvedValue({ data: { data: null } });
      mockedApi.post.mockResolvedValue({
        data: {
          data: {
            suggestions: AI_BATCH,
            source: 'gemini',
            version: 'scene-v1',
            fallbackReason: null,
            model: 'gemini-2.0-flash',
            latencyMs: 700,
            rawCandidateCount: 3,
            validCandidateCount: 3,
          },
        },
      });
    });

    it('recognises canned text from both the mobile and backend tables', () => {
      expect(isDeterministicSceneText(CANNED_SCENE)).toBe(true);
      // Backend-only wording, which drifted from the mobile copy.
      expect(
        isDeterministicSceneText(
          'I give the people in front of me my full attention and respond with patience and warmth.',
        ),
      ).toBe(true);
      expect(
        isDeterministicSceneText(
          'I move through a specific challenge with this intention already guiding my posture, words, and next action.',
        ),
      ).toBe(true);
      expect(isDeterministicSceneText('Something the user wrote themselves.')).toBe(false);
    });

    it('ignores surrounding whitespace when matching canned text', () => {
      expect(isDeterministicSceneText(`  ${CANNED_SCENE}  `)).toBe(true);
    });

    it('upgrades a legacy canned scene to a real batch', async () => {
      const result = await VisualizationSceneService.ensureBatch(
        anchor,
        ACCOUNT,
        buildScene(),
      );

      // The screen renders the cached seed immediately; the upgrade runs behind it.
      expect(result.kind).toBe('cached');
      const upgraded = await awaitUpgrade(result);
      expect(mockedApi.post).toHaveBeenCalled();
      expect(upgraded?.fallbackUsed).toBe(false);
      expect(useVisualizationSceneStore.getState().suggestions[anchor.id]).toEqual(AI_BATCH);
      expect(useVisualizationSceneStore.getState().batchSource[anchor.id]).toBe('gemini');
      expect(upgraded?.scene.currentText).toBe(AI_BATCH[0]);
    });

    it('never replaces a user-edited scene', async () => {
      const result = await VisualizationSceneService.ensureBatch(
        anchor,
        ACCOUNT,
        buildScene({
          currentText: 'My own words about my own focus block.',
          generationSource: 'user_edited',
        }),
      );

      expect(result.kind).toBe('cached');
      expect(mockedApi.post).not.toHaveBeenCalled();
      expect(useVisualizationSceneStore.getState().suggestions[anchor.id][0]).toBe(
        'My own words about my own focus block.',
      );
    });

    it('never replaces a user-edited scene even if its text happens to be canned', async () => {
      await VisualizationSceneService.ensureBatch(
        anchor,
        ACCOUNT,
        buildScene({ generationSource: 'user_edited' }),
      );

      expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it('does not upgrade a scene the provider already generated', async () => {
      const result = await VisualizationSceneService.ensureBatch(
        anchor,
        ACCOUNT,
        buildScene({
          currentText: AI_BATCH[0],
          generationSource: 'gemini',
        }),
      );

      expect(result.kind).toBe('cached');
      expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it('keeps and persists the canned batch when the upgrade fails', async () => {
      mockedApi.post.mockRejectedValue(new Error('Network error.'));

      const result = await VisualizationSceneService.ensureBatch(
        anchor,
        ACCOUNT,
        buildScene(),
      );

      expect((await awaitUpgrade(result))?.fallbackUsed).toBe(true);
      const cached = useVisualizationSceneStore.getState().suggestions[anchor.id];
      expect(cached).toHaveLength(3);
      expect(cached[0]).toBe(CANNED_SCENE);
    });

    it('does not retry after the provider ran and still fell back', async () => {
      mockedApi.post.mockResolvedValue({
        data: {
          data: {
            suggestions: [CANNED_SCENE, 'Second canned.', 'Third canned.'],
            source: 'deterministic_fallback',
            version: 'scene-v1',
            fallbackReason: 'insufficient_valid_scenes',
            model: 'gemini-2.0-flash',
            latencyMs: 900,
            rawCandidateCount: 3,
            validCandidateCount: 1,
          },
        },
      });

      await awaitUpgrade(
        await VisualizationSceneService.ensureBatch(anchor, ACCOUNT, buildScene()),
      );
      const attempt = useVisualizationSceneStore.getState().upgradeAttempts[anchor.id];

      expect(attempt.retryable).toBe(false);
      expect(attempt.reason).toBe('insufficient_valid_scenes');
      expect(attempt.generationVersion).toBe(SCENE_GENERATION_VERSION);
      // Terminal under this generation version, however long we wait.
      expect(
        VisualizationSceneService.shouldAttemptSceneUpgrade(
          anchor,
          buildScene(),
          Date.now() + SCENE_UPGRADE_RETRY_COOLDOWN_MS * 100,
        ),
      ).toBe(false);
    });

    it('makes a terminal failure eligible again when the generation version changes', async () => {
      useVisualizationSceneStore.getState().setSuggestions(
        anchor.id,
        [CANNED_SCENE, 'Second canned.', 'Third canned.'],
        'deterministic_fallback',
      );
      useVisualizationSceneStore.getState().recordUpgradeAttempt(anchor.id, {
        retryable: false,
        reason: 'insufficient_valid_scenes',
        generationVersion: 'scene-v0-old',
      });

      // No migration and no history reset — the version comparison alone frees it.
      expect(
        VisualizationSceneService.shouldAttemptSceneUpgrade(anchor, buildScene()),
      ).toBe(true);
    });

    it('classifies transient provider failures as retryable', () => {
      for (const reason of [
        'client_request_failed',
        'feature_disabled',
        'provider_timeout',
        'provider_rate_limited',
        'provider_unavailable',
      ] as const) {
        expect(isRetryableUpgradeReason(reason)).toBe(true);
      }
      for (const reason of [
        'insufficient_valid_scenes',
        'provider_safety_blocked',
        'malformed_response',
        'provider_auth_error',
        'provider_request_error',
        'provider_unknown_error',
        'provider_error',
      ] as const) {
        expect(isRetryableUpgradeReason(reason)).toBe(false);
      }
    });

    it('retries a network failure only after the cooldown elapses', async () => {
      mockedApi.post.mockRejectedValue(new Error('Network error.'));
      await awaitUpgrade(
        await VisualizationSceneService.ensureBatch(anchor, ACCOUNT, buildScene()),
      );

      const attempt = useVisualizationSceneStore.getState().upgradeAttempts[anchor.id];
      expect(attempt.retryable).toBe(true);

      const attemptedAt = new Date(attempt.attemptedAt).getTime();
      expect(
        VisualizationSceneService.shouldAttemptSceneUpgrade(
          anchor,
          buildScene(),
          attemptedAt + SCENE_UPGRADE_RETRY_COOLDOWN_MS - 1000,
        ),
      ).toBe(false);
      expect(
        VisualizationSceneService.shouldAttemptSceneUpgrade(
          anchor,
          buildScene(),
          attemptedAt + SCENE_UPGRADE_RETRY_COOLDOWN_MS,
        ),
      ).toBe(true);
    });

    it('retries a server-disabled feature after the cooldown', async () => {
      mockedApi.post.mockRejectedValue(
        new ApiClientError('Visualize is not available', 'FEATURE_DISABLED', 403),
      );
      await awaitUpgrade(
        await VisualizationSceneService.ensureBatch(anchor, ACCOUNT, buildScene()),
      );

      expect(
        useVisualizationSceneStore.getState().upgradeAttempts[anchor.id].retryable,
      ).toBe(true);
    });

    it('does not attempt an upgrade when a real batch is already cached', async () => {
      useVisualizationSceneStore
        .getState()
        .setSuggestions(anchor.id, AI_BATCH, 'gemini');

      const result = await VisualizationSceneService.ensureBatch(
        anchor,
        ACCOUNT,
        buildScene(),
      );

      expect(result.kind).toBe('cached');
      expect((result as { upgrade?: unknown }).upgrade).toBeUndefined();
      expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it('renders the cached deterministic batch without waiting for the retry', async () => {
      let release: (value: unknown) => void = () => {};
      mockedApi.post.mockReturnValue(
        new Promise(resolve => {
          release = resolve;
        }),
      );
      useVisualizationSceneStore
        .getState()
        .setSuggestions(
          anchor.id,
          [CANNED_SCENE, 'Second canned.', 'Third canned.'],
          'deterministic_fallback',
        );

      // Resolves immediately even though the provider call is still open.
      const result = await VisualizationSceneService.ensureBatch(
        anchor,
        ACCOUNT,
        buildScene(),
      );
      expect(result.kind).toBe('cached');
      expect(VisualizationSceneService.getSuggestions(anchor)[0]).toBe(CANNED_SCENE);

      release({ data: { data: null } });
      await awaitUpgrade(result);
    });

    it('makes no request on a second mount inside the cooldown', async () => {
      mockedApi.post.mockRejectedValue(new Error('Network error.'));
      await awaitUpgrade(
        await VisualizationSceneService.ensureBatch(anchor, ACCOUNT, buildScene()),
      );

      mockedApi.post.mockClear();
      const second = await VisualizationSceneService.ensureBatch(
        anchor,
        ACCOUNT,
        buildScene(),
      );

      expect((second as { upgrade?: unknown }).upgrade).toBeUndefined();
      expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it('coalesces concurrent mounts after the cooldown into one request', async () => {
      useVisualizationSceneStore
        .getState()
        .setSuggestions(
          anchor.id,
          [CANNED_SCENE, 'Second canned.', 'Third canned.'],
          'deterministic_fallback',
        );

      const [a, b, c] = await Promise.all([
        VisualizationSceneService.ensureBatch(anchor, ACCOUNT, buildScene()),
        VisualizationSceneService.ensureBatch(anchor, ACCOUNT, buildScene()),
        VisualizationSceneService.ensureBatch(anchor, ACCOUNT, buildScene()),
      ]);
      await Promise.all([awaitUpgrade(a), awaitUpgrade(b), awaitUpgrade(c)]);

      const suggestionCalls = mockedApi.post.mock.calls.filter(([url]) =>
        String(url).includes('/suggestions'),
      );
      expect(suggestionCalls).toHaveLength(1);
    });
  });

  describe('visualizationLatencyBucket', () => {
    it.each([
      [0, '<1s'],
      [999, '<1s'],
      [1000, '1-3s'],
      [2999, '1-3s'],
      [3000, '3-8s'],
      [7999, '3-8s'],
      [8000, '>8s'],
    ])('buckets %ims as %s', (latency, expected) => {
      expect(visualizationLatencyBucket(latency)).toBe(expected);
    });
  });
});
