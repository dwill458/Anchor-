import * as FileSystem from 'expo-file-system/legacy';
import type { AudioSource } from 'expo-audio';
import { API_URL } from '@/config';

/**
 * Long session recordings are not bundled. They live in R2 and are downloaded once into the
 * documents directory, then played from disk. Until a track is on disk, the player streams the
 * same URL and the download continues in the background for next time.
 *
 * The bucket has no working public domain, so URLs go through the API, which redirects to a
 * short-lived presigned R2 URL (`GET /api/v2/session-audio/:file`). A CDN in front of the bucket
 * can replace that with EXPO_PUBLIC_SESSION_AUDIO_BASE_URL, serving the same `/session-audio/` paths.
 *
 * Object names carry a content hash, so a re-encoded file is a new object and a cached copy is
 * never stale. Sources live in `anchor/mobile/audio-remote/session-audio/` and are uploaded with
 * `backend/scripts/upload-remote-audio.mjs`; add new entries there and here together.
 */
const BASE_URL = (process.env.EXPO_PUBLIC_SESSION_AUDIO_BASE_URL || `${API_URL}/api/v2`).replace(/\/+$/, '');
const PREFIX = 'session-audio';

export const REMOTE_AUDIO_TRACKS = {
  deepPrimeAmbient: { file: 'deep-prime-ambient.748fa915.mp3', bytes: 14_916_589 },
  deepFocus5Lina: { file: 'DeepFocus_5min_Lina.7d606083.mp3', bytes: 7_201_689 },
  deepFocus5Dominic: { file: 'DeepFocus_5min_Dominic.623af4ce.mp3', bytes: 7_201_689 },
  deepFocus10Lina: { file: 'DeepFocus_10min_Lina.24edab44.mp3', bytes: 14_401_454 },
  deepFocus10Dominic: { file: 'DeepFocus_10min_Dominic.90afe9af.mp3', bytes: 14_401_454 },
  embodyLina: { file: 'Embody_Final_Lina_10min15_V4.39007e56.mp3', bytes: 14_761_317 },
  embodyDominic: { file: 'Embody_Final_10min15_V4.4c3e3467.mp3', bytes: 14_761_317 },
  visualizeAmbient5m: { file: 'visualize_ambient_5m.7de22aad.mp3', bytes: 4_801_141 },
} as const;

export type RemoteAudioKey = keyof typeof REMOTE_AUDIO_TRACKS;

const remoteUrl = (key: RemoteAudioKey) => `${BASE_URL}/${PREFIX}/${REMOTE_AUDIO_TRACKS[key].file}`;
const keyByUrl = new Map<string, RemoteAudioKey>(
  (Object.keys(REMOTE_AUDIO_TRACKS) as RemoteAudioKey[]).map((key) => [remoteUrl(key), key]),
);

const cacheDir = () => (FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${PREFIX}/` : null);
const localUri = (key: RemoteAudioKey) => {
  const dir = cacheDir();
  return dir ? `${dir}${REMOTE_AUDIO_TRACKS[key].file}` : null;
};

const cached = new Set<RemoteAudioKey>();
const inFlight = new Map<RemoteAudioKey, Promise<boolean>>();
const listeners = new Set<() => void>();
let hydration: Promise<void> | null = null;

const notify = () => listeners.forEach((listener) => { try { listener(); } catch { /* listener errors are not ours */ } });

/** A manifest entry for a remote track. It is a plain `{ uri }` source, so every player accepts it. */
export function remoteAudio(key: RemoteAudioKey): AudioSource {
  return { uri: remoteUrl(key) };
}

export function remoteAudioKeyFor(source: AudioSource | null | undefined): RemoteAudioKey | null {
  if (!source || typeof source !== 'object' || typeof source.uri !== 'string') return null;
  return keyByUrl.get(source.uri) ?? null;
}

/** Reads what is already on disk once per launch. Files with the wrong size are partial and removed. */
export function hydrateRemoteAudioCache(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    const dir = cacheDir();
    if (!dir) return;
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) return;
      const names = new Set(await FileSystem.readDirectoryAsync(dir));
      for (const key of Object.keys(REMOTE_AUDIO_TRACKS) as RemoteAudioKey[]) {
        const { file, bytes } = REMOTE_AUDIO_TRACKS[key];
        if (!names.has(file)) continue;
        const fileInfo = await FileSystem.getInfoAsync(`${dir}${file}`);
        if (fileInfo.exists && 'size' in fileInfo && fileInfo.size === bytes) cached.add(key);
        else await FileSystem.deleteAsync(`${dir}${file}`, { idempotent: true }).catch(() => undefined);
      }
      notify();
    } catch {
      // A missing cache only means streaming; it is never fatal.
    }
  })();
  return hydration;
}

export function isRemoteAudioCached(key: RemoteAudioKey): boolean {
  return cached.has(key);
}

/** True when the source can play without the network: bundled, or a remote track already on disk. */
export function isAudioSourceAvailableOffline(source: AudioSource | null | undefined): boolean {
  const key = remoteAudioKeyFor(source);
  return key == null || cached.has(key);
}

/**
 * Downloads a remote track to disk (deduplicated). Resolves true once it is on disk.
 * A temp name and a size check keep an interrupted download from ever looking complete.
 */
export function downloadRemoteAudio(key: RemoteAudioKey): Promise<boolean> {
  if (cached.has(key)) return Promise.resolve(true);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const task = (async () => {
    await hydrateRemoteAudioCache();
    if (cached.has(key)) return true;
    const dir = cacheDir();
    const target = localUri(key);
    if (!dir || !target) return false;
    const temp = `${target}.download`;
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
      const result = await FileSystem.downloadAsync(remoteUrl(key), temp);
      const info = await FileSystem.getInfoAsync(temp);
      const size = info.exists && 'size' in info ? info.size : -1;
      if (result.status !== 200 || size !== REMOTE_AUDIO_TRACKS[key].bytes) {
        await FileSystem.deleteAsync(temp, { idempotent: true }).catch(() => undefined);
        return false;
      }
      await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
      await FileSystem.moveAsync({ from: temp, to: target });
      cached.add(key);
      notify();
      return true;
    } catch {
      await FileSystem.deleteAsync(temp, { idempotent: true }).catch(() => undefined);
      return false;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, task);
  return task;
}

/** Starts downloads for any remote sources in the list. Bundled sources are ignored. */
export function prefetchAudioSources(sources: readonly (AudioSource | null | undefined)[]): Promise<boolean[]> {
  const keys = [...new Set(sources.map(remoteAudioKeyFor).filter((key): key is RemoteAudioKey => key != null))];
  return Promise.all(keys.map(downloadRemoteAudio));
}

/**
 * What the player should open: the local file when the track is on disk, otherwise the source as is
 * (a remote track then streams, and a background download starts so the next session plays from disk).
 */
export function resolvePlayableAudioSource(source: AudioSource): AudioSource {
  const key = remoteAudioKeyFor(source);
  if (!key) return source;
  const local = localUri(key);
  if (cached.has(key) && local) return { uri: local };
  void downloadRemoteAudio(key);
  return source;
}

export function subscribeRemoteAudioCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Test-only: forget in-memory cache state between cases. */
export function resetRemoteAudioCacheForTests() {
  cached.clear();
  inFlight.clear();
  listeners.clear();
  hydration = null;
}
