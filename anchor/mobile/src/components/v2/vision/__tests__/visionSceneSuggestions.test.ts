import { applySceneSuggestion, visionSceneSuggestions } from '../visionSceneSuggestions';

describe('visionSceneSuggestions', () => {
  it('derives shortcuts from the person\'s actual goal', () => {
    expect(visionSceneSuggestions('Buy my dream home with a pool')).toEqual(['Inside my home', 'Getting the keys', 'Family moments', 'Backyard at night']);
    expect(visionSceneSuggestions('Run a marathon')).toContain('Crossing the finish line');
    expect(visionSceneSuggestions('Run a marathon')).not.toContain('Inside my home');
  });

  it('returns no shortcuts rather than a generic list when the goal gives no theme', () => {
    expect(visionSceneSuggestions('Be better')).toEqual([]);
    expect(visionSceneSuggestions('   ')).toEqual([]);
  });

  it('never offers more than four and drops ones already typed', () => {
    const all = visionSceneSuggestions('Teach at a school');
    expect(all.length).toBeLessThanOrEqual(4);
    expect(visionSceneSuggestions('Teach at a school', 'In the classroom with my students')).not.toContain('In the classroom');
  });
});

describe('applySceneSuggestion', () => {
  it('fills an empty field', () => {
    expect(applySceneSuggestion('', 'Inside my home')).toBe('Inside my home');
    expect(applySceneSuggestion('   ', 'Inside my home')).toBe('Inside my home');
  });

  it('adds to the person\'s words without overwriting them', () => {
    expect(applySceneSuggestion('Morning light on the kitchen island', 'Family moments')).toBe('Morning light on the kitchen island\nFamily moments');
  });
});
