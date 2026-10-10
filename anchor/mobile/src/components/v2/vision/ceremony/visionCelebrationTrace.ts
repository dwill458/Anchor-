/** Hardware delivery cannot be inferred from a native haptic request. Keep that distinction in QA logs. */
export function visionCelebrationTrace(trigger: string, level: number | 'Medium' = 0, hapticRequested = false, soundPlayed = false, detail?: object) {
  if (__DEV__ && !process.env.JEST_WORKER_ID) {
    console.log('[celebration]', { trigger, level, hapticRequested, hapticPlayed: hapticRequested ? 'device-verification-required' : false, soundPlayed, ...detail });
  }
}
