import {
  getDeepBreathCue,
  getDeepBreathCycleProgress,
  getDeepBreathTiming,
} from '../deepBreath';

describe('deepBreath timing helpers', () => {
  it('returns the expected cue sequence for breathwork', () => {
    expect(getDeepBreathCue('Breathwork', 0)).toBe('Breathe in');
    expect(getDeepBreathCue('Breathwork', 4)).toBe('Hold');
    expect(getDeepBreathCue('Breathwork', 6)).toBe('Breathe out');
    expect(getDeepBreathCue('Breathwork', 10)).toBe('Breathe out');
    expect(getDeepBreathCue('Breathwork', 12)).toBe('Breathe in');
  });

  it('calculates normalized cycle progress from phase elapsed time', () => {
    expect(getDeepBreathCycleProgress('Breathwork', 0)).toBe(0);
    expect(getDeepBreathCycleProgress('Breathwork', 6)).toBeCloseTo(0.5);
    expect(getDeepBreathCycleProgress('Breathwork', 12)).toBe(0);
  });

  it('builds hold-aware timing markers for phases that include a hold', () => {
    expect(getDeepBreathTiming('Transfer')).toMatchObject({
      cycleSeconds: 10,
      inhaleEnd: 0.4,
      holdEnd: 0.6,
      hasHold: true,
    });
  });

  it('falls back to the default deep breath pattern for unknown phases', () => {
    expect(getDeepBreathTiming('Unknown')).toMatchObject({
      cycleSeconds: 10,
      inhale: 4,
      hold: 0,
      exhale: 6,
      hasHold: false,
    });
    expect(getDeepBreathCue('Unknown', 6)).toBe('Breathe out');
  });
});
