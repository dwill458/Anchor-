import { detectCategoryFromText } from '../categoryDetection';

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
});
