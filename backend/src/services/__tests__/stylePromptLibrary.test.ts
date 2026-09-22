import { AI_STYLE_IDS } from '../../types';
import {
  VALID_AI_STYLES,
  STYLE_PROMPT_LIBRARY,
  buildLegacyFallbackDNA,
  buildStylePrompt,
  deriveIntentionSignal,
  getCategoryColorInfo,
  getStyleNegativePrompt,
  getStylePromptDefinition,
  normalizeVisualLanguage,
  type AIStyle,
  type StylePromptDefinition,
} from '../stylePromptLibrary';

describe('stylePromptLibrary', () => {
  // ============================================================================
  // 1. Preservation of Canonical & Production Style IDs
  // ============================================================================

  describe('style ID preservation', () => {
    it('uses the canonical backend style ID tuple', () => {
      expect(VALID_AI_STYLES).toBe(AI_STYLE_IDS);
    });

    it('preserves every single legacy production style ID', () => {
      const requiredLegacyIds: AIStyle[] = [
        'architectural_trace',
        'lunar_etch',
        'resonance_rings',
        'watercolor',
        'ink_brush',
        'gold_leaf',
        'cosmic',
        'minimal_line',
        'obsidian_mono',
        'aurora_glow',
        'ember_trace',
        'monolith_ink',
        'celestial_grid',
        'echo_chamber',
        'prism_veil',
        'verdigris_relic',
        'solar_halo',
        'tideglass',
        'sacred_geometry',
        'velvet_ember',
        'solar_veil',
        'ink_bloom',
        'prism_fold',
        'ocean_current',
        'halo_drift',
        'harvest_gild',
        'midnight_bloom',
        'winter_halo',
        'original',
      ];

      for (const id of requiredLegacyIds) {
        expect(VALID_AI_STYLES).toContain(id);
        const def = getStylePromptDefinition(id);
        expect(def).toBeDefined();
        expect(def.id).toBe(id);
      }
    });

    it('includes all 18 new Anchor 2.0 V2 styles in the library', () => {
      const v2StyleIds: AIStyle[] = [
        'cyanotype',
        'cut_paper',
        'risograph',
        'screenprint',
        'monoprint',
        'charcoal_field',
        'graphite_study',
        'stone_relief',
        'porcelain',
        'copper_patina',
        'topographic',
        'botanical_etching',
        'mineral_bloom',
        'dreamscape',
        'soft_monument',
        'street_mark',
        'collage_archive',
        'lightfield',
      ];

      for (const id of v2StyleIds) {
        expect(VALID_AI_STYLES).toContain(id);
        const def = getStylePromptDefinition(id);
        expect(def).toBeDefined();
        expect(def.id).toBe(id);
        expect(def.visualLanguage).toBeDefined();
        expect(def.lifecycleStatus).toBe('ROTATION');
      }
    });

    it('resolves style name aliases and kebab-case variants safely', () => {
      expect(getStylePromptDefinition('aurora_flow').id).toBe('aurora_glow');
      expect(getStylePromptDefinition('resonant_rings').id).toBe('resonance_rings');
      expect(getStylePromptDefinition('architectural-trace').id).toBe('architectural_trace');
      expect(getStylePromptDefinition('gold-leaf').id).toBe('gold_leaf');
      expect(getStylePromptDefinition('cut-paper').id).toBe('cut_paper');
      expect(getStylePromptDefinition('original').id).toBe('original');
    });

    it('falls back to watercolor for inherited object property names or unknown styles', () => {
      expect(getStylePromptDefinition('__proto__').id).toBe('watercolor');
      expect(getStylePromptDefinition('toString').id).toBe('watercolor');
      expect(getStylePromptDefinition('constructor').id).toBe('watercolor');
      expect(getStylePromptDefinition('completely_unknown_style').id).toBe('watercolor');
      expect(getStyleNegativePrompt('__proto__')).not.toContain('[object Object]');
    });
  });

  // ============================================================================
  // 2. Legacy Fallback & DNA Normalization
  // ============================================================================

  describe('legacy fallback layer', () => {
    it('builds complete fallback DNA when a style has no visualLanguage', () => {
      const mockLegacyStyle: StylePromptDefinition = {
        id: 'resonance_rings',
        displayName: 'Resonance Rings',
        styleFamily: 'Resonance / Field',
        category: 'Luminous',
        collection: 'core',
        description: 'Concentric pulse circles, waveform halos, radiating energy.',
        paletteLane: 'amber-white on charcoal, optional teal-white on graphite',
        compositionFamily: 'DIRECTIONAL FLOW',
        materialBehavior: 'echo rings, pulse halos, acoustic field lines',
        styleNativeMotif: 'non-uniform pulse halos and abstract acoustic field lines',
        defaultDensity: 'moderate',
        promptStyleBlock: 'Concentric pulse circles and waveform halos moving with controlled rhythm.',
        negativePrompt: 'sonar UI, target reticle',
        accentMotifs: ['uneven harmonic rings with visible falloff'],
      };

      const fallback = buildLegacyFallbackDNA(mockLegacyStyle);

      expect(fallback.coreArtWorld).toContain('Resonance Rings artistic world');
      expect(fallback.primaryMedium).toBeTruthy();
      expect(fallback.substrate).toBeTruthy();
      expect(fallback.edgeBehavior).toBeTruthy();
      expect(fallback.lineBehavior).toContain('immutable Anchor linework');
      expect(fallback.spatialBehavior).toContain('DIRECTIONAL FLOW');
      expect(fallback.lightBehavior).toBeTruthy();
      expect(fallback.textureLogic).toBe(mockLegacyStyle.materialBehavior);
      expect(fallback.depthLogic).toBeTruthy();
      expect(fallback.ornamentSystem).toBe(mockLegacyStyle.styleNativeMotif);
      expect(fallback.framingLogic).toBeTruthy();
      expect(fallback.signatureTraits).toHaveLength(2);
      expect(fallback.shouldFeelLike).toContain('Resonance Rings');
      expect(fallback.mustNotFeelLike).toContain('Generic mystical poster');
      expect(fallback.crossStyleAvoidances).toBeDefined();
      expect(fallback.paletteBehavior).toBe(mockLegacyStyle.paletteLane);
      expect(fallback.maxSupportingMotifs).toBe(3);
    });

    it('normalizes partial visualLanguage without printing undefined or empty fields', () => {
      const mockPartialStyle: StylePromptDefinition = {
        id: 'watercolor',
        displayName: 'Watercolor',
        styleFamily: 'Organic / Painterly',
        category: 'Organic',
        collection: 'core',
        description: 'Flowing pigment washes, soft bloom.',
        paletteLane: 'mineral blue, moss, plum',
        compositionFamily: 'OFFSET FIELD',
        materialBehavior: 'pigment bleed, deckled paper',
        styleNativeMotif: 'pigment blooms',
        defaultDensity: 'moderate',
        promptStyleBlock: 'Flowing watercolor on textured paper.',
        negativePrompt: '',
        accentMotifs: ['deckled paper edge shadows'],
        visualLanguage: {
          coreArtWorld: 'Custom hand-painted watercolor world',
          // all other fields omitted
        },
      };

      const normalized = normalizeVisualLanguage(mockPartialStyle);

      expect(normalized.coreArtWorld).toBe('Custom hand-painted watercolor world');
      expect(normalized.primaryMedium).toBeTruthy();
      expect(normalized.substrate).toBeTruthy();
      expect(normalized.edgeBehavior).toBeTruthy();
      expect(normalized.lightBehavior).toBeTruthy();
      expect(normalized.textureLogic).toBeTruthy();
      expect(normalized.maxSupportingMotifs).toBe(3);

      for (const [key, value] of Object.entries(normalized)) {
        expect(value).not.toBeUndefined();
        expect(value).not.toBeNull();
        if (typeof value === 'string') {
          expect(value.trim()).not.toBe('');
        }
      }
    });

    it('allows legacy styles without visualLanguage to generate complete prompts without failing', () => {
      const legacyIds: AIStyle[] = ['resonance_rings', 'echo_chamber', 'verdigris_relic', 'solar_halo', 'tideglass'];
      for (const id of legacyIds) {
        const prompt = buildStylePrompt('steady focus and growth', id, 0);
        expect(prompt).not.toContain('undefined');
        expect(prompt).not.toContain('null');
        expect(prompt).toContain('ANCHOR IDENTITY');
        expect(prompt).toContain('STRUCTURAL PRESERVATION — ABSOLUTE PRIORITY');
        expect(prompt).toContain('STYLE DNA');
      }
    });
  });

  // ============================================================================
  // 3. V2 Master Prompt Template Assembly & Immutability
  // ============================================================================

  describe('master prompt assembly', () => {
    it('contains all 16 canonical sections from the Anchor 2.0 master contract', () => {
      const prompt = buildStylePrompt('create a serene sanctuary', 'cyanotype', 0);

      const requiredSections = [
        'ANCHOR IDENTITY',
        'STRUCTURAL PRESERVATION — ABSOLUTE PRIORITY',
        'VISUAL LANGUAGE CONTRACT',
        'STYLE DNA',
        'STYLE-SPECIFIC ART DIRECTION',
        'CROSS-STYLE SEPARATION',
        'STYLE SIGNATURE FOR THIS RENDER',
        'CATEGORY SIGNAL — SECONDARY TO STYLE',
        'INTENTION SIGNAL LAYER — NON-LITERAL',
        'SYMBOLIC MOTIFS',
        'COMPOSITIONAL LANGUAGE',
        'COLOR + MATERIAL LOGIC',
        'UNIQUENESS MANDATE',
        'COLLECTION DIFFERENTIATION',
        'BACKWARD COMPATIBILITY RULE',
        'REFERENCE IMAGE RULE',
      ];

      for (const section of requiredSections) {
        expect(prompt).toContain(section);
      }
    });

    it('strictly enforces the immutable geometry mandate in the master prompt', () => {
      const prompt = buildStylePrompt('unwavering stability', 'minimal_line', 0);

      expect(prompt).toContain(
        'Preserve every primary line, circle, node, intersection, angle, and structural relationship exactly as shown.'
      );
      expect(prompt).toContain('Treat the Anchor as an immutable master structure.');
      expect(prompt).toContain('Do not invent new lines that appear to belong to the Anchor.');
      expect(prompt).toContain('Never alter the core geometry.');
      expect(prompt).toContain('The Anchor geometry is the identity of the piece.');
    });

    it('frames the Anchor as a personal mark of intent, not a seal, without loosening geometry', () => {
      const prompt = buildStylePrompt('steady focus and growth', 'gold_leaf', 0);

      expect(prompt).toContain('PERSONAL MARK OF INTENT');
      expect(prompt).toContain('Do not enclose it in added rings, borders, medallions, cartouches, or ceremonial frames.');
      expect(prompt).toContain('It must not become a corporate logo, an icon-set glyph, or an alphabet monogram.');
      // The identity directive sits before the preservation contract and does not replace it.
      expect(prompt.indexOf('PERSONAL MARK OF INTENT')).toBeLessThan(prompt.indexOf('STRUCTURAL PRESERVATION — ABSOLUTE PRIORITY'));
      expect(getStyleNegativePrompt('gold_leaf')).toContain('talisman');
    });

    it('renders style-specific DNA fields for upgraded and V2 styles without placeholders', () => {
      const prompt = buildStylePrompt('radiant confidence', 'cut_paper', 0);

      expect(prompt).toContain('STYLE NAME:\nCut Paper');
      expect(prompt).toContain('PRIMARY MEDIUM:\nMulti-ply heavy cardstock');
      expect(prompt).toContain('SUBSTRATE:\nRecessed shadowbox backing paper');
      expect(prompt).toContain('STYLE SHOULD FEEL LIKE:\nA handmade museum-grade paper relief');
      expect(prompt).toContain('STYLE MUST NOT FEEL LIKE:\nFlat digital vector');
      expect(prompt).not.toContain('[PRIMARY MEDIUM]');
      expect(prompt).not.toContain('[SUBSTRATE]');
      expect(prompt).not.toContain('undefined');
      expect(prompt).not.toContain('null');
    });

    it('supports all 8 required composition families in prompt composition language', () => {
      const prompt = buildStylePrompt('quiet study', 'architectural_trace', 0);

      expect(prompt).toContain('COMPOSITIONAL LANGUAGE');
      expect(prompt).toContain('CENTRED_STILLPOINT');
      expect(prompt).toContain('OFFSET_FIELD');
      expect(prompt).toContain('DIRECTIONAL_FLOW');
      expect(prompt).toContain('LOWER_ANCHORED');
      expect(prompt).toContain('DIAGONAL_TENSION');
      expect(prompt).toContain('OPEN_VOID');
      expect(prompt).toContain('FULL_FIELD');
      expect(prompt).toContain('OBJECT_PRESENTATION');
    });

    it('correctly formats recent render context when provided', () => {
      const prompt = buildStylePrompt('abundant harvest', 'gold_leaf', 0, {
        recentRenders: {
          usedStyles: ['watercolor', 'ink_brush'],
          usedStyleFamilies: ['Organic / Painterly', 'Organic / Minimal'],
          usedCompositions: ['OFFSET_FIELD', 'OPEN_VOID'],
          usedPaletteLanes: ['mineral blue', 'black ink'],
          usedDensityLevels: ['moderate', 'sparse'],
          usedMaterialTypes: ['paper wash', 'sumi ink'],
        },
      });

      expect(prompt).toContain('Recently used styles: watercolor, ink_brush');
      expect(prompt).toContain('Recently used style families: Organic / Painterly, Organic / Minimal');
      expect(prompt).toContain('Recently used compositions: OFFSET_FIELD, OPEN_VOID');
      expect(prompt).toContain('Recently used palette lanes: mineral blue, black ink');
    });

    it('renders safe default placeholders for recent renders when history is omitted', () => {
      const prompt = buildStylePrompt('deep serenity', 'obsidian_mono', 0);

      expect(prompt).toContain('[RECENTLY USED STYLES]: None recorded');
      expect(prompt).toContain('[RECENTLY USED STYLE FAMILIES]: None recorded');
      expect(prompt).toContain('[RECENTLY USED COMPOSITIONS]: None recorded');
    });
  });

  // ============================================================================
  // 4. Negative Prompt Assembly
  // ============================================================================

  describe('negative prompt assembly', () => {
    it('includes all V2 global negative prompt terms', () => {
      const negative = getStyleNegativePrompt('minimal_line');

      expect(negative).toContain('fake writing');
      expect(negative).toContain('runes');
      expect(negative).toContain('banknotes');
      expect(negative).toContain('credit cards');
      expect(negative).toContain('broken Anchor');
      expect(negative).toContain('melted Anchor');
      expect(negative).toContain('obscured Anchor');
      expect(negative).toContain('generic mystical poster');
      expect(negative).toContain('repetitive mandala');
      expect(negative).toContain('flat app icon');
    });

    it('merges style-specific extra negatives and DNA negative additions cleanly without duplicates', () => {
      const negative = getStyleNegativePrompt('ink_brush');

      expect(negative).toContain('calligraphy letters');
      expect(negative).toContain('readable brush marks');
      expect(negative).toContain('decorative script');

      // Check no double commas or trailing commas
      expect(negative).not.toContain(', ,');
      expect(negative).not.toMatch(/,\s*$/);
    });

    it('appends style.visualLanguage.negativePromptAdditions for V2 styles', () => {
      const negative = getStyleNegativePrompt('lightfield');

      expect(negative).toContain('planets');
      expect(negative).toContain('mandalas');
      expect(negative).toContain('sparkles');
      expect(negative).toContain('neon bar sign');
    });
  });

  // ============================================================================
  // 5. Category Signals & Intention Signals
  // ============================================================================

  describe('category and intention signals', () => {
    it('matches intention keywords as full words instead of substrings', () => {
      expect(deriveIntentionSignal('I will start a new routine').theme).toBe('General intention');
      expect(deriveIntentionSignal('I will create a new routine').theme).toBe(
        'Creativity / expression'
      );
    });

    it('derives intention physics including visual tension and spatial pressure', () => {
      const signal = deriveIntentionSignal('deep focus and clarity in my studies');

      expect(signal.theme).toBe('Focus / discipline');
      expect(signal.directionalBehavior).toContain('converging motion');
      expect(signal.visualTension).toBeDefined();
      expect(signal.spatialPressure).toBeDefined();
    });

    it('maps categories to Anchor 2.0 colors and behaviors', () => {
      const careerInfo = getCategoryColorInfo('career');
      expect(careerInfo.name).toBe('Career');
      expect(careerInfo.color).toContain('#3157D8');

      const healthInfo = getCategoryColorInfo('health');
      expect(healthInfo.name).toBe('Health');
      expect(healthInfo.color).toContain('#2FA879');

      const desireInfo = getCategoryColorInfo('desire');
      expect(desireInfo.name).toBe('Desire');
      expect(desireInfo.color).toContain('#D94F8A');
    });

    it('applies category options in buildStylePrompt', () => {
      const prompt = buildStylePrompt('achieve major milestones', 'architectural_trace', 0, {
        category: 'career',
      });

      expect(prompt).toContain('CATEGORY:\nCareer');
      expect(prompt).toContain('#3157D8');
    });

    it('accepts string category as backward-compatible 4th argument', () => {
      const prompt = buildStylePrompt('heartfelt love and warmth', 'watercolor', 0, 'relationships');

      expect(prompt).toContain('CATEGORY:\nRelationships');
      expect(prompt).toContain('#E56F7A');
    });
  });

  // ============================================================================
  // 6. Robustness & Edge Cases
  // ============================================================================

  describe('robustness and edge cases', () => {
    it('normalizes invalid variation indexes safely', () => {
      const prompt = buildStylePrompt('steady focus', 'watercolor', Number.NaN);

      expect(prompt).not.toContain('undefined');
      expect(prompt).toContain('Watercolor');
    });

    it('never prints literal undefined, null, or empty tags for any style in the library', () => {
      for (const styleId of VALID_AI_STYLES) {
        const prompt = buildStylePrompt('meaningful path', styleId, 1);
        expect(prompt).not.toContain('undefined');
        expect(prompt).not.toContain('null');
        expect(prompt).not.toContain('[object Object]');
        expect(prompt).not.toContain('STYLE NAME:\n\n');
        expect(prompt).not.toContain('PRIMARY MEDIUM:\n\n');
      }
    });
  });
});
