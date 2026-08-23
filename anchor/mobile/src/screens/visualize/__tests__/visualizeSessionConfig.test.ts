import {
  VISUALIZE_SESSION_CONFIGS,
  getVisualizePromptAtElapsed,
} from '../visualizeSessionConfig';

describe('visualizeSessionConfig', () => {
  it.each([
    [60, [10, 17, 17, 10, 6], [2, 3, 3, 2, 1]],
    [180, [29, 50, 50, 29, 22], [5, 6, 6, 4, 4]],
    [300, [48, 84, 84, 48, 36], [7, 9, 9, 5, 5]],
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

  it('retrieves prompts accurately within each phase', () => {
    const config = VISUALIZE_SESSION_CONFIGS[60];
    expect(getVisualizePromptAtElapsed(config, 0)?.text).toBe('Let your attention settle on your anchor.');
    expect(getVisualizePromptAtElapsed(config, 10_000)?.text).toBe('Bring your scene to mind.');
  });
});
