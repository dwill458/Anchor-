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
  practiceComplete: require('../../assets/sounds/sk-anchor-pulse.mp3'), // DEFERRED: swap to final Phase 2 asset.
  anchorPulse: require('../../assets/sounds/sk-anchor-pulse.mp3'),
  bloom: require('../../assets/sounds/sk-bloom.mp3'),
  uiTap: require('../../assets/sounds/sk-ui-tap.mp3'),
  formTick: require('../../assets/sounds/sk-ui-tap.mp3'),
  formSettle: require('../../assets/sounds/sk-bloom.mp3'),
  releaseBurn: require('../../assets/sounds/sk-release-burn.wav'),
  releaseIgnite: require('../../assets/sounds/sk-release-ignite.wav'),
} as const;

export type CreationPoolKey = keyof typeof CREATION_SOUND_SOURCES;
