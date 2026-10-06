import { getNextPractice } from '../nextPractice';

describe('getNextPractice', () => {
  it('recommends Focus after Visualize', () => {
    expect(getNextPractice({ completedModes: new Set(['visualize']), hasVision: true, chartArcComplete: false })).toBe('focus');
  });

  it('recommends Visualize after Focus when the Anchor has a Vision', () => {
    expect(getNextPractice({ completedModes: new Set(['focus']), hasVision: true, chartArcComplete: false })).toBe('visualize');
  });

  it('recommends Deep Focus after Focus when there is no Vision', () => {
    expect(getNextPractice({ completedModes: new Set(['focus']), hasVision: false, chartArcComplete: false })).toBe('deep_prime');
  });

  it('recommends Deep Focus after both Visualize and Focus', () => {
    expect(getNextPractice({ completedModes: new Set(['visualize', 'focus']), hasVision: true, chartArcComplete: false })).toBe('deep_prime');
  });

  it('skips a practice already completed today', () => {
    expect(getNextPractice({ completedModes: new Set(['visualize', 'focus', 'deep_prime']), hasVision: true, chartArcComplete: true })).toBe('release');
  });

  it('keeps Release unavailable until the Chart arc is complete', () => {
    expect(getNextPractice({ completedModes: new Set(['focus', 'visualize', 'deep_prime']), hasVision: true, chartArcComplete: false })).toBe('all_practices');
  });

  it('returns All Practices after every available mode is completed', () => {
    expect(getNextPractice({ completedModes: new Set(['focus', 'visualize', 'deep_prime', 'release']), hasVision: true, chartArcComplete: true })).toBe('all_practices');
  });
});
