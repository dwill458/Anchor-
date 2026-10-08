import { useEffect, useReducer, useState } from 'react';
import type { AudioSource } from 'expo-audio';
import {
  downloadRemoteAudio,
  hydrateRemoteAudioCache,
  isAudioSourceAvailableOffline,
  remoteAudioKeyFor,
  subscribeRemoteAudioCache,
} from '@/services/audio/remoteAudio';

export type RemoteAudioReadiness = 'ready' | 'downloading' | 'failed';

/**
 * Starts downloading any remote track among `sources` as soon as a setup screen knows what the
 * session will play, and reports whether all of them can play without the network.
 * Bundled sources are always ready. `retry` restarts a failed download.
 */
export function useRemoteAudioReady(sources: readonly (AudioSource | null | undefined)[]): {
  readiness: RemoteAudioReadiness;
  retry: () => void;
} {
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const keys = sources.map(remoteAudioKeyFor).filter(Boolean).sort().join('|');

  useEffect(() => subscribeRemoteAudioCache(rerender), []);

  useEffect(() => {
    if (!keys) return;
    let live = true;
    setFailed(false);
    void (async () => {
      await hydrateRemoteAudioCache();
      const results = await Promise.all(sources.map((source) => {
        const key = remoteAudioKeyFor(source);
        return key ? downloadRemoteAudio(key) : Promise.resolve(true);
      }));
      if (live && results.some((ok) => !ok)) setFailed(true);
    })();
    return () => { live = false; };
    // `keys` is the identity of the remote sources; the array itself is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, attempt]);

  const allOnDisk = sources.every(isAudioSourceAvailableOffline);
  return {
    readiness: allOnDisk ? 'ready' : failed ? 'failed' : 'downloading',
    retry: () => setAttempt((value) => value + 1),
  };
}
