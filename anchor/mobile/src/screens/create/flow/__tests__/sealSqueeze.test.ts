import { CARD } from '../choosePager';
import {
  MEDALLION,
  SEAL_SEQUENCE_SECONDS,
  SEAL_SQUEEZE_RADIUS,
  SEAL_SQUEEZE_SCALE,
  SEAL_SQUEEZE_U,
  sealCard,
  sealPress,
} from '../sealMath';

describe('seal squeeze', () => {
  it('lasts 240 ms of the seal clock', () => {
    expect(SEAL_SQUEEZE_U * SEAL_SEQUENCE_SECONDS * 1000).toBeCloseTo(240, 6);
  });

  it('scales 1 -> .92 over the squeeze, easing in and out', () => {
    expect(sealPress(0)).toBe(1);
    expect(sealPress(SEAL_SQUEEZE_U)).toBeCloseTo(SEAL_SQUEEZE_SCALE, 6);
    // ease-in-out: slow at both ends, fastest in the middle
    const early = 1 - sealPress(SEAL_SQUEEZE_U * 0.1);
    const mid = sealPress(SEAL_SQUEEZE_U * 0.45) - sealPress(SEAL_SQUEEZE_U * 0.55);
    expect(early).toBeLessThan(0.002);
    expect(mid).toBeGreaterThan(early);
    for (let i = 1; i <= 10; i += 1) expect(sealPress((SEAL_SQUEEZE_U * i) / 10)).toBeLessThanOrEqual(sealPress((SEAL_SQUEEZE_U * (i - 1)) / 10));
  });

  it('rebounds past 1 and settles at 1', () => {
    expect(sealPress(0.3)).toBeCloseTo(1.015, 6);
    expect(sealPress(1)).toBe(1);
  });

  it('softens the corners to 120 px before the card contracts, then lands on the circle', () => {
    expect(sealCard(0).radius).toBe(CARD.radius);
    expect(sealCard(SEAL_SQUEEZE_U).radius).toBeCloseTo(SEAL_SQUEEZE_RADIUS, 6);
    // the contraction has not begun: the card is still full size while its corners soften
    expect(sealCard(SEAL_SQUEEZE_U).width).toBe(CARD.width);
    const radii = [0, 0.05, 0.1, SEAL_SQUEEZE_U].map((u) => sealCard(u).radius);
    radii.forEach((r, i) => i && expect(r).toBeGreaterThanOrEqual(radii[i - 1]));
    expect(sealCard(1).radius).toBeCloseTo(MEDALLION.size / 2, 6);
    expect(sealCard(1).width).toBe(MEDALLION.size);
  });
});
