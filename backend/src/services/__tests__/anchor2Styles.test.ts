/**
 * Anchor 2.0 style generation — additive extension tests.
 *
 * Two jobs:
 *  1. Prove Anchor 1.5 (legacy) output is byte-identical to the pre-2.0 snapshot in
 *     fixtures/legacyStyleSnapshots.json (prompt, provider wrappers, negative prompt).
 *  2. Prove the 15 Anchor 2.0 styles resolve independently, use the edge-to-edge material-field
 *     contract, and never ask for transparency, isolation or a blank background anywhere.
 */

jest.mock('../../utils/logger');
jest.mock('@google/genai');
jest.mock('sharp');
jest.mock('../../utils/artworkValidation', () => ({
  validateAnchorArtwork: jest.fn(),
}));

import { createHash } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { AI_STYLE_IDS, ANCHOR2_STYLE_IDS } from '../../types';
import { validateAnchorArtwork } from '../../utils/artworkValidation';
import { GeminiImageService } from '../GeminiImageService';
import {
  ANCHOR2_FORBIDDEN_PROMPT_PATTERNS,
  ANCHOR2_NEGATIVE_ADDITIONS,
  ANCHOR2_REMOVED_GLOBAL_NEGATIVE_TERMS,
} from '../anchor2Contract';
import {
  ANCHOR2_FORWARD_STYLE_IDS,
  ANCHOR2_ROTATION_STYLE_IDS,
  ANCHOR2_STYLE_LIBRARY,
  REQUIRED_ANCHOR2_DNA_KEYS,
  getAnchor2StyleDefinition,
  getStyleGenerationVersion,
  isAnchor2StyleId,
  validateAnchor2StyleDefinition,
  type Anchor2StyleDefinition,
} from '../anchor2StyleLibrary';
import {
  buildReferenceImageWrapper,
  getReferenceImageWrapperTail,
  type ReferenceWrapperProvider,
} from '../referenceImageWrappers';
import {
  GLOBAL_NEGATIVE_PROMPT,
  STYLE_PROMPT_LIBRARY,
  VALID_AI_STYLES,
  buildAnchor2StylePrompt,
  buildStylePrompt,
  getStyleNegativePrompt,
  getStylePromptDefinition,
  selectAnchor2PaletteLane,
} from '../stylePromptLibrary';
import legacySnapshots from './fixtures/legacyStyleSnapshots.json';

const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const PROVIDERS: ReferenceWrapperProvider[] = ['nanoBanana', 'geminiAdapter', 'openAi'];

type LegacyFixture = {
  prompt: string;
  promptSha: { variation1CareerRadiant: string; variation3WealthQuiet: string };
  negative: string;
};
const fixture = legacySnapshots as unknown as {
  intention: string;
  wrapperTails: Record<ReferenceWrapperProvider, string>;
  styleIds: string[];
  styles: Record<string, LegacyFixture>;
};

const INTENTIONS = [
  'steady focus and growth',
  'abundant harvest and generosity',
  'heartfelt love and warmth',
  'courageous adventure',
  '',
];
const CATEGORIES = [undefined, 'career', 'health', 'abundance', 'relationships', 'custom'];

describe('Existing style compatibility (current category palette)', () => {
  it('still resolves every legacy style ID to its own definition', () => {
    expect(fixture.styleIds).toEqual([...VALID_AI_STYLES]);
    expect(VALID_AI_STYLES).toBe(AI_STYLE_IDS);
    for (const id of VALID_AI_STYLES) {
      expect(getStylePromptDefinition(id).id).toBe(id);
      expect(getStyleGenerationVersion(id)).toBe('legacy');
      expect(isAnchor2StyleId(id)).toBe(false);
    }
  });

  it('keeps the legacy catalog free of Anchor 2.0 IDs and fields', () => {
    for (const id of ANCHOR2_STYLE_IDS) {
      expect((VALID_AI_STYLES as readonly string[]).includes(id)).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(STYLE_PROMPT_LIBRARY, id)).toBe(false);
    }
    for (const id of VALID_AI_STYLES) {
      const def = STYLE_PROMPT_LIBRARY[id] as unknown as Record<string, unknown>;
      expect(def.generationVersion).toBeUndefined();
      expect(def.lockedCore).toBeUndefined();
      expect(def.availability).toBeUndefined();
    }
  });

  it.each(fixture.styleIds)('%s: prompt is byte-identical to the snapshot', id => {
    const expected = fixture.styles[id];
    expect(buildStylePrompt(fixture.intention, id, 0)).toBe(expected.prompt);
    expect(sha(buildStylePrompt('radiant confidence', id, 1, { category: 'career' }))).toBe(
      expected.promptSha.variation1CareerRadiant
    );
    expect(
      sha(
        buildStylePrompt('quiet study', id, 3, {
          category: 'wealth',
          recentRenders: { usedStyles: ['watercolor'] },
        })
      )
    ).toBe(expected.promptSha.variation3WealthQuiet);
  });

  it.each(fixture.styleIds)('%s: negative prompt is byte-identical to the snapshot', id => {
    expect(getStyleNegativePrompt(id)).toBe(fixture.styles[id].negative);
  });

  it.each(fixture.styleIds)('%s: every provider wrapper is byte-identical to the snapshot', id => {
    const prompt = fixture.styles[id].prompt;
    for (const provider of PROVIDERS) {
      expect(buildReferenceImageWrapper(provider, prompt, id)).toBe(
        `${prompt}\n\n${fixture.wrapperTails[provider]}`
      );
    }
  });

  it('keeps the legacy standalone / transparent artwork behavior in legacy prompts and wrappers', () => {
    for (const id of VALID_AI_STYLES) {
      const prompt = buildStylePrompt('steady focus', id, 0);
      expect(prompt).toContain('STANDALONE ANCHOR ARTWORK REQUIREMENT');
      expect(prompt).toContain('DO NOT generate a background as part of the Anchor.');
      expect(prompt).toContain('Prefer transparent-background Anchor artwork');
    }
    expect(getReferenceImageWrapperTail('nanoBanana', 'watercolor')).toContain(
      'clean/transparent background'
    );
  });

  it('does not leak the Anchor 2.0 contract into legacy prompts or negatives', () => {
    for (const id of VALID_AI_STYLES) {
      const prompt = buildStylePrompt('steady focus', id, 0, { category: 'career' });
      expect(prompt).not.toContain('ANCHOR 2.0 PRESENTATION CONTRACT');
      expect(prompt).not.toContain('ADAPTIVE ANCHOR CONTRAST');
      expect(prompt).not.toContain('LOCKED CORE');
      expect(getStyleNegativePrompt(id)).not.toContain('Anchor blending into background');
    }
  });

  it('keeps the unknown-style fallback unchanged (watercolor, legacy contract)', () => {
    for (const unknown of ['definitely_not_a_style', '', '__proto__', 'constructor']) {
      expect(getStylePromptDefinition(unknown).id).toBe('watercolor');
      expect(getStyleGenerationVersion(unknown)).toBe('legacy');
      expect(buildStylePrompt('steady focus', unknown, 0)).toBe(
        buildStylePrompt('steady focus', 'watercolor', 0)
      );
    }
    // Unchanged negative-prompt lookup: strings that merely miss the catalog get the bare global
    // negative; blank and prototype-ish keys normalize to watercolor.
    expect(getStyleNegativePrompt('definitely_not_a_style')).toBe(GLOBAL_NEGATIVE_PROMPT);
    for (const key of ['', '__proto__', 'constructor']) {
      expect(getStyleNegativePrompt(key)).toBe(getStyleNegativePrompt('watercolor'));
    }
    expect(getStyleGenerationVersion(undefined)).toBe('legacy');
    expect(getReferenceImageWrapperTail('nanoBanana', undefined)).toBe(
      fixture.wrapperTails.nanoBanana
    );
  });

  it('does not alias legacy IDs to the new styles', () => {
    expect(getStylePromptDefinition('velvet_ember').id).toBe('velvet_ember');
    expect(getStylePromptDefinition('porcelain').id).toBe('porcelain');
    expect(buildStylePrompt('steady focus', 'velvet_ember', 0)).not.toBe(
      buildStylePrompt('steady focus', 'velvet_ember_v2', 0)
    );
    expect(getStyleNegativePrompt('porcelain')).not.toBe(getStyleNegativePrompt('porcelain_v2'));
  });
});

describe('Anchor 2.0 registry', () => {
  const EXPECTED_IDS = [
    'velvet_ember_v2',
    'prism_flow_v2',
    'deep_cosmos_v2',
    'joybrush_v2',
    'porcelain_v2',
    'woven_v2',
    'paper_v2',
    'clay_v2',
    'graphic_v2',
    'plush_v2',
    'herbarium_v2',
    'alloy_v2',
    'gilt_v2',
    'flash_v2',
    'buff_v2',
  ];

  it('registers exactly the 15 Anchor 2.0 style IDs, unique and non-colliding', () => {
    expect([...ANCHOR2_STYLE_IDS]).toEqual(EXPECTED_IDS);
    expect(new Set(ANCHOR2_STYLE_IDS).size).toBe(15);
    expect(Object.keys(ANCHOR2_STYLE_LIBRARY).sort()).toEqual([...EXPECTED_IDS].sort());
    const legacy = new Set<string>(AI_STYLE_IDS);
    for (const id of ANCHOR2_STYLE_IDS) {
      expect(legacy.has(id)).toBe(false);
    }
  });

  it.each([...ANCHOR2_STYLE_IDS])('%s resolves independently as anchor2', id => {
    const def = getAnchor2StyleDefinition(id)!;
    expect(def).toBeDefined();
    expect(def.id).toBe(id);
    expect(isAnchor2StyleId(id)).toBe(true);
    expect(getStyleGenerationVersion(id)).toBe('anchor2');
    expect(getStyleGenerationVersion(id.toUpperCase().replace(/_/g, '-'))).toBe('anchor2');
    // anchor2 IDs never resolve through the legacy definition lookup
    expect(getStylePromptDefinition(id).id).toBe('watercolor');
  });

  it.each([...ANCHOR2_STYLE_IDS])('%s has every required Anchor 2.0 field', id => {
    const def = ANCHOR2_STYLE_LIBRARY[id];
    expect(def.generationVersion).toBe('anchor2');
    expect(['forward', 'rotation']).toContain(def.availability);
    expect(def.lockedCore.length).toBeGreaterThan(0);
    expect(def.allowedVariation.length).toBeGreaterThan(0);
    expect(def.prohibitedDrift.length).toBeGreaterThan(0);
    expect(def.anchorRendering.length).toBeGreaterThan(0);
    expect(def.paletteLanes.length).toBeGreaterThanOrEqual(2);
    for (const key of REQUIRED_ANCHOR2_DNA_KEYS) {
      const value = def.visualLanguage[key];
      expect(value).toBeTruthy();
      if (Array.isArray(value)) expect(value.length).toBeGreaterThan(0);
    }
    expect(validateAnchor2StyleDefinition(def)).toEqual([]);
  });

  it('enforces light-field/dark-structure and dark-field/light-structure on every lane', () => {
    for (const id of ANCHOR2_STYLE_IDS) {
      for (const lane of ANCHOR2_STYLE_LIBRARY[id].paletteLanes) {
        if (lane.fieldValue === 'light') expect(lane.anchorValue).toBe('dark');
        if (lane.fieldValue === 'dark') expect(lane.anchorValue).toBe('light');
      }
    }
  });

  it('validation rejects a definition that breaks the contrast rule', () => {
    const base = ANCHOR2_STYLE_LIBRARY.paper_v2;
    const broken: Anchor2StyleDefinition = {
      ...base,
      paletteLanes: [
        { ...base.paletteLanes[0], fieldValue: 'light', anchorValue: 'light' },
        base.paletteLanes[1],
      ],
    };
    expect(validateAnchor2StyleDefinition(broken).join(' ')).toContain('light field needs a dark structure');
  });

  it('splits availability into the requested forward and rotation sets, all still generatable', () => {
    expect([...ANCHOR2_FORWARD_STYLE_IDS].sort()).toEqual(
      [
        'deep_cosmos_v2',
        'velvet_ember_v2',
        'porcelain_v2',
        'paper_v2',
        'woven_v2',
        'plush_v2',
        'herbarium_v2',
        'alloy_v2',
        'graphic_v2',
        'gilt_v2',
        'flash_v2',
        'buff_v2',
      ].sort()
    );
    expect([...ANCHOR2_ROTATION_STYLE_IDS].sort()).toEqual(
      ['prism_flow_v2', 'clay_v2', 'joybrush_v2'].sort()
    );
    for (const id of ANCHOR2_ROTATION_STYLE_IDS) {
      const prompt = buildStylePrompt('steady focus', id, 0);
      expect(prompt).toContain('ANCHOR 2.0 PRESENTATION CONTRACT');
      expect(getStyleNegativePrompt(id).length).toBeGreaterThan(GLOBAL_NEGATIVE_PROMPT.length / 2);
    }
  });

  it('lets clay_v2 be renamed at display level without changing its ID or its prompts', () => {
    const original = ANCHOR2_STYLE_LIBRARY.clay_v2;
    const renamed: Anchor2StyleDefinition = { ...original, displayName: 'Brand New Public Name' };
    expect(renamed.id).toBe('clay_v2');
    const before = buildStylePrompt('steady focus', 'clay_v2', 0, { category: 'health' });
    const after = buildAnchor2StylePrompt(renamed, 'steady focus', 0, { category: 'health' });
    expect(after).toBe(before);
    expect(before).not.toContain(original.displayName);
    expect(after).not.toContain('Brand New Public Name');
  });

  it('the forbidden-term scanner actually catches transparency, isolation and blank-background copy', () => {
    for (const bad of [
      'Render on a transparent background',
      'there is no background',
      'an isolated symbol',
      'a standalone symbol',
      'on a plain background',
      'on a white background',
      'over a solid background',
    ]) {
      expect(ANCHOR2_FORBIDDEN_PROMPT_PATTERNS.some(pattern => pattern.test(bad))).toBe(true);
    }
    expect(ANCHOR2_FORBIDDEN_PROMPT_PATTERNS.some(pattern => pattern.test('a plain weave linen field'))).toBe(false);
  });

  it('keeps the intention signal from adding detail inside the Anchor footprint', () => {
    for (const id of ANCHOR2_STYLE_IDS) {
      const prompt = buildStylePrompt('steady focus and growth', id, 0);
      expect(prompt).toContain('never as added detail, texture or marks within the Anchor footprint');
    }
  });
});

describe('Anchor 2.0 prompt contract', () => {
  const renders: Array<{ id: string; label: string; prompt: string }> = [];
  for (const id of ANCHOR2_STYLE_IDS) {
    for (const intention of INTENTIONS) {
      for (const category of CATEGORIES) {
        for (const variation of [0, 1, 2]) {
          renders.push({
            id,
            label: `${id} | "${intention}" | ${category ?? 'no category'} | v${variation}`,
            prompt: buildStylePrompt(intention, id, variation, { category }),
          });
        }
      }
    }
  }

  it('asks for a complete edge-to-edge material field and never for the field to be removed', () => {
    for (const id of ANCHOR2_STYLE_IDS) {
      const prompt = buildStylePrompt('steady focus', id, 0);
      expect(prompt).toContain('ANCHOR 2.0 PRESENTATION CONTRACT');
      expect(prompt).toContain('one complete edge-to-edge artwork');
      expect(prompt).toContain('The style field is REQUIRED.');
      expect(prompt).toContain('Do not remove the field.');
      expect(prompt).toContain('approximately 75–85%');
      expect(prompt).toContain('Do not add:');
      expect(prompt).toContain('presentation plates');
    }
  });

  it('never contains transparency, isolation or blank/plain/white/solid background language', () => {
    expect(renders.length).toBeGreaterThan(1000);
    for (const { label, prompt } of renders) {
      for (const pattern of ANCHOR2_FORBIDDEN_PROMPT_PATTERNS) {
        if (pattern.test(prompt)) {
          throw new Error(`prompt matched ${pattern} for ${label}`);
        }
      }
    }
  });

  it('keeps the legacy standalone mandate out of every Anchor 2.0 prompt', () => {
    for (const { prompt } of renders) {
      expect(prompt).not.toContain('STANDALONE ANCHOR ARTWORK REQUIREMENT');
      expect(prompt).not.toContain('DO NOT generate a background');
      expect(prompt).not.toContain('Prefer transparent');
      expect(prompt).not.toContain('BACKWARD COMPATIBILITY RULE');
      expect(prompt).not.toContain('PERSONAL MARK OF INTENT');
    }
  });

  it('keeps structural preservation absolute using the shared block', () => {
    for (const id of ANCHOR2_STYLE_IDS) {
      const prompt = buildStylePrompt('steady focus', id, 0);
      expect(prompt).toContain('STRUCTURAL PRESERVATION — ABSOLUTE PRIORITY');
      for (const verb of ['warp', 'bend', 'melt', 'rotate', 'skew', 'redraw', 'simplify', 'reshape', 'replace', 'reinterpret', 'disconnect', 'extend', 'shorten', 'break']) {
        expect(prompt).toContain(`- ${verb}\n`);
      }
      expect(prompt).toContain('Treat the Anchor as an immutable master structure.');
    }
    // the shared block is byte-identical in legacy and anchor2 prompts
    const legacy = buildStylePrompt('steady focus', 'watercolor', 0);
    const anchor2 = buildStylePrompt('steady focus', 'woven_v2', 0);
    const start = legacy.indexOf('STRUCTURAL PRESERVATION — ABSOLUTE PRIORITY');
    const end = legacy.indexOf('geometry must remain unchanged.') + 'geometry must remain unchanged.'.length;
    expect(anchor2).toContain(legacy.slice(start, end));
  });

  it('includes adaptive contrast, the lane structure colour and Anchor-aware legibility instructions', () => {
    for (const id of ANCHOR2_STYLE_IDS) {
      const prompt = buildStylePrompt('steady focus', id, 0);
      expect(prompt).toContain('ADAPTIVE ANCHOR CONTRAST — LOCKED RULE');
      expect(prompt).toContain('predominantly LIGHT, use a DARK structure colour');
      expect(prompt).toContain('predominantly DARK, use a LIGHT structure colour');
      expect(prompt).toContain('Do not force gold merely because the style contains gold.');
      expect(prompt).toContain('Legibility has priority over palette loyalty.');
      expect(prompt).toContain('STRUCTURE COLOUR FOR THIS RENDER');
      expect(prompt).toContain('ANCHOR-AWARE LEGIBILITY FIELD');
      expect(prompt).toContain('follows the actual Anchor footprint');
      expect(prompt).toContain('strongest coherent line structure');
      expect(prompt).toContain('LEGIBILITY HAZARDS');
      expect(prompt).toContain('hairline cracks');
      expect(prompt).not.toContain('clear center third');
      expect(prompt).not.toContain('empty center');
    }
  });

  it('carries locked core, allowed variation, prohibited drift, anchor rendering and the texture default', () => {
    for (const id of ANCHOR2_STYLE_IDS) {
      const def = ANCHOR2_STYLE_LIBRARY[id];
      const prompt = buildStylePrompt('steady focus', id, 0);
      expect(prompt).toContain('LOCKED CORE');
      expect(prompt).toContain('ALLOWED VARIATION');
      expect(prompt).toContain('PROHIBITED DRIFT');
      for (const item of [...def.lockedCore, ...def.allowedVariation, ...def.prohibitedDrift]) {
        expect(prompt).toContain(item);
      }
      expect(prompt).toContain(def.anchorRendering);
      expect(prompt).toContain(def.visualLanguage.coreArtWorld);
      expect(prompt).toContain('GLOBAL TEXTURE DEFAULT');
      expect(prompt).toContain('smooth, fine, low-contrast tooth');
      expect(prompt).toContain('Avoid wrinkled, crystalline or stippled filter-like texture');
      expect(prompt).toContain('MATERIAL TRUTH');
      expect(prompt).toContain('visual grammar, not a template');
    }
  });

  it('does not import another style’s material world', () => {
    for (const id of ANCHOR2_STYLE_IDS) {
      const prompt = buildStylePrompt('steady focus', id, 0);
      for (const other of ANCHOR2_STYLE_IDS) {
        if (other === id) continue;
        expect(prompt).not.toContain(ANCHOR2_STYLE_LIBRARY[other].materialName);
        expect(prompt).not.toContain(ANCHOR2_STYLE_LIBRARY[other].visualLanguage.coreArtWorld);
      }
    }
  });

  it('keeps category secondary to style and the intention non-literal', () => {
    const prompt = buildStylePrompt('abundant harvest', 'gilt_v2', 0, { category: 'abundance' });
    expect(prompt).toContain('CATEGORY SIGNAL — SECONDARY TO STYLE');
    expect(prompt).toContain('must not replace the locked style identity');
    expect(prompt).toContain('must not force a colour onto the Anchor when contrast suffers');
    expect(prompt).toContain('INTENTION SIGNAL LAYER — NON-LITERAL');
    expect(prompt).toContain('money for abundance');
    expect(prompt).toContain('Abundance');
  });

  it('selects the palette lane deterministically from the seed and states the structure colour', () => {
    for (const id of ANCHOR2_STYLE_IDS) {
      const def = ANCHOR2_STYLE_LIBRARY[id];
      for (const intention of INTENTIONS) {
        for (const variation of [0, 1, 2, 3]) {
          const a = selectAnchor2PaletteLane(def, intention, variation, 'career');
          const b = selectAnchor2PaletteLane(def, intention, variation, 'career');
          expect(b).toBe(a);
          const prompt = buildStylePrompt(intention, id, variation, { category: 'career' });
          expect(prompt).toContain(`STRUCTURE COLOUR FOR THIS RENDER (${a.label})`);
          expect(prompt).toContain(a.anchorTone);
          expect(prompt).toContain(`Anchor structure in a ${a.anchorValue.toUpperCase()} tone: ${a.anchorTone}`);
          if (a.fieldValue === 'mixed') {
            expect(prompt).toContain('calm, low-contrast');
            expect(prompt).toContain('tonal zone behind the geometry');
          }
        }
      }
      // the seed spreads across lanes rather than always picking one
      const seen = new Set<string>();
      for (let i = 0; i < 40; i += 1) seen.add(selectAnchor2PaletteLane(def, `intention ${i}`, i).id);
      expect(seen.size).toBeGreaterThan(1);
    }
  });

  it('is fully deterministic: identical inputs give identical prompts', () => {
    for (const id of ANCHOR2_STYLE_IDS) {
      expect(buildStylePrompt('steady focus', id, 1, { category: 'health' })).toBe(
        buildStylePrompt('steady focus', id, 1, { category: 'health' })
      );
    }
  });

  it('keeps style-specific legibility rules where the style’s richest feature is', () => {
    expect(buildStylePrompt('x', 'herbarium_v2', 0)).toContain('thin stems and veins must stay away from or soften');
    expect(buildStylePrompt('x', 'deep_cosmos_v2', 0)).toContain('star and speckle density must thin to nothing around the geometry');
    expect(buildStylePrompt('x', 'buff_v2', 0)).toContain('no drip, crack or dense splatter near or across the geometry');
    expect(buildStylePrompt('x', 'gilt_v2', 0)).toContain('loose leaf patches stay peripheral');
    expect(buildStylePrompt('x', 'flash_v2', 0)).toContain('keep thick flash linework subordinate to and away from the geometry');
    expect(buildStylePrompt('x', 'porcelain_v2', 0)).toContain('crackle must soften and clear behind the geometry');
  });

  it('keeps Alloy, Gilt, Woven, Plush and Buff material identities distinct', () => {
    const woven = buildStylePrompt('x', 'woven_v2', 0);
    expect(woven).toContain('flat woven fabric');
    expect(woven).toContain('embroidery or stitched illustration as background decoration');
    expect(ANCHOR2_STYLE_LIBRARY.woven_v2.anchorRendering).toContain('contrasting thread sewn through the cloth');

    const plush = buildStylePrompt('x', 'plush_v2', 0);
    expect(plush).toContain('no visible weave');
    expect(plush).toContain('any darkening or maturing of the style');

    const alloy = buildStylePrompt('x', 'alloy_v2', 0);
    expect(alloy).toContain('machined');
    expect(alloy).toContain('gold-leaf treatment');

    const gilt = buildStylePrompt('x', 'gilt_v2', 0);
    expect(gilt).toContain('not a metal plate');
    expect(gilt).toContain('brushed sheet metal');

    const buff = buildStylePrompt('x', 'buff_v2', 0);
    expect(buff).toContain('the wall, not the writing');
    expect(buff).toContain('readable tags, letters or bubble lettering');
  });
});

describe('Anchor 2.0 negative prompt', () => {
  it('keeps the global negative, drops surface-forbidding terms and adds the legibility constraints', () => {
    const globalTokens = GLOBAL_NEGATIVE_PROMPT.split(',').map(token => token.trim());
    for (const id of ANCHOR2_STYLE_IDS) {
      const tokens = getStyleNegativePrompt(id)
        .split(',')
        .map(token => token.trim());
      for (const token of globalTokens) {
        if (ANCHOR2_REMOVED_GLOBAL_NEGATIVE_TERMS.includes(token)) {
          expect(tokens).not.toContain(token);
        } else {
          expect(tokens).toContain(token);
        }
      }
      for (const addition of ANCHOR2_NEGATIVE_ADDITIONS) {
        expect(tokens).toContain(addition);
      }
      for (const addition of ANCHOR2_STYLE_LIBRARY[id].visualLanguage.negativePromptAdditions ?? []) {
        expect(tokens).toContain(addition);
      }
      expect(new Set(tokens).size).toBe(tokens.length);
    }
  });

  it('never forbids a background, surface or texture the 2.0 styles require', () => {
    for (const id of ANCHOR2_STYLE_IDS) {
      const negative = getStyleNegativePrompt(id);
      for (const pattern of ANCHOR2_FORBIDDEN_PROMPT_PATTERNS) {
        expect(negative).not.toMatch(pattern);
      }
      for (const removed of ANCHOR2_REMOVED_GLOBAL_NEGATIVE_TERMS) {
        expect(negative.split(',').map(token => token.trim())).not.toContain(removed);
      }
      expect(negative).not.toMatch(/(^|, )(backgrounds?|textures?|surfaces?|fields?|grain|fabric|paper|canvas)(,|$)/i);
    }
  });

  it('leaves the legacy negative prompt untouched', () => {
    expect(getStyleNegativePrompt('watercolor').startsWith(GLOBAL_NEGATIVE_PROMPT)).toBe(true);
    expect(getStyleNegativePrompt('watercolor')).toContain('canvases');
  });
});

describe('Anchor 2.0 provider wrappers', () => {
  it.each(PROVIDERS)('%s wrapper agrees with the anchor2 prompt and never mandates transparency', provider => {
    for (const id of ANCHOR2_STYLE_IDS) {
      const prompt = buildStylePrompt('steady focus', id, 0);
      const wrapped = buildReferenceImageWrapper(provider, prompt, id);
      expect(wrapped.startsWith(prompt)).toBe(true);
      for (const pattern of ANCHOR2_FORBIDDEN_PROMPT_PATTERNS) {
        expect(wrapped).not.toMatch(pattern);
      }
      expect(wrapped).toContain('REQUIRED');
      expect(wrapped).toContain('edge-to-edge');
      expect(wrapped).toContain('75–85%');
      expect(wrapped).toContain('Adaptive contrast');
      expect(wrapped).toContain('geometry');
      expect(wrapped).not.toContain('STANDALONE ARTWORK MANDATE');
      expect(wrapped).not.toContain('DO NOT generate a background');
      expect(wrapped).not.toContain('centered artistic emblem');
      expect(wrapped).not.toContain('atmospheric background');
    }
  });

  it('reference-image wrappers keep geometry exact, no containers, and calm the footprint', () => {
    const tail = getReferenceImageWrapperTail('nanoBanana', 'flash_v2');
    expect(tail).toContain('Preserve the exact Anchor lines, circles, intersections, angles, nodes, and geometric relationships');
    expect(tail).toContain('Do not add frames, cards, plaques, medallions, presentation plates, bounding boxes or extra enclosing rings');
    expect(tail).toContain('Keep the area behind and around the geometry calm');
    expect(tail).toContain('perimeter');
    expect(getReferenceImageWrapperTail('geminiAdapter', 'flash_v2')).toBe(tail);
  });

  it('resolves the wrapper from the registry by style ID only', () => {
    expect(getReferenceImageWrapperTail('nanoBanana', 'woven_v2')).not.toBe(
      getReferenceImageWrapperTail('nanoBanana', 'watercolor')
    );
    expect(getReferenceImageWrapperTail('nanoBanana', 'woven-v2')).toBe(
      getReferenceImageWrapperTail('nanoBanana', 'woven_v2')
    );
    expect(getReferenceImageWrapperTail('openAi', 'not_a_style')).toBe(fixture.wrapperTails.openAi);
  });
});

describe('GeminiImageService request payload (provider call path)', () => {
  const originalEnv = process.env;
  const generateContent = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers(); // the service arms an un-cleared 60s call timeout
    jest.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
    delete process.env.OPENAI_API_KEY;
    (GoogleGenAI as jest.Mock).mockImplementation(() => ({ models: { generateContent } }));
    generateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ inlineData: { data: 'aGVsbG8=' } }] } }],
    });
    (validateAnchorArtwork as jest.Mock).mockResolvedValue({
      isValid: true,
      widthRatio: 0.8,
      heightRatio: 0.8,
      hasDominantRectangularEnclosure: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
  });

  async function generate(styleApproach: string) {
    const service = new GeminiImageService();
    jest
      .spyOn(service as unknown as { svgToPng: () => Promise<Buffer> }, 'svgToPng')
      .mockResolvedValue(Buffer.from('png'));
    const result = await service.enhanceSigil({
      baseSigilSvg: '<svg/>',
      intentionText: fixture.intention,
      styleApproach,
      numberOfVariations: 1,
      tier: 'draft',
    });
    const request = generateContent.mock.calls[0][0];
    const text: string = request.contents[0].parts[0].text;
    return { result, request, text };
  }

  it('sends an anchor2 prompt + wrapper with no transparency contradiction and skips the empty-surround validator', async () => {
    const { result, request, text } = await generate('woven_v2');
    expect(text).toBe(buildReferenceImageWrapper('nanoBanana', buildStylePrompt(fixture.intention, 'woven_v2', 0), 'woven_v2'));
    for (const pattern of ANCHOR2_FORBIDDEN_PROMPT_PATTERNS) {
      expect(text).not.toMatch(pattern);
      expect(result.negativePrompt).not.toMatch(pattern);
    }
    expect(text).toContain('The style field is REQUIRED.');
    expect(text).toContain('ANCHOR 2.0 PRESENTATION REMINDER');
    expect(result.negativePrompt).toContain('Anchor blending into background');
    expect(request.config.imageConfig.aspectRatio).toBe('1:1');
    expect(validateAnchorArtwork).not.toHaveBeenCalled();
  });

  it('sends the unchanged legacy prompt + wrapper and still runs the legacy validator', async () => {
    const { request, text } = await generate('watercolor');
    expect(text).toBe(`${fixture.styles.watercolor.prompt}\n\n${fixture.wrapperTails.nanoBanana}`);
    expect(text).toContain('clean/transparent background');
    expect(request.config.imageConfig.aspectRatio).toBe('1:1');
    expect(validateAnchorArtwork).toHaveBeenCalledTimes(1);
  });
});

describe('Form I / Form II are a real choice', () => {
  const traits = (prompt: string) => ({
    material: /Material subtype: (.*)/.exec(prompt)?.[1],
    motif: /Style-native motif to favour: (.*)/.exec(prompt)?.[1],
    placement: /Peripheral placement: (.*)/.exec(prompt)?.[1],
    lane: /Palette lane: (.*)/.exec(prompt)?.[1],
  });

  it.each([...ANCHOR2_STYLE_IDS])('%s: the two Forms never share a lane, material, motif or placement', id => {
    for (const intention of INTENTIONS) {
      const first = traits(buildStylePrompt(intention, id, 0, { category: 'career' }));
      const second = traits(buildStylePrompt(intention, id, 1, { category: 'career' }));
      expect(second.lane).not.toBe(first.lane);
      expect(second.material).not.toBe(first.material);
      expect(second.motif).not.toBe(first.motif);
      expect(second.placement).not.toBe(first.placement);
    }
  });

  it.each([...ANCHOR2_STYLE_IDS])('%s: the two Forms differ in composition and sit on opposite field values', id => {
    const def = ANCHOR2_STYLE_LIBRARY[id];
    const hasExtremes = def.paletteLanes.some(l => l.fieldValue === 'light') && def.paletteLanes.some(l => l.fieldValue === 'dark');
    for (const intention of INTENTIONS) {
      const first = buildStylePrompt(intention, id, 0, { category: 'career' });
      const second = buildStylePrompt(intention, id, 1, { category: 'career' });
      expect(/Composition: (.*)/.exec(second)?.[1]).not.toBe(/Composition: (.*)/.exec(first)?.[1]);
      expect(second).toContain('one of two options shown side by side');
      const a = selectAnchor2PaletteLane(def, intention, 0, 'career');
      const b = selectAnchor2PaletteLane(def, intention, 1, 'career');
      const values = new Set(def.paletteLanes.map(l => l.fieldValue));
      if (values.size > 1) expect(b.fieldValue).not.toBe(a.fieldValue);
      if (a.fieldValue !== 'mixed' && hasExtremes) expect(b.fieldValue).toBe(a.fieldValue === 'light' ? 'dark' : 'light');
    }
  });
});
