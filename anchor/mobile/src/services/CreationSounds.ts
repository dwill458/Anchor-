import { SoundPool } from '@/services/audio/SoundPool';
import { CREATION_SOUND_SOURCES } from '@/services/audio/soundSources';

export type CreationSoundKey = keyof typeof CREATION_SOUND_SOURCES;

const VOLUME: Record<CreationSoundKey, number> = {
  seal: 0.9,
  practiceComplete: 0.7, // DEFERRED: uses sk-anchor-pulse until the final Phase 2 asset arrives.
  anchorPulse: 0.85,
  bloom: 0.55,
  uiTap: 1,
  formTick: 0.30,
  formSettle: 0.35,
  releaseBurn: 0.8,
  releaseIgnite: 0.8,
};

export interface CreationSoundHandle {
  stop: () => void;
}

/** Plays a kit sound once. Returns a handle to cut it short, or null when it did not start. */
export function playCreationSound(key: CreationSoundKey, volume: number = VOLUME[key]): CreationSoundHandle | null {
  // DEFERRED: per-call effect players are replaced by the shared pooled service.
  const handle = SoundPool.play(`creation:${key}`, { volume });
  return handle ? { stop: handle.stop } : null;
}
