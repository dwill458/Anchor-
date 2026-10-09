import { SoundPool } from '@/services/audio/SoundPool';
import { CREATION_SOUND_SOURCES, type SoundKey } from '@/services/audio/soundSources';
import { sfxLog } from '@/services/audio/sfxLog';

export type CreationSoundKey = keyof typeof CREATION_SOUND_SOURCES;

export const VOLUME: Record<CreationSoundKey | SoundKey, number> = {
  seal: 0.9,
  practiceComplete: 0.6,
  anchorPulse: 0.85,
  bloom: 0.55,
  uiTap: 1,
  distillTick: 0.5,
  sealRise: 0.6,
  revealSettle: 0.55,
  formTick: 0.30,
  formSettle: 0.35,
  releaseFall: 0.55,
  releaseResolve: 0.6,
  paywallSuccess: 0.6,
  releaseBurn: 0.8,
  releaseIgnite: 0.8,
  formBed: 0.12,
  threadSettle: 0.5,
  threadWake: 0.6,
  threadStageChord_building: 0.6,
  threadStageChord_established: 0.6,
  threadStageChord_integrated: 0.6,
  threadReinforcedLow: 0.9,
  threadFullStrengthChord: 0.9,
  threadReinforce: 0.6,
  threadStageRelight: 0.42,
  // Reserved for a possible Full Strength lead-in; not wired without listening QA.
  threadFullStrengthWake: 0.45,
  onboardingSealed: 0.6,
  homeArrival: 0.5,
  visionPin: 0.45,
  'forge-seal': 1,
  'letter-drop': 1,
  'prime-begin': 1,
  'prime-complete': 1,
  'haptic-tone': 1,
  'ui-select': 1,
  'chart-air': 0.9,
  'chart-open': 1,
  'chart-ink': 1,
  'chart-flag': 1,
  'chart-check': 1,
  'chart-stamp': 1,
  'chart-wind': 1,
  'chart-waypoint_1': 0.6,
  'chart-waypoint_2': 0.6,
  'chart-waypoint_3': 0.6,
  'chart-move-done': 0.6,
  'chart-ink-hold': 0.6,
  'chart-summit-thud': 0.99,
  'chart-summit-chord': 0.9,
};

export interface CreationSoundHandle {
  stop: (fadeOutMs?: number) => void;
}

/** Plays a kit sound once. Returns a handle to cut it short, or null when it did not start. */
export function playCreationSound(key: CreationSoundKey, volume: number = VOLUME[key], options: { loop?: boolean; fadeInMs?: number } = {}): CreationSoundHandle | null {
  // DEFERRED: per-call effect players are replaced by the shared pooled service.
  sfxLog(`creationSound key=${key} volume=${volume} loop=${options.loop ?? false}`);
  const handle = SoundPool.play(`creation:${key}`, { volume, loop: options.loop, fadeInMs: options.fadeInMs });
  return handle ? { stop: handle.stop } : null;
}
