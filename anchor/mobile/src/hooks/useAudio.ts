import { useCallback, useEffect, useRef } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useSettingsStore } from '@/stores/settingsStore';
import { SoundPool } from '@/services/audio/SoundPool';
import { setAudioSessionMode } from '@/services/audio/AudioSession';
import { SOUND_FILES, type SoundKey } from '@/services/audio/soundSources';

// DEFERRED: forge-seal and letter-drop are replaced by the Phase 2 kit assets.
// DEFERRED: haptic-tone remains the Seal-hold loop until its Phase 2 replacement arrives.
export { SOUND_FILES, type SoundKey } from '@/services/audio/soundSources';
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
  /** Playback pitch follows rate; no speech pitch correction. */
  setRate: (rate: number) => void;
};

export function useAudio() {
  const soundEffectsEnabled = useSettingsStore((state) => state.soundEffectsEnabled);
  const enabledRef = useRef(soundEffectsEnabled);
  enabledRef.current = soundEffectsEnabled;
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
    void setAudioSessionMode('effects').catch(() => {
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
      if (!enabledRef.current) {
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
          setRate: (rate: number) => {
            if (!didCleanUp) {
              try {
                player.shouldCorrectPitch = false;
                player.setPlaybackRate(Math.max(0.5, Math.min(2, rate)));
              } catch {
                // Pitch support is best-effort; audio must never interrupt the gesture.
              }
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
      if (!enabledRef.current) return null;
      if (!loop) {
        const pooled = SoundPool.play(key, { volume });
        return pooled ? { stop: pooled.stop } : null;
      }
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
