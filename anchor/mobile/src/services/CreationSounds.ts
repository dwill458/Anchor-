import { SoundPool } from '@/services/audio/SoundPool';
import { CREATION_SOUND_SOURCES } from '@/services/audio/soundSources';

export type CreationSoundKey = keyof typeof CREATION_SOUND_SOURCES;

const VOLUME: Record<CreationSoundKey, number> = {
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
  onboardingSealed: 0.6,
  homeArrival: 0.5,
  visionPin: 0.45,
};

export interface CreationSoundHandle {
  stop: (fadeOutMs?: number) => void;
}

/** Plays a kit sound once. Returns a handle to cut it short, or null when it did not start. */
export function playCreationSound(key: CreationSoundKey, volume: number = VOLUME[key], options: { loop?: boolean } = {}): CreationSoundHandle | null {
  // DEFERRED: per-call effect players are replaced by the shared pooled service.
  const handle = SoundPool.play(`creation:${key}`, { volume, loop: options.loop });
  return handle ? { stop: handle.stop } : null;
}
