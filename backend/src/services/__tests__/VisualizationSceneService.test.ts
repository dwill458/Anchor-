const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: (...args: unknown[]) => mockGenerateContent(...args) },
  })),
}));

// The service reads the normalized `env.GOOGLE_API_KEY`, which is resolved once at
// import. A live getter keeps per-test control without re-importing the module.
const mockEnv: { ENABLE_VISUALIZE: boolean; GOOGLE_API_KEY?: string } = {
  ENABLE_VISUALIZE: true,
  GOOGLE_API_KEY: 'test-key',
};
jest.mock('../../config/env', () => ({
  get env() {
    return mockEnv;
  },
}));

import {
  buildDeterministicSceneSuggestions,
  classifyProviderError,
  generateVisualizationSceneSuggestions,
  getVisualizationSceneConfigStatus,
  parseProviderSuggestions,
  validateVisualizationScene,
} from '../VisualizationSceneService';

/** Three scenes that all pass validateVisualizationScene. */
const VALID_THREE = [
  'I pause before answering and choose the words that match what I mean.',
  'I begin the next step, stay with it when it drags, and finish what I started.',
  'I notice the pull to drift, set it aside, and return to the work in front of me.',
];

const providerJson = (scenes: string[]) => ({ text: JSON.stringify({ suggestions: scenes }) });

describe('VisualizationSceneService', () => {
  const originalModel = process.env.GOOGLE_SCENE_MODEL;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.GOOGLE_API_KEY = 'test-key';
    mockEnv.ENABLE_VISUALIZE = true;
  });

  afterEach(() => {
    if (originalModel === undefined) delete process.env.GOOGLE_SCENE_MODEL;
    else process.env.GOOGLE_SCENE_MODEL = originalModel;
  });

  it('accepts one or two concise behavioral sentences', () => {
    expect(validateVisualizationScene('I notice the moment, choose calmly, and follow through.')).toBe(true);
    expect(validateVisualizationScene('I pause. I respond with steady attention.')).toBe(true);
  });

  it('rejects excessive text, invented dates, workplaces, relationships, and names', () => {
    expect(validateVisualizationScene('x'.repeat(181))).toBe(false);
    expect(validateVisualizationScene('On Monday I meet the moment calmly.')).toBe(false);
    expect(validateVisualizationScene('I speak to my boss at the office.')).toBe(false);
    expect(validateVisualizationScene('I meet Sarah and respond calmly.')).toBe(false);
  });

  it('returns three deterministic category suggestions without an API key', async () => {
    mockEnv.GOOGLE_API_KEY = undefined;
    const result = await generateVisualizationSceneSuggestions({
      intention: 'I complete my creative work.',
      category: 'creativity',
    });
    expect(result.source).toBe('deterministic_fallback');
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions.every(validateVisualizationScene)).toBe(true);
  });

  it('has a valid fallback for every supported category', () => {
    for (const category of ['desire', 'health', 'career', 'relationships', 'creativity', 'spirituality', 'abundance', 'family', 'learning', 'adventure', 'custom']) {
      const suggestions = buildDeterministicSceneSuggestions({ intention: 'test', category });
      expect(suggestions).toHaveLength(3);
      expect(suggestions.every(validateVisualizationScene)).toBe(true);
    }
  });

  it('keeps intention proof specific when the intention is about trusting decisions', () => {
    const suggestions = buildDeterministicSceneSuggestions({
      intention: 'I trust my decisions and stop second-guessing myself.',
      category: 'relationships',
    });
    expect(suggestions[0]).toContain('choice');
    expect(suggestions[0]).toContain('move forward');
    expect(suggestions[0]).not.toContain('meaningful conversation');
  });

  // ==========================================================================
  // Phase 0 diagnostics — fallbackReason classification
  // ==========================================================================
  describe('fallbackReason diagnosis', () => {
    const generate = () =>
      generateVisualizationSceneSuggestions({
        intention: 'Protect my 2 hours of deep focus',
        category: 'career',
      });

    it('reports provider_not_configured and never calls the provider without a key', async () => {
      mockEnv.GOOGLE_API_KEY = undefined;
      const result = await generate();

      expect(result.source).toBe('deterministic_fallback');
      expect(result.fallbackReason).toBe('provider_not_configured');
      expect(result.model).toBeNull();
      expect(result.rawCandidateCount).toBe(0);
      expect(result.validCandidateCount).toBe(0);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('reports provider_timeout when the request aborts', async () => {
      const abort = new Error('The operation was aborted');
      abort.name = 'AbortError';
      mockGenerateContent.mockRejectedValue(abort);

      const result = await generate();
      expect(result.source).toBe('deterministic_fallback');
      expect(result.fallbackReason).toBe('provider_timeout');
      expect(result.suggestions).toHaveLength(3);
    });

    it('reports malformed_response for non-JSON output', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'Here are three scenes for you!' });

      const result = await generate();
      expect(result.fallbackReason).toBe('malformed_response');
      expect(result.rawCandidateCount).toBe(0);
    });

    it('reports malformed_response for JSON of an unrecognised shape', async () => {
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ scenes: ['a', 'b'] }) });

      const result = await generate();
      expect(result.fallbackReason).toBe('malformed_response');
    });

    it('returns gemini output when all three scenes validate', async () => {
      mockGenerateContent.mockResolvedValue(providerJson(VALID_THREE));

      const result = await generate();
      expect(result.source).toBe('gemini');
      expect(result.fallbackReason).toBeNull();
      expect(result.suggestions).toEqual(VALID_THREE);
      expect(result.rawCandidateCount).toBe(3);
      expect(result.validCandidateCount).toBe(3);
      expect(result.model).toBe('gemini-flash-latest');
    });

    it('falls back with insufficient_valid_scenes when two of three validate', async () => {
      mockGenerateContent.mockResolvedValue(
        providerJson([VALID_THREE[0], VALID_THREE[1], 'x'.repeat(200)])
      );

      const result = await generate();
      // This is the current production gate: 2/3 valid still discards the batch.
      expect(result.source).toBe('deterministic_fallback');
      expect(result.fallbackReason).toBe('insufficient_valid_scenes');
      expect(result.rawCandidateCount).toBe(3);
      expect(result.validCandidateCount).toBe(2);
    });

    it('falls back with insufficient_valid_scenes when fewer than two validate', async () => {
      mockGenerateContent.mockResolvedValue(
        providerJson(['On Monday I speak to my boss at the office.', VALID_THREE[0]])
      );

      const result = await generate();
      expect(result.fallbackReason).toBe('insufficient_valid_scenes');
      expect(result.rawCandidateCount).toBe(2);
      expect(result.validCandidateCount).toBe(1);
    });

    it('reports provider_unavailable for a transient infrastructure failure', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Internal server error'));

      const result = await generate();
      expect(result.fallbackReason).toBe('provider_unavailable');
      expect(result.suggestions).toHaveLength(3);
    });

    it('reports provider_auth_error for a bad credential', async () => {
      mockGenerateContent.mockRejectedValue(
        Object.assign(new Error('API key not valid'), { status: 401 })
      );

      expect((await generate()).fallbackReason).toBe('provider_auth_error');
    });

    it('reports provider_rate_limited on a 429', async () => {
      mockGenerateContent.mockRejectedValue(
        Object.assign(new Error('Too Many Requests'), { status: 429 })
      );

      expect((await generate()).fallbackReason).toBe('provider_rate_limited');
    });

    it('reports provider_safety_blocked when the prompt is blocked', async () => {
      mockGenerateContent.mockResolvedValue({
        text: '',
        promptFeedback: { blockReason: 'SAFETY' },
      });

      expect((await generate()).fallbackReason).toBe('provider_safety_blocked');
    });

    it('reports provider_safety_blocked when the candidate is blocked', async () => {
      mockGenerateContent.mockResolvedValue({
        text: '',
        candidates: [{ finishReason: 'PROHIBITED_CONTENT' }],
      });

      expect((await generate()).fallbackReason).toBe('provider_safety_blocked');
    });

    it('reports malformed_response when output is truncated by the token cap', async () => {
      mockGenerateContent.mockResolvedValue({ text: '', candidates: [{ finishReason: 'MAX_TOKENS' }] });

      expect((await generate()).fallbackReason).toBe('malformed_response');
    });

    it('always returns three usable scenes regardless of failure mode', async () => {
      const failures = [
        () => mockGenerateContent.mockRejectedValue(new Error('boom')),
        () => mockGenerateContent.mockResolvedValue({ text: 'not json' }),
        () => mockGenerateContent.mockResolvedValue({ text: '' }),
      ];
      for (const setup of failures) {
        setup();
        const result = await generate();
        expect(result.suggestions).toHaveLength(3);
        expect(result.suggestions.every(validateVisualizationScene)).toBe(true);
        expect(result.fallbackReason).not.toBeNull();
      }
    });

    it('records latency on every path', async () => {
      mockGenerateContent.mockResolvedValue(providerJson(VALID_THREE));
      expect((await generate()).latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('classifyProviderError', () => {
    it.each([
      [Object.assign(new Error('x'), { name: 'AbortError' }), 'provider_timeout'],
      [new Error('deadline exceeded'), 'provider_timeout'],
      [new Error('RESOURCE_EXHAUSTED: quota'), 'provider_rate_limited'],
      [new Error('blocked by safety settings'), 'provider_safety_blocked'],
      [new Error('RECITATION'), 'provider_safety_blocked'],
      [Object.assign(new Error('nope'), { status: 401 }), 'provider_auth_error'],
      [new Error('API key not valid'), 'provider_auth_error'],
      [new Error('PERMISSION_DENIED'), 'provider_auth_error'],
      [Object.assign(new Error('boom'), { status: 503 }), 'provider_unavailable'],
      [new Error('The model is overloaded'), 'provider_unavailable'],
      [new Error('ECONNRESET'), 'provider_unavailable'],
      [Object.assign(new Error('bad'), { status: 400 }), 'provider_request_error'],
      [new Error('INVALID_ARGUMENT: contents'), 'provider_request_error'],
      [new Error('something else'), 'provider_unknown_error'],
      [undefined, 'provider_unknown_error'],
    ])('classifies %p', (error, expected) => {
      expect(classifyProviderError(error)).toBe(expected);
    });
  });

  describe('parseProviderSuggestions', () => {
    it('separates raw candidates from valid candidates', () => {
      const parsed = parseProviderSuggestions(
        JSON.stringify({ suggestions: [VALID_THREE[0], 'x'.repeat(200)] })
      );
      expect(parsed.malformed).toBe(false);
      expect(parsed.raw).toHaveLength(2);
      expect(parsed.valid).toHaveLength(1);
    });

    it('dedupes identical candidates before counting', () => {
      const parsed = parseProviderSuggestions(
        JSON.stringify({ suggestions: [VALID_THREE[0], VALID_THREE[0]] })
      );
      expect(parsed.raw).toHaveLength(1);
    });

    it('flags malformed payloads', () => {
      expect(parseProviderSuggestions('nope').malformed).toBe(true);
      expect(parseProviderSuggestions('{"other":1}').malformed).toBe(true);
    });

    it('accepts a bare array', () => {
      expect(parseProviderSuggestions(JSON.stringify(VALID_THREE)).valid).toHaveLength(3);
    });
  });

  describe('getVisualizationSceneConfigStatus', () => {
    it('reports presence without exposing the key', () => {
      mockEnv.GOOGLE_API_KEY = 'super-secret-value';
      const status = getVisualizationSceneConfigStatus();

      expect(status.providerKeyConfigured).toBe(true);
      expect(JSON.stringify(status)).not.toContain('super-secret-value');
      expect(typeof status.featureEnabled).toBe('boolean');
      expect(status.model).toBe('gemini-flash-latest');
      expect(status.modelExplicitlyConfigured).toBe(false);
    });

    it('reports a missing key', () => {
      mockEnv.GOOGLE_API_KEY = undefined;
      expect(getVisualizationSceneConfigStatus().providerKeyConfigured).toBe(false);
    });
  });
});
