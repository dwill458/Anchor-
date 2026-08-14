import {
  REFINE_STYLES,
  allStyles,
  coreStyles,
  familyStyles,
  featuredStyles,
  getFilteredStyles,
  getRecommendedStyles,
  heroStyle,
  railStyles,
  seasonalStyles,
} from '../refineStyles';

describe('refineStyles', () => {
  it('defines unique styles with valid generation style mappings', () => {
    expect(REFINE_STYLES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(REFINE_STYLES.map((s) => s.id)).size).toBe(REFINE_STYLES.length);
    expect(new Set(REFINE_STYLES.map((s) => s.displayName)).size).toBe(REFINE_STYLES.length);
    expect(REFINE_STYLES.every((s) => Boolean(s.generationStyle))).toBe(true);
  });

  it('correctly derives featured, hero, rail, core, and seasonal collections', () => {
    expect(featuredStyles.length).toBeGreaterThan(0);
    expect(heroStyle).toBeDefined();
    expect(heroStyle.id).toBe('solar-veil');
    expect(railStyles.every((s) => s.id !== heroStyle.id)).toBe(true);
    expect(coreStyles.length).toBeGreaterThan(0);
    expect(seasonalStyles.length).toBeGreaterThan(0);
    expect(allStyles.length).toBe(REFINE_STYLES.length);
  });

  it('filters styles by aesthetic family', () => {
    const organic = getFilteredStyles('organic');
    expect(organic.length).toBeGreaterThan(0);
    expect(organic.every((style) => style.family === 'ORGANIC')).toBe(true);

    const geometric = familyStyles('GEOMETRIC');
    expect(geometric.length).toBeGreaterThan(0);
    expect(geometric.every((style) => style.family === 'GEOMETRIC')).toBe(true);
  });

  it('scores recommendations properly based on intention and category', () => {
    const recommendations = getRecommendedStyles('career', 'I will focus on architecture and discipline');
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.some((style) => style.id === 'architectural-trace')).toBe(true);
  });

  it('does not score recommendation keywords inside unrelated words', () => {
    const recommendations = getRecommendedStyles('custom', 'I will start a new routine');
    const creativityStyleIds = REFINE_STYLES.filter((style) =>
      style.recommendationKeywords.includes('art')
    ).map((style) => style.id);

    expect(recommendations.some((style) => creativityStyleIds.includes(style.id))).toBe(false);
  });
});
