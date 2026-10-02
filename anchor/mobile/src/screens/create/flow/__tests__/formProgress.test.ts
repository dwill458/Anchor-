import { estimatedFormProgress } from '../formProgress';

describe('estimatedFormProgress', () => {
  it('starts at zero and reaches ~92% at the p80 time', () => {
    expect(estimatedFormProgress(0, 15)).toBe(0);
    expect(estimatedFormProgress(15, 15)).toBeCloseTo(0.92, 5);
  });

  it('only ever rises, and never reaches 100% on its own', () => {
    let previous = 0;
    for (let t = 0.5; t <= 120; t += 0.5) {
      const value = estimatedFormProgress(t, 15);
      expect(value).toBeGreaterThan(previous);
      expect(value).toBeLessThan(0.97);
      previous = value;
    }
  });

  it('keeps visibly moving past p80 (never looks frozen)', () => {
    const gain = estimatedFormProgress(25, 15) - estimatedFormProgress(20, 15);
    expect(gain).toBeGreaterThan(0.002);
  });
});
