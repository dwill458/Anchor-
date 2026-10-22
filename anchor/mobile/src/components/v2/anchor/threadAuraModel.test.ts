import {
  normalizeThreadStrength,
  threadAuraParameters,
  auraTransition,
  homeAuraRestingOpacity,
  detailsAuraOpacity,
  carouselGlowWeight,
  staticAuraLayers,
  HOME_AURA_SETTLE_MS,
  THREAD_AURA_SPAN,
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
    expect(detailsAuraOpacity(80)).toBeCloseTo(homeAuraRestingOpacity(80) * 1.05, 2);
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
      expect(homeAuraRestingOpacity(value)).toBe(0);
    }
    const p = threadAuraParameters(0, 'home');
    expect(Object.values(p).every(v => v === 0)).toBe(true);
  });
  it('calibrates resting opacity continuously, quieter at mid strength', () => {
    const [one, low, mid, high, full] = [1, 26, 49, 80, 100].map(homeAuraRestingOpacity);
    expect(one).toBeLessThan(0.05);
    expect(one).toBeGreaterThan(0);
    expect(low).toBeGreaterThan(one);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
    expect(full).toBeGreaterThan(high);
    expect(full).toBeCloseTo(0.847, 2);
    expect(mid).toBeLessThan(0.55);
    expect(HOME_AURA_SETTLE_MS).toBe(420);
    expect(THREAD_AURA_SPAN).toBeGreaterThan(1.5);
  });
});

describe('carousel glow weight', () => {
  it('is full when centred and absent one slot away', () => {
    expect(carouselGlowWeight(0)).toBe(1);
    expect(carouselGlowWeight(1)).toBe(0);
    expect(carouselGlowWeight(-1)).toBe(0);
    expect(carouselGlowWeight(2.5)).toBe(0);
  });
  it('is symmetric in direction, so a swipe either way behaves the same', () => {
    for (const d of [0.1, 0.25, 0.5, 0.8]) {
      expect(carouselGlowWeight(d)).toBeCloseTo(carouselGlowWeight(-d), 10);
    }
  });
  it('is half-strength at the midpoint between two Anchors and monotonic in between', () => {
    expect(carouselGlowWeight(0.5)).toBeCloseTo(0.5, 10);
    const samples = [0, 0.2, 0.4, 0.6, 0.8, 1].map(carouselGlowWeight);
    samples.forEach((value, i) => { if (i) expect(value).toBeLessThanOrEqual(samples[i - 1]); });
  });
  it('hands over continuously: outgoing and incoming weights sum to one across the swipe', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      // Outgoing centre at distance t, incoming neighbour at distance 1 - t.
      expect(carouselGlowWeight(t) + carouselGlowWeight(1 - t)).toBeCloseTo(1, 10);
    }
  });
  it('treats unknown distance as absent', () => {
    expect(carouselGlowWeight(NaN)).toBe(0);
  });
});

describe('static renderer layers', () => {
  it('keeps the rim thin at every strength (about half the old fallback thickness)', () => {
    for (const value of strengths) {
      expect(staticAuraLayers(value).ringWidth).toBeLessThanOrEqual(0.02);
    }
  });
  it('gives zero layers at zero or unknown strength', () => {
    for (const value of [0, null, NaN]) {
      const layers = staticAuraLayers(value);
      expect(Object.values(layers).every(v => v === 0)).toBe(true);
    }
  });
  it('grows reach and radiance with strength, but never the rim thickness beyond the cap', () => {
    const low = staticAuraLayers(20);
    const high = staticAuraLayers(100);
    expect(high.haloReach).toBeGreaterThan(low.haloReach);
    expect(high.haloRimOpacity).toBeGreaterThan(low.haloRimOpacity);
    expect(high.haloMidOpacity).toBeGreaterThan(low.haloMidOpacity);
    expect(high.ringOpacity).toBeGreaterThan(low.ringOpacity);
    expect(high.ringWidth).toBeGreaterThan(low.ringWidth);
    expect(high.ringWidth).toBeLessThanOrEqual(0.02);
  });
  it('keeps the halo alpha within a controlled range', () => {
    for (const value of strengths.slice(1)) {
      const layers = staticAuraLayers(value);
      expect(layers.haloRimOpacity).toBeLessThanOrEqual(1);
      expect(layers.haloRimOpacity).toBeGreaterThanOrEqual(layers.haloMidOpacity);
    }
  });
});
