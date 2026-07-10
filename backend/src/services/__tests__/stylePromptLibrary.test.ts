import { AI_STYLE_IDS } from '../../types';
import {
  VALID_AI_STYLES,
  buildStylePrompt,
  deriveIntentionSignal,
  getStyleNegativePrompt,
  getStylePromptDefinition,
} from '../stylePromptLibrary';

describe('stylePromptLibrary', () => {
  it('uses the canonical backend style ID tuple', () => {
    expect(VALID_AI_STYLES).toBe(AI_STYLE_IDS);
  });

  it('falls back for inherited object property names', () => {
    expect(getStylePromptDefinition('__proto__').id).toBe('watercolor');
    expect(getStylePromptDefinition('toString').id).toBe('watercolor');
    expect(getStyleNegativePrompt('__proto__')).not.toContain('[object Object]');
  });

  it('matches intention keywords as words instead of substrings', () => {
    expect(deriveIntentionSignal('I will start a new routine').theme).toBe('General intention');
    expect(deriveIntentionSignal('I will create a new routine').theme).toBe(
      'Creativity / expression'
    );
  });

  it('normalizes invalid variation indexes', () => {
    const prompt = buildStylePrompt('steady focus', 'watercolor', Number.NaN);

    expect(prompt).not.toContain('undefined');
    expect(prompt).toContain('Watercolor');
  });
});
