import { useSettingsStore } from '@/stores/settingsStore';

/**
 * One-shot sounds for the creation flow (Sound Kit v1). `expo-audio` is required lazily and every
 * call is wrapped, so a missing native module or a silent device never interrupts creation.
 *
 * Levels: the kit is peak-normalised and `ui_tap` is 6 dB under the rest by design, so taps play at
 * full volume here (the kit's own note: only turn it up if it is inaudible on device speakers).
 */
const SOURCES = {
  seal: () => require('../assets/sounds/sk-seal.mp3'),
  anchorPulse: () => require('../assets/sounds/sk-anchor-pulse.mp3'),
  bloom: () => require('../assets/sounds/sk-bloom.mp3'),
  uiTap: () => require('../assets/sounds/sk-ui-tap.mp3'),
  // Placeholder voices; replace these paths with sk-form-tick / sk-form-settle when delivered.
  formTick: () => require('../assets/sounds/sk-ui-tap.mp3'),
  formSettle: () => require('../assets/sounds/sk-bloom.mp3'),
  // Release burn (scripts/generate-release-sounds.mjs): ends in exact silence at the coin's disappearance.
  releaseBurn: () => require('../assets/sounds/sk-release-burn.wav'),
  releaseIgnite: () => require('../assets/sounds/sk-release-ignite.wav'),
} as const;

export type CreationSoundKey = keyof typeof SOURCES;

const VOLUME: Record<CreationSoundKey, number> = {
  seal: 0.9,
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
  if (!useSettingsStore.getState().soundEffectsEnabled) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
    const player = createAudioPlayer(SOURCES[key](), { updateInterval: 250 });
    player.volume = volume;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      try {
        subscription.remove();
        player.pause();
        player.remove();
      } catch {
        // Already released.
      }
    };
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) release();
    });
    player.play();
    return { stop: release };
  } catch {
    return null;
  }
}
