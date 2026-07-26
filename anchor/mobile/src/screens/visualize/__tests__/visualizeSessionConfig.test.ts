import {
  VISUALIZE_SESSION_CONFIGS,
  getVisualizePromptAtElapsed,
} from '../visualizeSessionConfig';

describe('visualizeSessionConfig', () => {
  it.each([
    [60, [12, 11, 11, 16, 10], [1, 1, 1, 1, 1]],
    [180, [35, 30, 30, 55, 30], [2, 2, 2, 3, 2]],
    [300, [55, 50, 50, 95, 50], [3, 3, 3, 4, 3]],
  ] as const)('keeps the %s-second session exact and spacious', (duration, phaseDurations, promptCounts) => {
    const config = VISUALIZE_SESSION_CONFIGS[duration];
    expect(config.phases.map((phase) => phase.durationMs / 1_000)).toEqual(phaseDurations);
    expect(config.phases.map((phase) => phase.prompts.length)).toEqual(promptCounts);
    expect(config.phases.reduce((sum, phase) => sum + phase.durationMs, 0)).toBe(
      config.totalDurationMs,
    );

    let phaseStartMs = 0;
    config.phases.forEach((phase) => {
      phase.prompts.forEach((prompt) => {
        expect(prompt.startMs).toBeGreaterThanOrEqual(phaseStartMs);
        expect(prompt.startMs).toBeLessThan(phaseStartMs + phase.durationMs);
      });
      phaseStartMs += phase.durationMs;
    });
  });

  it('does not carry the previous phase prompt across a phase boundary', () => {
    const config = VISUALIZE_SESSION_CONFIGS[60];
    expect(getVisualizePromptAtElapsed(config, 11_999)?.id).toBe('visualize-60-see-1');
    expect(getVisualizePromptAtElapsed(config, 12_000)).toBeNull();
    expect(getVisualizePromptAtElapsed(config, 13_500)?.id).toBe('visualize-60-feel-1');
  });
});
