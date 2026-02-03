import { Audio } from 'expo-av';
import { useSettingsStore } from '@/stores/settingsStore';

type SoundEffectKey = 'chargeStart' | 'activation' | 'completion';

const SOUND_ASSETS: Record<SoundEffectKey, number> = {
  chargeStart: require('../../assets/sfx/charge-start.wav'),
  activation: require('../../assets/sfx/activation.wav'),
  completion: require('../../assets/sfx/completion.wav'),
};

const soundCache: Partial<Record<SoundEffectKey, Audio.Sound>> = {};
let audioModeReady = false;

const ensureAudioMode = async () => {
  if (audioModeReady) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DUCK_OTHERS,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
      shouldDuckAndroid: true,
    });
    audioModeReady = true;
  } catch {
    audioModeReady = false;
  }
};

const loadSound = async (key: SoundEffectKey): Promise<Audio.Sound | null> => {
  if (soundCache[key]) return soundCache[key] ?? null;

  try {
    const { sound } = await Audio.Sound.createAsync(SOUND_ASSETS[key], {
      shouldPlay: false,
      isLooping: false,
      volume: 0.9,
    });
    soundCache[key] = sound;
    return sound;
  } catch {
    return null;
  }
};

export const playSoundEffect = async (key: SoundEffectKey): Promise<void> => {
  if (!useSettingsStore.getState().soundEffectsEnabled) return;

  await ensureAudioMode();
  const sound = await loadSound(key);
  if (!sound) return;

  try {
    await sound.replayAsync();
  } catch {
    // Silently fail to avoid crashes during audio playback
  }
};

export const unloadSoundEffects = async (): Promise<void> => {
  const unloads = Object.values(soundCache).map((sound) =>
    sound ? sound.unloadAsync().catch(() => {}) : Promise.resolve()
  );
  await Promise.all(unloads);
};
