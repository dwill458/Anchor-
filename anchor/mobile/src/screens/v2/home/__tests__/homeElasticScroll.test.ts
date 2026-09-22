import { ELASTIC, rubberBand } from '../homeElasticScroll';

describe('Home elastic overscroll curve', () => {
  it('does not move for no pull and never exceeds its limit', () => {
    expect(rubberBand(0)).toBe(0);
    expect(rubberBand(-40)).toBe(0);
    expect(rubberBand(100000)).toBeLessThan(ELASTIC.limit);
  });

  it('resists harder the further it is pulled', () => {
    const first = rubberBand(50);
    const second = rubberBand(100) - rubberBand(50);
    const third = rubberBand(150) - rubberBand(100);
    expect(first).toBeGreaterThan(second);
    expect(second).toBeGreaterThan(third);
    // A deliberate 160dp pull reads as a small displacement, not a trampoline.
    expect(rubberBand(160)).toBeLessThan(60);
  });

  it('returns on a spring with no visible overshoot (damping ratio near 1)', () => {
    const { stiffness, damping, mass } = ELASTIC.spring;
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    expect(zeta).toBeGreaterThan(0.9);
    expect(zeta).toBeLessThanOrEqual(1.05);
  });
});
