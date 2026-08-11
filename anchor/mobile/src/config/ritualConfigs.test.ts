import { getPracticeDeepPrimeConfig } from './ritualConfigs';

describe('Wave 2 Deep Priming configuration', () => {
  it.each([
    [120, [18, 24, 36, 30, 12]],
    [300, [45, 60, 90, 75, 30]],
    [600, [90, 120, 180, 150, 60]],
  ])('uses the locked five-phase allocation for %is', (duration, expected) => {
    const config = getPracticeDeepPrimeConfig(duration);
    expect(config.phases.map((phase) => phase.title)).toEqual(['Settle', 'Observe', 'Deepen', 'Hold', 'Return']);
    expect(config.phases.map((phase) => phase.durationSeconds)).toEqual(expected);
    expect(config.phases.reduce((sum, phase) => sum + phase.durationSeconds, 0)).toBe(duration);
  });

  it('uses Screen 12’s exact guidance timeline, including the quiet Hold state', () => {
    const config = getPracticeDeepPrimeConfig(120);
    expect(config.phases[0].guidanceTimeline).toEqual([
      { at: 0, text: 'Let your breathing slow.' },
      { at: 0.5, text: 'Allow your attention to arrive here.' },
    ]);
    expect(config.phases[1].guidanceTimeline).toEqual([
      { at: 0, text: 'Notice the Anchor without trying to interpret it.' },
      { at: 0.32, text: 'Let your eyes follow its form.' },
      { at: 0.62, text: 'Notice where your attention naturally returns.' },
      { at: 0.84, text: 'You don’t need to decode it. Let the form become familiar.', teaching: true },
    ]);
    expect(config.phases[3].guidanceTimeline).toEqual([
      { at: 0, text: 'Stay with the form.' },
      { at: 0.16, text: '' },
    ]);
  });

  it('allocates non-even rounding remainder to Deepen', () => {
    expect(getPracticeDeepPrimeConfig(121).phases.map((phase) => phase.durationSeconds)).toEqual([18, 24, 37, 30, 12]);
  });
});
