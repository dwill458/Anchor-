import {
  buildFallbackSceneSuggestions,
  normalizeVisualizationSceneText,
  validateVisualizationSceneText,
} from '../VisualizationSceneService';

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
});
