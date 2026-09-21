import { HOME_CATEGORY_ART, homeCategoryArt } from '../homeCategoryArt';

const HOME_CATEGORIES = [
  'desire', 'health', 'career', 'relationships', 'creativity', 'spirituality',
  'abundance', 'family', 'learning', 'adventure', 'focus', 'custom',
] as const;

describe('homeCategoryArt', () => {
  it('bundles one category environment for every Anchor 2.0 category', () => {
    expect(Object.keys(HOME_CATEGORY_ART).sort()).toEqual([...HOME_CATEGORIES].sort());

    for (const category of HOME_CATEGORIES) {
      expect(homeCategoryArt(category)).toBe(HOME_CATEGORY_ART[category]);
      expect(homeCategoryArt(category.toUpperCase())).toBe(HOME_CATEGORY_ART[category]);
    }
  });

  it('does not assign an unrelated environment to an unknown category', () => {
    expect(homeCategoryArt('unknown')).toBeNull();
    expect(homeCategoryArt()).toBeNull();
  });
});
