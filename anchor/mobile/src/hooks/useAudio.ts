import { useCallback, useEffect, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useSettingsStore } from '@/stores/settingsStore';

const SOUND_FILES = {
  'forge-seal': require('../assets/sounds/forge-seal.wav'),
  'focus-session-ambient': require('../assets/sounds/focus-session-ambient.mp3'),
  'focus-session-10s': require('../assets/sounds/focus-session-10s.mp3'),
  'focus-session-120s-closing': require('../assets/sounds/focus-session-120s-closing.mp3'),
  'focus-session-120s-deepening': require('../assets/sounds/focus-session-120s-deepening.mp3'),
  'focus-session-120s-grounding': require('../assets/sounds/focus-session-120s-grounding.mp3'),
  'focus-session-120s-opening': require('../assets/sounds/focus-session-120s-opening.mp3'),
  'focus-session-30s-end': require('../assets/sounds/focus-session-30s-end.mp3'),
  'focus-session-30s-start': require('../assets/sounds/focus-session-30s-start.mp3'),
  'focus-session-60s-end': require('../assets/sounds/focus-session-60s-end.mp3'),
  'focus-session-60s-middle': require('../assets/sounds/focus-session-60s-middle.mp3'),
  'focus-session-60s-start': require('../assets/sounds/focus-session-60s-start.mp3'),
  'letter-drop': require('../assets/sounds/letter-drop.wav'),
  'prime-begin': require('../assets/sounds/prime-begin.wav'),
  'prime-complete': require('../assets/sounds/prime-complete.wav'),
  'haptic-tone': require('../assets/sounds/haptic-tone.wav'),
  'ui-select': require('../assets/sounds/ui-select.wav'),
} as const;

type SoundKey = keyof typeof SOUND_FILES;
type ManagedAudioPlayerOptions = {
  loop?: boolean;
  onFinish?: () => void;
  volume?: number;
};

export type ManagedAudioPlayer = {
  pause: () => void;
  play: () => void;
  setVolume: (volume: number) => void;
  stop: () => void;
};

export function useAudio() {
  const soundEffectsEnabled = useSettingsStore((state) => state.soundEffectsEnabled);
  const activePlayersRef = useRef<Set<AudioPlayer>>(new Set());

  const cleanupPlayer = useCallback((player: AudioPlayer, subscription?: { remove: () => void }) => {
    try {
      subscription?.remove();
    } catch {
      // Fail silently - audio is non-critical.
    }

    try {
      player.pause();
    } catch {
      // Fail silently - audio is non-critical.
    }

    try {
      player.remove();
    } catch {
      // Fail silently - audio is non-critical.
    }

    activePlayersRef.current.delete(player);
  }, []);

  const cleanupAllPlayers = useCallback(() => {
    activePlayersRef.current.forEach((player) => {
      cleanupPlayer(player);
    });
    activePlayersRef.current.clear();
  }, [cleanupPlayer]);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {
      // Fail silently - audio is non-critical.
    });

    return cleanupAllPlayers;
  }, [cleanupAllPlayers]);

  useEffect(() => {
    if (!soundEffectsEnabled) {
      cleanupAllPlayers();
    }
  }, [cleanupAllPlayers, soundEffectsEnabled]);

  const createManagedPlayer = useCallback(
    (
      key: SoundKey,
      { loop = false, onFinish, volume = 1 }: ManagedAudioPlayerOptions = {}
    ): ManagedAudioPlayer | null => {
      if (!soundEffectsEnabled) {
        return null;
      }

      try {
        const player = createAudioPlayer(SOUND_FILES[key], {
          updateInterval: 100,
          keepAudioSessionActive: true,
        });
        activePlayersRef.current.add(player);
        player.loop = loop;
        player.volume = volume;

        let didCleanUp = false;
        const cleanup = () => {
          if (didCleanUp) {
            return;
          }
          didCleanUp = true;
          cleanupPlayer(player, subscription);
        };

        const subscription = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish && !loop) {
            onFinish?.();
            cleanup();
          }
        });

        return {
          pause: () => {
            if (!didCleanUp) {
              player.pause();
            }
          },
          play: () => {
            if (!didCleanUp) {
              player.play();
            }
          },
          setVolume: (value: number) => {
            if (!didCleanUp) {
              player.volume = Math.max(0, Math.min(1, value));
            }
          },
          stop: cleanup,
        };
      } catch {
        // Fail silently - audio is non-critical.
        return null;
      }
    },
    [cleanupPlayer, soundEffectsEnabled]
  );

  const playSound = useCallback(
    (key: SoundKey, volume: number = 1, loop: boolean = false) => {
      const player = createManagedPlayer(key, { loop, volume });
      if (!player) {
        return null;
      }

      player.play();
      return {
        stop: player.stop,
      };
    },
    [createManagedPlayer]
  );

  return { createManagedPlayer, playSound };
}
