import { normalizeThreadStrength, threadAuraParameters, auraTransition } from './threadAuraModel';

const strengths = [0, 10, 25, 40, 50, 68, 75, 89, 95, 100];
describe('Thread aura presentation mapping', () => {
  it.each([[-10, 0], [0, 0], [68, 0.68], [100, 1], [150, 1], [NaN, 0], [Infinity, 0], [null, 0], [undefined, 0]])('normalizes %s safely', (input, expected) => {
    expect(normalizeThreadStrength(input)).toBe(expected);
  });
  it.each(['home', 'details'] as const)('grows continuously in %s', variant => {
    const keys = ['radius', 'blur', 'inner', 'outer', 'movement', 'particles', 'ambient'] as const;
    for (const key of keys) {
      const values = strengths.map(value => threadAuraParameters(value / 100, variant)[key]);
      values.forEach((value, i) => { if (i) expect(value).toBeGreaterThan(values[i - 1]); });
      expect(Math.abs(threadAuraParameters(0.75, variant)[key] - threadAuraParameters(0.74999, variant)[key])).toBeLessThan(0.001);
    }
    expect(threadAuraParameters(0, variant).outer).toBe(0);
    expect(threadAuraParameters(1, variant).inner).toBeLessThan(0.5);
  });
  it('restrains Home relative to Details', () => {
    expect(threadAuraParameters(0.95, 'home').outer).toBeLessThan(threadAuraParameters(0.95, 'details').outer);
  });
  it('rewards only a measured increase, settles first measurements, retreats quietly', () => {
    expect(auraTransition(null, 25).reward).toBe(false);
    expect(auraTransition(50, 68).reward).toBe(true);
    expect(auraTransition(68, 50).reward).toBe(false);
    expect(auraTransition(68, 68).reward).toBe(false);
    expect(auraTransition(68, null).reward).toBe(false);
    expect(auraTransition(100, 120).reward).toBe(false);
  });
});
