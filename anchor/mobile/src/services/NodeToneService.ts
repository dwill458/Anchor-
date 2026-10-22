import { Platform } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';
import { SoundPool } from '@/services/audio/SoundPool';
import { sfxLog } from '@/services/audio/sfxLog';
import { nodeToneKey } from '@/utils/audio/nodeTone';

/** Quiet by design: the line is thinking out loud, not performing. */
const NODE_TONE_VOLUME = 0.32;

// Generated with scripts/build-node-tones.cjs from the original tone recipe. Static Metro assets
// use the same loading path as the working distill cues, with no runtime cache writes required.
const WAV_TONE_SOURCES: Record<number, number> = {
  0: require('../assets/sounds/node-tones/0_wav.wav'),
  2: require('../assets/sounds/node-tones/2_wav.wav'),
  4: require('../assets/sounds/node-tones/4_wav.wav'),
  7: require('../assets/sounds/node-tones/7_wav.wav'),
  9: require('../assets/sounds/node-tones/9_wav.wav'),
  12: require('../assets/sounds/node-tones/12_wav.wav'),
  14: require('../assets/sounds/node-tones/14_wav.wav'),
  16: require('../assets/sounds/node-tones/16_wav.wav'),
  19: require('../assets/sounds/node-tones/19_wav.wav'),
  21: require('../assets/sounds/node-tones/21_wav.wav'),
};
// Samsung/Android can lose the attacks of these short PCM WAVs while reporting successful
// playback. The compressed decoder path was verified on the creation route with all nine cues.
// Keep the original WAVs on iOS; both tables come from exactly the same synthesized waveforms.
const TONE_SOURCES: Record<number, number> = Platform.OS === 'android' ? {
  0: require('../assets/sounds/node-tones/0.mp3'),
  2: require('../assets/sounds/node-tones/2.mp3'),
  4: require('../assets/sounds/node-tones/4.mp3'),
  7: require('../assets/sounds/node-tones/7.mp3'),
  9: require('../assets/sounds/node-tones/9.mp3'),
  12: require('../assets/sounds/node-tones/12.mp3'),
  14: require('../assets/sounds/node-tones/14.mp3'),
  16: require('../assets/sounds/node-tones/16.mp3'),
  19: require('../assets/sounds/node-tones/19.mp3'),
  21: require('../assets/sounds/node-tones/21.mp3'),
} : WAV_TONE_SOURCES;
const TONE_KEYS = Object.keys(TONE_SOURCES).map((note) => `node:${note}`);

/** One droplet per grid node, with the original cell-to-pitch mapping and settings gate. */
export const NodeToneService = {
  async prepare(_cells?: number[]): Promise<void> {
    if (!useSettingsStore.getState().soundEffectsEnabled) return;
    for (const [note, source] of Object.entries(TONE_SOURCES)) {
      SoundPool.register(`node:${note}`, source);
    }
    SoundPool.prewarm(TONE_KEYS);
  },

  release(): void {
    SoundPool.releaseIdle(TONE_KEYS);
  },

  play(cell: number): void {
    if (!useSettingsStore.getState().soundEffectsEnabled) return;
    const note = nodeToneKey(cell);
    const source = TONE_SOURCES[note];
    if (source === undefined) return;
    const key = `node:${note}`;
    // Register here too so a fast entry or re-enabled effects setting never misses preparation.
    SoundPool.register(key, source);
    const handle = SoundPool.play(key, { volume: NODE_TONE_VOLUME });
    sfxLog(`mappingTone cell=${cell} note=${note} source=${Platform.OS === 'android' ? 'bundled-mp3' : 'bundled-wav'} result=${handle ? 'requested' : 'dropped'}`);
  },
};
