import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AnalyticsService } from '@/services/AnalyticsService';
import {
  lookupVoicePreviewTrack,
  SESSION_AUDIO_LOCALE,
} from '@/services/SessionAudioManifest';
import type { GuidanceVoice } from '@/types/sessionAudio';

type PreviewVoice = Exclude<GuidanceVoice, 'none'>;
type Listener = (voice: PreviewVoice | null) => void;

let activePlayer: AudioPlayer | null = null;
let activeSubscription: { remove: () => void } | null = null;
let activeVoice: PreviewVoice | null = null;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((listener) => listener(activeVoice));

export const stopVoicePreview = (): void => {
  try {
    activeSubscription?.remove();
  } catch {
    // Preview cleanup is best effort.
  }
  try {
    activePlayer?.pause();
    activePlayer?.remove();
  } catch {
    // Preview cleanup is best effort.
  }
  activeSubscription = null;
  activePlayer = null;
  activeVoice = null;
  emit();
};

export const startVoicePreview = async (
  voice: PreviewVoice,
  locale: string = SESSION_AUDIO_LOCALE
): Promise<boolean> => {
  stopVoicePreview();
  const track = lookupVoicePreviewTrack(voice, locale);
  if (!track) {
    AnalyticsService.track('voice_preview_failed', {
      guidance_voice: voice,
      locale,
      voice_available: false,
    });
    return false;
  }

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });
    const player = createAudioPlayer(track.asset, {
      updateInterval: 100,
      keepAudioSessionActive: true,
    });
    activePlayer = player;
    player.volume = track.playbackGain;
    activeVoice = voice;
    activeSubscription = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish) return;
      AnalyticsService.track('voice_preview_completed', {
        guidance_voice: voice,
        locale,
        voice_available: true,
      });
      stopVoicePreview();
    });
    AnalyticsService.track('voice_preview_started', {
      guidance_voice: voice,
      locale,
      voice_available: true,
    });
    player.play();
    emit();
    return true;
  } catch {
    stopVoicePreview();
    AnalyticsService.track('voice_preview_failed', {
      guidance_voice: voice,
      locale,
      voice_available: true,
    });
    return false;
  }
};

export const subscribeToVoicePreview = (listener: Listener): (() => void) => {
  listeners.add(listener);
  listener(activeVoice);
  return () => listeners.delete(listener);
};

export const getActivePreviewVoice = (): PreviewVoice | null => activeVoice;
