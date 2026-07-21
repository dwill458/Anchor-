import { useCallback, useEffect, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import type { AudioAssetReference } from '@/services/SessionAudioManifest';

export type ManagedSessionAudioPlayer = {
  getCurrentTime: () => number;
  isLoaded: () => boolean;
  pause: () => void;
  play: () => void;
  seekTo: (seconds: number) => Promise<void>;
  setVolume: (volume: number) => void;
  stop: () => void;
};

type SessionAudioPlayerOptions = {
  loop?: boolean;
  onFinish?: () => void;
  onFailure?: () => void;
  volume?: number;
  onStatus?: (status: AudioStatus) => void;
  /** Stable manifest identifier used for diagnostics and deterministic tests. */
  trackId?: string;
};

export function useSessionAudio() {
  const activePlayersRef = useRef<Set<AudioPlayer>>(new Set());

  const cleanupPlayer = useCallback(
    (player: AudioPlayer, subscription?: { remove: () => void }) => {
      try {
        subscription?.remove();
      } catch {
        // Cleanup is best effort; the session timer remains authoritative.
      }
      try {
        player.pause();
      } catch {
        // Cleanup is best effort; the session timer remains authoritative.
      }
      try {
        player.remove();
      } catch {
        // Cleanup is best effort; the session timer remains authoritative.
      }
      activePlayersRef.current.delete(player);
    },
    []
  );

  const cleanupAllPlayers = useCallback(() => {
    activePlayersRef.current.forEach((player) => cleanupPlayer(player));
    activePlayersRef.current.clear();
  }, [cleanupPlayer]);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch(() => undefined);

    return cleanupAllPlayers;
  }, [cleanupAllPlayers]);

  const createSessionAudioPlayer = useCallback(
    (
      asset: AudioAssetReference,
      { loop = false, onFinish, onFailure, onStatus, volume = 1 }: SessionAudioPlayerOptions = {}
    ): ManagedSessionAudioPlayer | null => {
      try {
        const player = createAudioPlayer(asset, {
          updateInterval: 100,
          keepAudioSessionActive: true,
        });
        activePlayersRef.current.add(player);
        player.loop = loop;
        player.volume = Math.max(0, Math.min(1, volume));

        let didCleanUp = false;
        let didReportFailure = false;
        const reportFailure = () => {
          if (!didReportFailure) {
            didReportFailure = true;
            onFailure?.();
          }
        };
        const cleanup = () => {
          if (didCleanUp) return;
          didCleanUp = true;
          cleanupPlayer(player, subscription);
        };
        const subscription = player.addListener('playbackStatusUpdate', (status) => {
          onStatus?.(status);
          if (status.didJustFinish && !loop) {
            onFinish?.();
            cleanup();
          }
        });

        return {
          getCurrentTime: () => player.currentTime,
          isLoaded: () => player.isLoaded,
          pause: () => {
            if (didCleanUp) return;
            try {
              player.pause();
            } catch {
              reportFailure();
              cleanup();
            }
          },
          play: () => {
            if (didCleanUp) return;
            try {
              player.play();
            } catch {
              reportFailure();
              cleanup();
            }
          },
          seekTo: async (seconds) => {
            if (didCleanUp) return;
            try {
              await player.seekTo(Math.max(0, seconds));
            } catch {
              reportFailure();
              cleanup();
            }
          },
          setVolume: (nextVolume) => {
            if (didCleanUp) return;
            try {
              player.volume = Math.max(0, Math.min(1, nextVolume));
            } catch {
              reportFailure();
              cleanup();
            }
          },
          stop: cleanup,
        };
      } catch {
        onFailure?.();
        return null;
      }
    },
    [cleanupPlayer]
  );

  return { createSessionAudioPlayer };
}
