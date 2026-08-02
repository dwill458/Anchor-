import {
  buildVisualizationSchedule,
  getVisualizationPhaseAtElapsed,
  getVisualizationPhaseProgress,
} from '../visualizationSchedule';

describe('visualization schedule', () => {
  it.each([
    [60, [12, 11, 11, 16, 10]],
    [180, [35, 30, 30, 55, 30]],
    [300, [55, 50, 50, 95, 50]],
  ] as const)('allocates the exact %s-second phase schedule', (duration, expected) => {
    const schedule = buildVisualizationSchedule(duration);
    expect(schedule.map((phase) => phase.durationSeconds)).toEqual(expected);
    expect(schedule.at(-1)?.endSeconds).toBe(duration);
  });

  it('uses the same schedule for phase lookup and progress', () => {
    const schedule = buildVisualizationSchedule(60);
    expect(getVisualizationPhaseAtElapsed(schedule, 11.9).id).toBe('see');
    expect(getVisualizationPhaseAtElapsed(schedule, 12).id).toBe('feel');
    expect(getVisualizationPhaseProgress(schedule[1], 17.5)).toBeCloseTo(0.5);
  });
});
