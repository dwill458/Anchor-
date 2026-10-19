import {
  normalizeThreadStrength,
  threadAuraParameters,
  auraTransition,
  homeAuraEntranceTargets,
  detailsAuraOpacity,
  HOME_AURA_BLOOM_IN_MS,
  HOME_AURA_SETTLE_MS,
  HOME_AURA_ENTRANCE_TOTAL_MS,
  HOME_AURA_FADE_OUT_MS,
  HOME_AURA_INITIAL_SCALE,
  HOME_AURA_PEAK_SCALE,
  THREAD_AURA_SPAN,
  HOME_AURA_REST_SCALE,
} from './threadAuraModel';

const strengths = [0, 10, 25, 40, 50, 68, 75, 89, 95, 100];
describe('Thread aura presentation mapping', () => {
  it.each([[-10, 0], [0, 0], [68, 0.68], [100, 1], [150, 1], [NaN, 0], [Infinity, 0], [null, 0], [undefined, 0]])('normalizes %s safely', (input, expected) => {
    expect(normalizeThreadStrength(input)).toBe(expected);
  });
  it.each(['home', 'details'] as const)('grows continuously in %s', variant => {
    const keys = ['core', 'coreWidth', 'mid', 'midWidth', 'bloom', 'bloomWidth', 'filament', 'movement', 'particles'] as const;
    for (const key of keys) {
      const values = strengths.map(value => threadAuraParameters(value / 100, variant)[key]);
      values.forEach((value, i) => { if (i) expect(value).toBeGreaterThan(values[i - 1]); });
      expect(Math.abs(threadAuraParameters(0.75, variant)[key] - threadAuraParameters(0.74999, variant)[key])).toBeLessThan(0.001);
    }
    expect(threadAuraParameters(0, variant).filament).toBe(0);
    expect(threadAuraParameters(0, variant).core).toBe(0);
  });
  it('shares one shape between Home and Details, with Details 5% more pronounced', () => {
    expect(threadAuraParameters(0.95, 'home')).toEqual(threadAuraParameters(0.95, 'details'));
    expect(detailsAuraOpacity(80)).toBeCloseTo(homeAuraEntranceTargets(80).restingOpacity * 1.05, 2);
    expect(detailsAuraOpacity(0)).toBe(0);
  });
  it('rewards only a measured increase, settles first measurements, retreats quietly', () => {
    expect(auraTransition(null, 25).reward).toBe(false);
    expect(auraTransition(50, 68).reward).toBe(true);
    expect(auraTransition(68, 50).reward).toBe(false);
    expect(auraTransition(68, 68).reward).toBe(false);
    expect(auraTransition(68, null).reward).toBe(false);
    expect(auraTransition(100, 120).reward).toBe(false);
  });
  it('gives Home exactly zero glow at zero or unknown strength', () => {
    for (const value of [0, null, undefined, NaN]) {
      const t = homeAuraEntranceTargets(value);
      expect([t.initialOpacity, t.peakOpacity, t.restingOpacity]).toEqual([0, 0, 0]);
      expect(t.peakScale).toBe(1);
      expect(t.initialScale).toBe(1);
    }
    const p = threadAuraParameters(0, 'home');
    expect(Object.values(p).every(v => v === 0)).toBe(true);
  });
  it('defines the 180ms bloom to 1.15x then 420ms settle, starting at the coin edge', () => {
    expect(HOME_AURA_BLOOM_IN_MS).toBe(180);
    expect(HOME_AURA_SETTLE_MS).toBe(420);
    expect(HOME_AURA_ENTRANCE_TOTAL_MS).toBe(600);
    expect(HOME_AURA_FADE_OUT_MS).toBe(140);
    // Layer diameter equals coin diameter at the initial scale.
    expect(HOME_AURA_INITIAL_SCALE * THREAD_AURA_SPAN).toBeCloseTo(1);
    expect(HOME_AURA_PEAK_SCALE).toBeCloseTo(1.15);
    expect(HOME_AURA_REST_SCALE).toBe(1);

    const [one, low, mid, high, full] = [1, 26, 49, 80, 100].map(homeAuraEntranceTargets);
    expect(one.restingOpacity).toBeLessThan(0.05);
    expect(one.restingOpacity).toBeGreaterThan(0);
    expect(low.restingOpacity).toBeGreaterThan(one.restingOpacity);
    expect(mid.restingOpacity).toBeGreaterThan(low.restingOpacity);
    expect(high.restingOpacity).toBeGreaterThan(mid.restingOpacity);
    expect(full.restingOpacity).toBeGreaterThan(high.restingOpacity);
    // ~33% quieter than the previous full-strength calibration (1.0), and 49% clearly below the old 0.75.
    expect(full.restingOpacity).toBeCloseTo(0.847, 2);
    expect(mid.restingOpacity).toBeLessThan(0.55);
    expect(low.peakOpacity).toBeGreaterThan(low.restingOpacity);
    expect(low.peakScale).toBe(1.15);
  });
});
