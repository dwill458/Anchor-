import { shouldPlayDeepFocusCompletionCue } from '../completionCue';

it('does not play over an audible full-mix ending', () => {
  expect(shouldPlayDeepFocusCompletionCue({ soundEnabled: true, hasFullMix: true, fullMixFinished: false })).toBe(false);
});

it('plays when the full mix has ended or sound is off', () => {
  expect(shouldPlayDeepFocusCompletionCue({ soundEnabled: true, hasFullMix: true, fullMixFinished: true })).toBe(true);
  expect(shouldPlayDeepFocusCompletionCue({ soundEnabled: false, hasFullMix: true, fullMixFinished: false })).toBe(true);
});

it('plays when the selected voice has no full-length mix', () => {
  expect(shouldPlayDeepFocusCompletionCue({ soundEnabled: true, hasFullMix: false, fullMixFinished: false })).toBe(true);
});
