import { useCallback, useEffect, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useSettingsStore } from '@/stores/settingsStore';

const SOUND_FILES = {
  'forge-seal': require('../assets/sounds/forge-seal.wav'),
  'letter-drop': require('../assets/sounds/letter-drop.wav'),
  'prime-begin': require('../assets/sounds/prime-begin.wav'),
  'prime-complete': require('../assets/sounds/prime-complete.wav'),
  'haptic-tone': require('../assets/sounds/haptic-tone.wav'),
  'ui-select': require('../assets/sounds/ui-select.wav'),
} as const;

export type SoundKey = keyof typeof SOUND_FILES;
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
