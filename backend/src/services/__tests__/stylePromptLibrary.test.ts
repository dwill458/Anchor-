import { AI_STYLE_IDS } from '../../types';
import {
  VALID_AI_STYLES,
  buildStylePrompt,
  deriveIntentionSignal,
  getStyleNegativePrompt,
  getStylePromptDefinition,
  STYLE_PROMPT_LIBRARY,
} from '../stylePromptLibrary';

describe('stylePromptLibrary', () => {
  it('uses the canonical backend style ID tuple', () => {
    expect(VALID_AI_STYLES).toBe(AI_STYLE_IDS);
    expect(VALID_AI_STYLES.length).toBe(28);
  });

  it('falls back for inherited object property names', () => {
    expect(getStylePromptDefinition('__proto__').id).toBe('watercolor');
    expect(getStylePromptDefinition('toString').id).toBe('watercolor');
    expect(getStyleNegativePrompt('__proto__')).not.toContain('[object Object]');
  });

  it('matches intention keywords as words instead of substrings', () => {
    // 'start' should not match 'art'
    expect(deriveIntentionSignal('I will start today').theme).toBe('General intention');
    expect(deriveIntentionSignal('I will create art today').theme).toBe('Creativity / expression');
  });

  it('correctly maps all 7 intention vectors', () => {
    expect(deriveIntentionSignal('deep work and focus').theme).toBe('Focus / discipline');
    expect(deriveIntentionSignal('unshakable courage and strength').theme).toBe(
      'Confidence / courage'
    );
    expect(deriveIntentionSignal('expanding financial wealth and growth').theme).toBe(
      'Abundance / growth'
    );
    expect(deriveIntentionSignal('rest, recovery, and quiet reset').theme).toBe('Recovery / reset');
    expect(deriveIntentionSignal('deep love, connection, and trust').theme).toBe(
      'Love / relationship'
    );
    expect(deriveIntentionSignal('firm boundaries and protection').theme).toBe(
      'Protection / stability'
    );
    expect(deriveIntentionSignal('artistic inspiration and innovation').theme).toBe(
      'Creativity / expression'
    );
  });

  it('enforces the gold accent constraint and structural preservation in built prompts', () => {
    const prompt = buildStylePrompt('steady focus', 'architectural_trace', 0);

    expect(prompt).toContain('SIGIL GEOMETRY IDENTITY:');
    expect(prompt).toContain('STRUCTURAL PRESERVATION — ABSOLUTE PRIORITY:');
    expect(prompt).toContain('LITERAL SUBJECT EXCLUSION — ABSOLUTE:');
    expect(prompt).toContain(
      'Never draw, add, clarify, embellish, or suggest a real-world nautical'
    );
    expect(prompt).toContain('GOLD ACCENT CONSTRAINT:');
    expect(prompt).toContain('~15%');
    expect(prompt).toContain('CENTRED AXIS');
    expect(prompt).not.toContain('STILLPOINT');
    expect(prompt).not.toContain('grimoire');
    expect(prompt).not.toContain('occult');
  });

  it('excludes literal physical anchors from every generated art prompt', () => {
    for (const styleId of VALID_AI_STYLES) {
      const prompt = buildStylePrompt('steady focus', styleId, 0).toLowerCase();
      const negativePrompt = getStyleNegativePrompt(styleId).toLowerCase();

      expect(prompt).toContain('abstract symbolic sigil artwork only');
      expect(prompt).toContain('never turn it into a literal anchor');
      expect(negativePrompt).toContain('literal nautical anchor');
      expect(negativePrompt).toContain('recognizable anchor silhouette');
    }
  });

  it('restores a restrained mystical atmosphere without opening literal-object rules', () => {
    const prompt = buildStylePrompt('steady focus', 'watercolor', 0);

    expect(prompt).toContain('MYSTICAL ATMOSPHERE — RESTRAINED:');
    expect(prompt).toContain('ethereal glow');
    expect(prompt).toContain('Faint non-readable abstract marks');
    expect(prompt).toContain('do not create a tarot card, spellbook, ritual altar');
    expect(prompt).toContain('literal objects');
  });

  it('normalizes invalid variation indexes', () => {
    const prompt = buildStylePrompt('steady focus', 'watercolor', Number.NaN);

    expect(prompt).not.toContain('undefined');
    expect(prompt).toContain('Watercolor');
  });

  it('contains no deprecated STILLPOINT composition family in any style definition', () => {
    for (const styleId of VALID_AI_STYLES) {
      const def = STYLE_PROMPT_LIBRARY[styleId];
      expect(def.compositionFamily).not.toBe('CENTRED STILLPOINT');
    }
  });

  it('keeps each product finish attached to its own prompt identity', () => {
    const productStyles = [
      ['solar_veil', 'Solar Veil'],
      ['ink_bloom', 'Ink Bloom'],
      ['prism_fold', 'Prism Fold'],
      ['ocean_current', 'Ocean Current'],
      ['halo_drift', 'Halo Drift'],
      ['harvest_gild', 'Harvest Gild'],
      ['midnight_bloom', 'Midnight Bloom'],
      ['winter_halo', 'Winter Halo'],
    ] as const;

    for (const [styleId, displayName] of productStyles) {
      const prompt = buildStylePrompt('steady focus', styleId);
      expect(getStylePromptDefinition(styleId).displayName).toBe(displayName);
      expect(prompt).toContain(`STYLE IDENTITY:\n${displayName}`);
    }
  });
});
