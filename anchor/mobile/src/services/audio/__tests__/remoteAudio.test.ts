import * as FileSystem from 'expo-file-system/legacy';
import {
  REMOTE_AUDIO_TRACKS,
  downloadRemoteAudio,
  hydrateRemoteAudioCache,
  isAudioSourceAvailableOffline,
  prefetchAudioSources,
  remoteAudio,
  remoteAudioKeyFor,
  resetRemoteAudioCacheForTests,
  resolvePlayableAudioSource,
} from '../remoteAudio';

const fs = FileSystem as unknown as Record<string, jest.Mock>;
const DIR = 'file:///documents/session-audio/';
const embody = REMOTE_AUDIO_TRACKS.embodyLina;

describe('remoteAudio', () => {
  beforeEach(() => {
    resetRemoteAudioCacheForTests();
    jest.clearAllMocks();
    fs.getInfoAsync.mockResolvedValue({ exists: false });
    fs.readDirectoryAsync.mockResolvedValue([]);
    fs.downloadAsync.mockRejectedValue(new Error('offline'));
  });

  it('builds content-addressed URLs and maps them back to their key', () => {
    const source = remoteAudio('embodyLina') as { uri: string };
    expect(source.uri).toMatch(/\/session-audio\/Embody_Final_Lina_10min15_V4\.39007e56\.mp3$/);
    expect(remoteAudioKeyFor(source)).toBe('embodyLina');
    expect(remoteAudioKeyFor(42)).toBeNull();
    expect(remoteAudioKeyFor({ uri: 'https://example.com/other.mp3' })).toBeNull();
  });

  it('treats bundled sources as always available and remote ones as unavailable until on disk', () => {
    expect(isAudioSourceAvailableOffline(42)).toBe(true);
    expect(isAudioSourceAvailableOffline(remoteAudio('embodyLina'))).toBe(false);
  });

  it('streams the remote URL while a track is not cached, and starts a download', () => {
    const source = remoteAudio('embodyLina');
    expect(resolvePlayableAudioSource(source)).toBe(source);
    return new Promise<void>((resolve) => setImmediate(() => {
      expect(fs.downloadAsync).toHaveBeenCalledWith((source as { uri: string }).uri, `${DIR}${embody.file}.download`);
      resolve();
    }));
  });

  it('downloads to a temp file, verifies the size, then plays from disk', async () => {
    fs.downloadAsync.mockResolvedValue({ status: 200 });
    fs.getInfoAsync.mockImplementation(async (uri: string) =>
      uri.endsWith('.download') ? { exists: true, size: embody.bytes } : { exists: false });

    await expect(downloadRemoteAudio('embodyLina')).resolves.toBe(true);
    expect(fs.moveAsync).toHaveBeenCalledWith({ from: `${DIR}${embody.file}.download`, to: `${DIR}${embody.file}` });
    expect(resolvePlayableAudioSource(remoteAudio('embodyLina'))).toEqual({ uri: `${DIR}${embody.file}` });
    expect(isAudioSourceAvailableOffline(remoteAudio('embodyLina'))).toBe(true);
  });

  it('rejects a truncated download and never marks it cached', async () => {
    fs.downloadAsync.mockResolvedValue({ status: 200 });
    fs.getInfoAsync.mockImplementation(async (uri: string) =>
      uri.endsWith('.download') ? { exists: true, size: embody.bytes - 1 } : { exists: false });

    await expect(downloadRemoteAudio('embodyLina')).resolves.toBe(false);
    expect(fs.moveAsync).not.toHaveBeenCalled();
    expect(fs.deleteAsync).toHaveBeenCalledWith(`${DIR}${embody.file}.download`, { idempotent: true });
  });

  it('deduplicates concurrent downloads of the same track', async () => {
    fs.downloadAsync.mockResolvedValue({ status: 200 });
    fs.getInfoAsync.mockImplementation(async (uri: string) =>
      uri.endsWith('.download') ? { exists: true, size: embody.bytes } : { exists: false });

    await prefetchAudioSources([remoteAudio('embodyLina'), remoteAudio('embodyLina'), 7, null]);
    await downloadRemoteAudio('embodyLina');
    expect(fs.downloadAsync).toHaveBeenCalledTimes(1);
  });

  it('hydrates complete files from disk and removes partial ones', async () => {
    const deep = REMOTE_AUDIO_TRACKS.deepFocus10Lina;
    fs.readDirectoryAsync.mockResolvedValue([embody.file, deep.file]);
    fs.getInfoAsync.mockImplementation(async (uri: string) => {
      if (uri === DIR) return { exists: true };
      if (uri.endsWith(embody.file)) return { exists: true, size: embody.bytes };
      return { exists: true, size: 10 };
    });

    await hydrateRemoteAudioCache();
    expect(isAudioSourceAvailableOffline(remoteAudio('embodyLina'))).toBe(true);
    expect(isAudioSourceAvailableOffline(remoteAudio('deepFocus10Lina'))).toBe(false);
    expect(fs.deleteAsync).toHaveBeenCalledWith(`${DIR}${deep.file}`, { idempotent: true });
  });
});
