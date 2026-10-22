export function shouldPlayDeepFocusCompletionCue({
  soundEnabled,
  hasFullMix,
  fullMixFinished,
}: {
  soundEnabled: boolean;
  hasFullMix: boolean;
  fullMixFinished: boolean;
}): boolean {
  return !soundEnabled || !hasFullMix || fullMixFinished;
}
