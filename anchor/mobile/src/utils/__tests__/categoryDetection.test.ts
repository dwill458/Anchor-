import { detectCategoryFromText, resolveAnchorCategory } from '../categoryDetection';

describe('detectCategoryFromText', () => {
  it('classifies a straight-A student as learning, not relationships', () => {
    expect(detectCategoryFromText('I am a straight A student')).toBe('learning');
  });

  it('recognizes academic achievement even when the intention is phrased as a goal', () => {
    expect(detectCategoryFromText('I want to get a 4.0 GPA')).toBe('learning');
    expect(detectCategoryFromText('I ace my exams')).toBe('learning');
  });

  it('does not use a person role as relationship evidence by itself', () => {
    expect(detectCategoryFromText('Become a better student')).toBe('learning');
    expect(detectCategoryFromText('Become a better mentor')).toBe('learning');
  });

  it('still recognizes explicit relationship intentions', () => {
    expect(detectCategoryFromText('Build a stronger relationship with my partner')).toBe(
      'relationships',
    );
  });

  it('reads an ambiguous verb by what it acts on', () => {
    expect(detectCategoryFromText('Run for president')).toBe('career');
    expect(detectCategoryFromText('I want to run for president')).toBe('career');
    expect(detectCategoryFromText('I win the election')).toBe('career');
    expect(detectCategoryFromText('I run my business with ease')).toBe('career');
    expect(detectCategoryFromText('I run a marathon')).toBe('health');
    expect(detectCategoryFromText('I go running every morning')).toBe('health');
  });

  it('does not let framing words like "want" outvote the subject', () => {
    expect(detectCategoryFromText('I want to travel the world')).toBe('adventure');
    expect(detectCategoryFromText('I want to spend more time with my family')).toBe('family');
  });

  it.each([
    ['I attract what I truly desire', 'desire'],
    ['I lose weight and feel strong in my body', 'health'],
    ['I get promoted to director this year', 'career'],
    ['I feel deeply connected in my romantic relationship', 'relationships'],
    ['I write a book and publish it', 'creativity'],
    ['I find inner peace through daily meditation', 'spirituality'],
    ['I become debt free and build wealth', 'abundance'],
    ['I am a patient, present parent to my kids', 'family'],
    ['I learn a language fluently', 'learning'],
    ['I travel to Japan and explore', 'adventure'],
  ])('classifies "%s" as %s', (text, expected) => {
    expect(detectCategoryFromText(text)).toBe(expected);
  });

  it('falls back to Desire only when nothing specific is present', () => {
    expect(detectCategoryFromText('It happens')).toBe('desire');
    expect(detectCategoryFromText('')).toBe('desire');
  });

  it('is deterministic for ties', () => {
    const first = detectCategoryFromText('work and money');
    for (let i = 0; i < 5; i++) expect(detectCategoryFromText('work and money')).toBe(first);
  });
});

describe('resolveAnchorCategory', () => {
  it.each([
    'desire', 'health', 'career', 'relationships', 'creativity', 'spirituality',
    'abundance', 'family', 'learning', 'adventure', 'custom',
  ])('keeps the persisted category %s', category => {
    expect(resolveAnchorCategory(category)).toBe(category);
    expect(resolveAnchorCategory(category.toUpperCase())).toBe(category);
  });

  it('maps older spellings and never guesses from nothing', () => {
    expect(resolveAnchorCategory('healing')).toBe('health');
    expect(resolveAnchorCategory('Career_Success')).toBe('career');
    expect(resolveAnchorCategory('something-new')).toBe('custom');
    expect(resolveAnchorCategory(undefined)).toBe('custom');
    expect(resolveAnchorCategory(null)).toBe('custom');
    expect(resolveAnchorCategory(42)).toBe('custom');
  });
});
