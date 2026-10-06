import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useSettingsStore } from '@/stores/settingsStore';
import { CREATION_SOUND_SOURCES, SOUND_FILES } from './soundSources';

type AudioSource = Parameters<typeof createAudioPlayer>[0];
type Entry = { player: AudioPlayer; busy: boolean; temporary: boolean; token: number; subscription?: { remove: () => void } };
export type SoundPoolOptions = { volume?: number; rate?: number };
export type SoundPoolHandle = { stop: () => void };

const PLAYERS_PER_KEY = 3;
const sources = new Map<string, AudioSource>();
const entriesByKey = new Map<string, Entry[]>();

Object.entries(SOUND_FILES).forEach(([key, source]) => sources.set(key, source));
Object.entries(CREATION_SOUND_SOURCES).forEach(([key, source]) => sources.set(`creation:${key}`, source));

useSettingsStore.subscribe((state, previousState) => {
  if (previousState.soundEffectsEnabled && !state.soundEffectsEnabled) {
    entriesByKey.forEach((entries, key) => {
      entries.slice().forEach((entry) => {
        if (entry.busy) releaseEntry(key, entry, entry.token);
      });
    });
  }
});

function releaseEntry(key: string, entry: Entry, token: number): void {
  if (entry.token !== token || !entry.busy) return;
  entry.busy = false;
  try { entry.player.pause(); } catch { /* Non-critical effect cleanup. */ }
  if (!entry.temporary) return;
  try { entry.subscription?.remove(); } catch { /* Non-critical effect cleanup. */ }
  try { entry.player.remove(); } catch { /* Non-critical effect cleanup. */ }
  const entries = entriesByKey.get(key);
  if (entries) entriesByKey.set(key, entries.filter((candidate) => candidate !== entry));
}

function createEntry(key: string, temporary: boolean): Entry | null {
  const source = sources.get(key);
  if (!source) return null;
  try {
    const player = createAudioPlayer(source, { updateInterval: 100, keepAudioSessionActive: true });
    const entry: Entry = { player, busy: false, temporary, token: 0 };
    entry.subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish && entry.busy) releaseEntry(key, entry, entry.token);
    });
    const entries = entriesByKey.get(key) ?? [];
    entries.push(entry);
    entriesByKey.set(key, entries);
    return entry;
  } catch {
    return null;
  }
}

function enabled(): boolean {
  return useSettingsStore.getState().soundEffectsEnabled;
}

export const SoundPool = {
  /** Register a generated/cached source such as a synthesized node tone. */
  register(key: string, source: AudioSource): void {
    sources.set(key, source);
  },

  /** Prepare three idle players for each short sound without creating any while sound is disabled. */
  prewarm(keys: string[]): void {
    if (!enabled()) return;
    for (const key of keys) {
      while ((entriesByKey.get(key) ?? []).filter((entry) => !entry.temporary).length < PLAYERS_PER_KEY) {
        if (!createEntry(key, false)) break;
      }
    }
  },

  play(key: string, { volume = 1, rate = 1 }: SoundPoolOptions = {}): SoundPoolHandle | null {
    if (!enabled()) return null;
    if (!sources.has(key)) return null;
    this.prewarm([key]);
    const entries = entriesByKey.get(key) ?? [];
    const entry = entries.find((candidate) => !candidate.busy) ?? createEntry(key, true);
    if (!entry) return null;
    entry.busy = true;
    const token = ++entry.token;
    try {
      entry.player.volume = Math.max(0, Math.min(1, volume));
      entry.player.shouldCorrectPitch = false;
      entry.player.setPlaybackRate(Math.max(0.5, Math.min(2, rate)));
      void entry.player.seekTo(0).then(() => {
        if (entry.busy && entry.token === token && enabled()) entry.player.play();
        else releaseEntry(key, entry, token);
      }).catch(() => releaseEntry(key, entry, token));
      return { stop: () => releaseEntry(key, entry, token) };
    } catch {
      releaseEntry(key, entry, token);
      return null;
    }
  },
};
