import {
  buildVisualizationSchedule,
  getVisualizationPhaseAtElapsed,
  getVisualizationPhaseProgress,
} from '../visualizationSchedule';

describe('visualization schedule', () => {
  it.each([
    [60, [10, 14, 18, 11, 7]],
    [180, [29, 43, 54, 32, 22]],
    [300, [48, 72, 90, 54, 36]],
  ] as const)('allocates the exact %s-second phase schedule', (duration, expected) => {
    const schedule = buildVisualizationSchedule(duration);
    expect(schedule.map((phase) => phase.durationSeconds)).toEqual(expected);
    expect(schedule.at(-1)?.endSeconds).toBe(duration);
  });

  it('uses the same schedule for phase lookup and progress', () => {
    const schedule = buildVisualizationSchedule(60);
    expect(getVisualizationPhaseAtElapsed(schedule, 9.9).id).toBe('arrive');
    expect(getVisualizationPhaseAtElapsed(schedule, 10).id).toBe('build');
    expect(getVisualizationPhaseProgress(schedule[1], 17)).toBeCloseTo(0.5);
  });
});
