import { deepFocusFieldEnergy, deepFocusTimeline, deepFocusVisualAt, isDeepFocusDuration, DEEP_FOCUS_FIELD_PEAK_SCALE, DEEP_FOCUS_FIELD_REST_SCALE } from '../deepFocusTimeline';

const DURATIONS = [120, 300, 600] as const;
const REST = DEEP_FOCUS_FIELD_REST_SCALE;
const PEAK = DEEP_FOCUS_FIELD_PEAK_SCALE;

/** Samples every 0.1 active seconds across a session. */
function sample(duration: number, reduced = false) {
  return Array.from({ length: duration * 10 + 1 }, (_, i) => ({ t: i / 10, v: deepFocusVisualAt(i / 10, duration as 120, reduced) }));
}

describe('Deep Focus copy timeline', () => {
  it.each(DURATIONS)('keeps the copy phases fixed and extends only immersion at %is', duration => {
    expect(deepFocusTimeline(duration).map(({ start, end }) => end - start)).toEqual([15, 20, 45, duration - 90, 10]);
  });
  it('rejects unsupported session durations', () => {
    expect(isDeepFocusDuration(900)).toBe(false);
    expect(isDeepFocusDuration(0)).toBe(false);
    expect(isDeepFocusDuration(300)).toBe(true);
  });
});

describe('Deep Focus field motion', () => {
  it.each(DURATIONS)('runs one outward-and-inward arc on normalized progress at %is', duration => {
    const energy = (p: number) => deepFocusFieldEnergy(p);
    expect(energy(0)).toBeCloseTo(0);
    expect(energy(0.5)).toBeCloseTo(1);
    expect(energy(1)).toBeCloseTo(0);
    // Expansion from 0 to 50%, contraction from 50 to 100%.
    const frames = sample(duration);
    const at = (p: number) => frames[Math.round(p * duration * 10)].v;
    expect(at(0.15).orbitScale).toBeGreaterThan(at(0).orbitScale);
    expect(at(0.5).orbitScale).toBeCloseTo(PEAK, 5);
    expect(at(0.85).orbitScale).toBeLessThan(at(0.5).orbitScale);
    // The inward settle ends near rest, so the final contraction aligns with completion.
    expect(at(0.975).orbitScale).toBeLessThan(REST + 0.02);
    for (let i = 1; i < frames.length; i++) {
      const p = frames[i].t / duration;
      if (p <= 0.5) expect(frames[i].v.orbitScale).toBeGreaterThanOrEqual(frames[i - 1].v.orbitScale - 1e-9);
      else expect(frames[i].v.orbitScale).toBeLessThanOrEqual(frames[i - 1].v.orbitScale + 1e-9);
    }
  });

  it.each(DURATIONS)('keeps the lines turning at every instant, so the field never freezes (%is)', duration => {
    const frames = sample(duration);
    for (let i = 1; i < frames.length; i++) {
      const dt = frames[i].t - frames[i - 1].t;
      const speed = (frames[i].v.orbitRotation - frames[i - 1].v.orbitRotation) / dt;
      expect(speed).toBeGreaterThan(0);
    }
  });

  it.each(DURATIONS)('has no discontinuity at any sampled instant, including the old 45-second point (%is)', duration => {
    const frames = sample(duration);
    const keys = ['orbitScale', 'orbitRotation', 'weaveRotation', 'orbitOpacity', 'darkness'] as const;
    for (let i = 1; i < frames.length; i++) {
      for (const key of keys) {
        // Per-0.1s step stays small everywhere, so no jump or restart is visible.
        expect(Math.abs(frames[i].v[key] - frames[i - 1].v[key])).toBeLessThan(key === 'orbitRotation' ? 1 : 0.04);
      }
    }
    const around45 = deepFocusVisualAt(45, duration as 120, false);
    const before45 = deepFocusVisualAt(44.999, duration as 120, false);
    expect(Math.abs(around45.orbitScale - before45.orbitScale)).toBeLessThan(0.001);
    expect(around45.orbitRotation - before45.orbitRotation).toBeGreaterThan(0);
  });

  it.each(DURATIONS)('scales the same arc across durations, so only its length changes (%is)', duration => {
    const at = (p: number) => deepFocusVisualAt(p * duration, duration, false);
    for (const p of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(at(p).orbitScale).toBeCloseTo(REST + (PEAK - REST) * deepFocusFieldEnergy(p), 5);
    }
  });

  it('keeps the Anchor breath gentle and constant through the middle of every session', () => {
    const early = deepFocusVisualAt(20, 600, false).anchorScale;
    const early2 = deepFocusVisualAt(24.5, 600, false).anchorScale;
    const middle = deepFocusVisualAt(300, 600, false).anchorScale;
    const middle2 = deepFocusVisualAt(304.5, 600, false).anchorScale;
    expect(Math.abs(early - early2)).toBeGreaterThan(0);
    expect(Math.abs(middle - middle2)).toBeLessThan(0.012 * 2);
    expect(Math.abs(middle - middle2)).toBeGreaterThan(0);
  });

  it('removes spatial movement under reduced motion while keeping the gentle opacity arc', () => {
    for (const { v } of sample(600, true)) {
      expect(v.anchorScale).toBe(1);
      expect(v.orbitScale).toBe(1);
      expect(v.orbitRotation).toBe(0);
      expect(v.weaveRotation).toBe(0);
      expect(v.weaveScale).toBe(1);
    }
    expect(deepFocusVisualAt(80, 600, true).intention).toBe(0);
    expect(deepFocusVisualAt(300, 600, true).orbitOpacity).toBeGreaterThan(0);
  });

  it('counter-rotates the inner layer against the field for depth', () => {
    const late = deepFocusVisualAt(480, 600, false);
    expect(late.weaveRotation).toBeLessThan(0);
    expect(late.orbitRotation).toBeGreaterThan(0);
  });

  it.each(DURATIONS)('completes with a handoff: field and Anchor dissolve only in the final seconds (%is)', duration => {
    const beforeFinal = deepFocusVisualAt(duration - 4, duration, false);
    expect(beforeFinal.orbitOpacity).toBeGreaterThan(0);
    expect(beforeFinal.anchorOpacity).toBe(1);
    const fadingField = deepFocusVisualAt(duration - 1.5, duration, false);
    expect(fadingField.orbitOpacity).toBeGreaterThan(0);
    expect(fadingField.orbitOpacity).toBeLessThan(beforeFinal.orbitOpacity);
    expect(fadingField.anchorOpacity).toBeLessThan(1);
    expect(deepFocusVisualAt(duration - 3, duration, false).anchorOpacity).toBe(1);
    const fieldGone = deepFocusVisualAt(duration, duration, false);
    expect(fieldGone.orbitOpacity).toBe(0);
    const completed = deepFocusVisualAt(duration, duration, false);
    expect(completed.anchorOpacity).toBe(0);
    expect(completed.orbitOpacity).toBe(0);
    expect(completed.darkness).toBe(1);
    expect(completed.ambientGain).toBe(0);
  });

  it('keeps the established ambient bed timing unchanged', () => {
    expect(deepFocusVisualAt(80, 600, false).ambientGain).toBeCloseTo(0.07);
    expect(deepFocusVisualAt(0, 600, false).ambientGain).toBe(0);
  });
});
