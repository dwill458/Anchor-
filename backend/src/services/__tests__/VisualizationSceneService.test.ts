import {
  buildDeterministicSceneSuggestions,
  generateVisualizationSceneSuggestions,
  validateVisualizationScene,
} from '../VisualizationSceneService';

describe('VisualizationSceneService', () => {
  const originalKey = process.env.GOOGLE_API_KEY;

  afterEach(() => {
    process.env.GOOGLE_API_KEY = originalKey;
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
    delete process.env.GOOGLE_API_KEY;
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
});
