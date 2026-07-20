import {
  buildVisualizationSchedule,
  getVisualizationPhaseAtElapsed,
  getVisualizationPhaseProgress,
} from '../visualizationSchedule';

describe('visualization schedule', () => {
  it.each([
    [60, [10, 17, 17, 10, 6]],
    [180, [29, 50, 50, 29, 22]],
    [300, [48, 84, 84, 48, 36]],
  ] as const)('allocates the exact %s-second phase schedule', (duration, expected) => {
    const schedule = buildVisualizationSchedule(duration);
    expect(schedule.map((phase) => phase.durationSeconds)).toEqual(expected);
    expect(schedule.at(-1)?.endSeconds).toBe(duration);
  });

  it('uses the same schedule for phase lookup and progress', () => {
    const schedule = buildVisualizationSchedule(60);
    expect(getVisualizationPhaseAtElapsed(schedule, 10).id).toBe('see');
    expect(getVisualizationPhaseProgress(schedule[1], 18.5)).toBeCloseTo(0.5);
  });
});
