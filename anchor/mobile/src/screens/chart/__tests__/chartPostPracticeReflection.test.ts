import {
  chartPostPracticeOfferKey,
  chartPostPracticePrompt,
} from '../useChartPostPracticeReflection';

describe('Chart post-practice reflection handoff', () => {
  it.each([
    ['focus', 'HOW_DO_YOU_FEEL_NOW'],
    ['visualize', 'WHAT_STOOD_OUT'],
    ['deepPrime', 'WHAT_FELT_STRONGEST'],
  ] as const)('maps %s to its shared prompt', (mode, prompt) => {
    expect(chartPostPracticePrompt(mode)).toBe(prompt);
  });

  it('keys the one-time offer only by canonical practice session id', () => {
    expect(chartPostPracticeOfferKey('session-123')).toBe('post-practice:session-123');
    expect(chartPostPracticeOfferKey('session-123')).toBe(chartPostPracticeOfferKey('session-123'));
    expect(chartPostPracticeOfferKey('session-456')).not.toBe(chartPostPracticeOfferKey('session-123'));
  });
});
