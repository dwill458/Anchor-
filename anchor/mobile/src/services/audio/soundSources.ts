/** Static short-effect assets shared by the one-shot pool and legacy useAudio API. */
export const SOUND_FILES = {
  // DEFERRED: legacy one-shot retained until the Phase 2 replacement ships.
  'forge-seal': require('../../assets/sounds/forge-seal.wav'),
  // DEFERRED: legacy one-shot retained until the Phase 2 replacement ships.
  'letter-drop': require('../../assets/sounds/letter-drop.wav'),
  'prime-begin': require('../../assets/sounds/prime-begin.wav'),
  'prime-complete': require('../../assets/sounds/prime-complete.wav'),
  // DEFERRED: legacy Seal-hold loop retained until its Phase 2 replacement ships.
  'haptic-tone': require('../../assets/sounds/haptic-tone.wav'),
  'ui-select': require('../../assets/sounds/ui-select.wav'),
  'chart-air': require('../../assets/sounds/chart-air.mp3'),
  'chart-open': require('../../assets/sounds/chart-open.mp3'),
  'chart-ink': require('../../assets/sounds/chart-ink.mp3'),
  'chart-flag': require('../../assets/sounds/chart-flag.mp3'),
  'chart-check': require('../../assets/sounds/chart-check.mp3'),
  'chart-stamp': require('../../assets/sounds/chart-stamp.mp3'),
  'chart-wind': require('../../assets/sounds/chart-wind.mp3'),
} as const;

export type SoundKey = keyof typeof SOUND_FILES;

export const CREATION_SOUND_SOURCES = {
  seal: require('../../assets/sounds/sk-seal.mp3'),
  practiceComplete: require('../../assets/sounds/sk-practice-complete.wav'),
  anchorPulse: require('../../assets/sounds/sk-anchor-pulse.mp3'),
  bloom: require('../../assets/sounds/sk-bloom.mp3'),
  uiTap: require('../../assets/sounds/sk-ui-tap.mp3'),
  distillTick: require('../../assets/sounds/sk-distill-tick.wav'),
  sealRise: require('../../assets/sounds/sk-seal-rise.wav'),
  revealSettle: require('../../assets/sounds/sk-reveal-settle.wav'),
  formTick: require('../../assets/sounds/sk-form-tick.wav'),
  formSettle: require('../../assets/sounds/sk-form-settle.wav'),
  releaseFall: require('../../assets/sounds/sk-release-fall.wav'),
  releaseResolve: require('../../assets/sounds/sk-release-resolve.wav'),
  paywallSuccess: require('../../assets/sounds/sk-paywall-success.wav'),
  releaseBurn: require('../../assets/sounds/sk-release-burn.wav'),
  releaseIgnite: require('../../assets/sounds/sk-release-ignite.wav'),
  formBed: require('../../assets/sounds/sk-form-bed.wav'),
  threadSettle: require('../../assets/sounds/sk-thread-settle.wav'),
  onboardingSealed: require('../../assets/sounds/sk-onboarding-sealed.wav'),
  homeArrival: require('../../assets/sounds/sk-home-arrival.wav'),
  visionPin: require('../../assets/sounds/sk-vision-pin.wav'),
} as const;

export type CreationPoolKey = keyof typeof CREATION_SOUND_SOURCES;
