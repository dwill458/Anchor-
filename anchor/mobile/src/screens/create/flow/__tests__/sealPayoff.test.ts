import { SEAL_PULSE_AT, sealHalo, sealPulse, sealSentenceAlpha } from '../sealMath';

describe('seal payoff', () => {
  it('pulses once, after the medallion has formed, and rests at 1', () => {
    expect(sealPulse(0)).toBe(1);
    expect(sealPulse(SEAL_PULSE_AT - 0.01)).toBe(1);
    expect(sealPulse(SEAL_PULSE_AT + 0.1)).toBeGreaterThan(1.04);
    expect(sealPulse(1)).toBeCloseTo(1, 6);
  });

  it('shows the sentence only once the pulse has begun, then holds it', () => {
    expect(sealSentenceAlpha(SEAL_PULSE_AT)).toBe(0);
    expect(sealSentenceAlpha(0.9)).toBeGreaterThan(0);
    expect(sealSentenceAlpha(1)).toBe(1);
  });

  it('sends a ring of light out with the pulse and no sooner', () => {
    expect(sealHalo(SEAL_PULSE_AT - 0.05).alpha).toBe(0);
    expect(sealHalo(SEAL_PULSE_AT + 0.1).alpha).toBeGreaterThan(0.2);
    expect(sealHalo(1).scale).toBeGreaterThan(1);
  });
});
