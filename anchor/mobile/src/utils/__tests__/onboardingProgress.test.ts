import { getOnboardingProgressPercent } from '../onboardingProgress';

describe('getOnboardingProgressPercent', () => {
  it('makes the first step feel underway instead of empty', () => {
    expect(getOnboardingProgressPercent(0, 5)).toBe(20);
  });

  it('calculates progress from completed steps', () => {
    expect(getOnboardingProgressPercent(2, 5)).toBe(60);
    expect(getOnboardingProgressPercent(4, 5)).toBe(100);
  });

  it('clamps invalid step values and handles an invalid total', () => {
    expect(getOnboardingProgressPercent(-1, 5)).toBe(0);
    expect(getOnboardingProgressPercent(7, 5)).toBe(100);
    expect(getOnboardingProgressPercent(0, 0)).toBe(0);
  });
});
