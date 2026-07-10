import {
  REFINE_STYLES,
  coreStyles,
  featuredStyles,
  getFilteredStyles,
  getRecommendedStyles,
  seasonalStyles,
} from '../refineStyles';

describe('refineStyles', () => {
  it('defines 20 unique launch styles across one section each', () => {
    expect(REFINE_STYLES).toHaveLength(20);
    expect(new Set(REFINE_STYLES.map(style => style.id)).size).toBe(20);
    expect(new Set(REFINE_STYLES.map(style => style.generationStyle)).size).toBe(20);
    expect(featuredStyles.length + coreStyles.length + seasonalStyles.length).toBe(20);
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
