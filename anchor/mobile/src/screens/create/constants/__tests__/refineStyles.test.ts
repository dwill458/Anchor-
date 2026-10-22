import {
  REFINE_STYLES,
  coreStyles,
  featuredStyles,
  getFilteredStyles,
  getRecommendedStyles,
  seasonalStyles,
} from '../refineStyles';
import { STYLE_ASSETS } from '@/assets/styles';

describe('refineStyles (Anchor 2.0)', () => {
  const EXPECTED_2_0_DISPLAY_NAMES = [
    'Velvet Ember',
    'Porcelain',
    'Prism Flow',
    'Joybrush',
    'Deep Cosmos',
    'Woven',
    'Paper',
    'Mineral Wash',
    'Graphic',
    'Plush',
    'Herbarium',
    'Alloy',
    'Gilt',
    'Flash',
    'Buff',
  ];

  const EXPECTED_2_0_IDS = [
    'velvet-ember',
    'porcelain',
    'prism-flow',
    'joybrush',
    'deep-cosmos',
    'woven',
    'paper',
    'mineral-wash',
    'graphic',
    'plush',
    'herbarium',
    'alloy',
    'gilt',
    'flash',
    'buff',
  ];

  it('defines exactly the 15 Anchor 2.0 styles in the canonical order', () => {
    expect(REFINE_STYLES).toHaveLength(15);
    expect(REFINE_STYLES.map((s) => s.displayName)).toEqual(EXPECTED_2_0_DISPLAY_NAMES);
    expect(REFINE_STYLES.map((s) => s.id)).toEqual(EXPECTED_2_0_IDS);
    expect(new Set(REFINE_STYLES.map((style) => style.id)).size).toBe(15);
    expect(new Set(REFINE_STYLES.map((style) => style.generationStyle)).size).toBe(15);
    expect(featuredStyles.length + coreStyles.length + seasonalStyles.length).toBe(15);
  });

  it('has a production thumbnail asset for every Anchor 2.0 style', () => {
    for (const style of REFINE_STYLES) {
      expect(STYLE_ASSETS[style.id]).toBeDefined();
      expect(STYLE_ASSETS[style.generationStyle]).toBeDefined();
    }
  });

  it('contains zero legacy styles in the 2.0 picker', () => {
    const legacyNames = [
      'Watercolor',
      'Sacred Geometry',
      'Ink Brush',
      'Gold Leaf',
      'Cosmic',
      'Architectural Trace',
      'Lunar Etch',
      'Aurora Glow',
      'Ember Trace',
      'Resonance Rings',
      'Monolith Ink',
      'Celestial Grid',
      'Minimal Line',
      'Obsidian Mono',
      'Echo Chamber',
      'Prism Veil',
      'Verdigris Relic',
      'Solar Halo',
      'Tideglass',
    ];
    for (const name of legacyNames) {
      expect(REFINE_STYLES.some((s) => s.displayName === name)).toBe(false);
    }
  });

  it('filters styles by visual category', () => {
    const organic = getFilteredStyles('organic');

    expect(organic.length).toBeGreaterThan(0);
    expect(organic.every((style) => style.category === 'Organic')).toBe(true);
  });

  it('does not score recommendation keywords inside unrelated words', () => {
    const recommendations = getRecommendedStyles('custom', 'I will start a new routine');
    const creativityStyleIds = REFINE_STYLES.filter((style) =>
      style.recommendationKeywords.includes('art')
    ).map((style) => style.id);

    expect(recommendations.some((style) => creativityStyleIds.includes(style.id))).toBe(false);
  });
});
