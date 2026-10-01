import { deepFocusTimeline, deepFocusVisualAt, isDeepFocusDuration } from '../deepFocusTimeline';

describe('Deep Focus depth timeline', () => {
  it.each([120, 300, 600] as const)('holds the fixed phases and extends only immersion at %is', duration => {
    expect(deepFocusTimeline(duration).map(({ start, end }) => end - start)).toEqual([15, 20, 45, duration - 90, 10]);
    const deep = deepFocusVisualAt(80, duration, false);
    expect(deep.guidance).toBe(0);
    expect(deep.intention).toBe(0);
    expect(deep.orbitScale).toBeCloseTo(2.5);
    expect(deep.anchorOpacity).toBe(1);
    expect(deepFocusVisualAt(duration, duration, false).anchorOpacity).toBe(0);
    expect(deepFocusVisualAt(duration, duration, false).orbitOpacity).toBe(0);
    expect(deepFocusVisualAt(duration, duration, false).ambientGain).toBe(0);
  });
  it('removes spatial movement under reduced motion while preserving the phase fades', () => {
    for (let second = 0; second <= 600; second++) {
      const visual = deepFocusVisualAt(second, 600, true);
      expect(visual.anchorScale).toBe(1);
      expect(visual.orbitScale).toBe(1);
      expect(visual.orbitRotation).toBe(0);
    }
    expect(deepFocusVisualAt(80, 600, true).intention).toBe(0);
  });
  it.each([120, 300, 600] as const)('executes multi-step release hierarchy: environment fades first, anchor stands alone, then dissolves (%is)', duration => {
    // Step 1: Environment fades out completely by duration - 3.25s
    const beforeEnvFade = deepFocusVisualAt(duration - 6, duration, false);
    expect(beforeEnvFade.orbitOpacity).toBeGreaterThan(0);

    const envFaded = deepFocusVisualAt(duration - 3.25, duration, false);
    expect(envFaded.orbitOpacity).toBe(0);
    expect(envFaded.ambientGain).toBe(0);
    expect(envFaded.darkness).toBe(1);
    expect(envFaded.anchorOpacity).toBe(1);

    // Step 2: Anchor stands alone in darkness for ~1 second (duration - 3.25 to duration - 2.25)
    const anchorAlone = deepFocusVisualAt(duration - 2.5, duration, false);
    expect(anchorAlone.orbitOpacity).toBe(0);
    expect(anchorAlone.anchorOpacity).toBe(1);

    // Step 3 & 4: Anchor gently loses presence and dissolves to 0 at duration
    const dissolving = deepFocusVisualAt(duration - 1.125, duration, false);
    expect(dissolving.anchorOpacity).toBeGreaterThan(0);
    expect(dissolving.anchorOpacity).toBeLessThan(1);

    const completed = deepFocusVisualAt(duration, duration, false);
    expect(completed.anchorOpacity).toBe(0);
    expect(completed.orbitOpacity).toBe(0);
    expect(completed.ambientGain).toBe(0);
  });
  it('drastically reduces movement in immersion while keeping tiny organic life', () => {
    // Hold has full breathing swing (~0.012 amplitude)
    // breathTime in hold (e.g. 20s): evaluate peak-to-trough variation
    const holdV1 = deepFocusVisualAt(20, 600, false).anchorScale;
    const holdV2 = deepFocusVisualAt(24.5, 600, false).anchorScale; // ~quarter-half period
    const holdSwing = Math.abs(holdV1 - holdV2);

    // Immersion has drastically reduced breathing swing (amplitude reduced to 0.0025)
    const immV1 = deepFocusVisualAt(150, 600, false).anchorScale;
    const immV2 = deepFocusVisualAt(170, 600, false).anchorScale;
    const immSwing = Math.abs(immV1 - immV2);
    expect(immSwing).toBeLessThan(holdSwing * 0.35); // at least ~65% reduction
    expect(immSwing).toBeGreaterThan(0); // not frozen

    // Orbit velocity decelerates by ~90% (from 0.32 deg/s in hold to 0.032 deg/s in immersion)
    const holdVel = (deepFocusVisualAt(30, 600, false).orbitRotation - deepFocusVisualAt(29, 600, false).orbitRotation);
    const immVel = (deepFocusVisualAt(150, 600, false).orbitRotation - deepFocusVisualAt(149, 600, false).orbitRotation);
    expect(holdVel).toBeCloseTo(0.32, 2);
    expect(immVel).toBeCloseTo(0.032, 2);
    expect(immVel).toBeGreaterThan(0); // maintains tiny living drift
  });
  it('has continuous motion at every phase boundary and no breath resets', () => {
    for (const boundary of [15, 35, 80, 590]) {
      const before = deepFocusVisualAt(boundary - 0.001, 600, false);
      const after = deepFocusVisualAt(boundary + 0.001, 600, false);
      for (const key of Object.keys(before) as (keyof typeof before)[]) {
        expect(Math.abs(before[key] - after[key])).toBeLessThan(0.001);
      }
    }
  });
  it('rejects unsupported session durations', () => {
    expect(isDeepFocusDuration(900)).toBe(false);
    expect(isDeepFocusDuration(0)).toBe(false);
    expect(isDeepFocusDuration(300)).toBe(true);
  });
});
