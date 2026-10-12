import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useSettingsStore } from '@/stores/settingsStore';
import { CREATION_SOUND_SOURCES, SOUND_FILES } from './soundSources';
import { sfxLog } from './sfxLog';

type AudioSource = Parameters<typeof createAudioPlayer>[0];
type Entry = {
  player: AudioPlayer;
  busy: boolean;
  playReached: boolean;
  temporary: boolean;
  token: number;
  id: number;
  fadeTimer?: ReturnType<typeof setInterval>;
  subscription?: { remove: () => void };
  errorSubscription?: { remove: () => void };
  loadWaiters: Set<(loaded: boolean) => void>;
  loadedAtMs?: number;
  lastPlaybackState?: string;
  lastError?: string;
};
export type SoundPoolOptions = { volume?: number; rate?: number; loop?: boolean; fadeInMs?: number };
export type SoundPoolHandle = { stop: (fadeOutMs?: number) => void };

export const MAX_LIVE_PLAYERS = 24;
// 24 covers the creation flow's worst case: 10 node tones + distillTick(4) + uiTap(2) prewarmed (16),
// plus headroom for same-note overlaps during rapid mapping without forcing eviction.
const LOAD_TIMEOUT_MS = 1500;
const PREWARM_BATCH_SIZE = 3;
const PREWARM_INTERVAL_MS = 50;

const sources = new Map<string, AudioSource>();
const entriesByKey = new Map<string, Entry[]>();
let nextEntryId = 1;
let prewarmQueue: string[] = [];
let prewarmTimer: ReturnType<typeof setTimeout> | null = null;

Object.entries(SOUND_FILES).forEach(([key, source]) => sources.set(key, source));
Object.entries(CREATION_SOUND_SOURCES).forEach(([key, source]) => sources.set(`creation:${key}`, source));

if (typeof useSettingsStore?.subscribe === 'function') {
  useSettingsStore.subscribe((state, previousState) => {
    if (previousState?.soundEffectsEnabled && !state?.soundEffectsEnabled) {
      prewarmQueue = [];
      if (prewarmTimer) {
        clearTimeout(prewarmTimer);
        prewarmTimer = null;
      }
      entriesByKey.forEach((entries, key) => {
        entries.slice().forEach((entry) => {
          if (entry.busy) releaseEntry(key, entry, entry.token);
        });
      });
    }
  });
}

export function getPoolSizeForKey(key: string): number {
  if (
    key === 'creation:uiTap' ||
    key === 'uiTap' ||
    key === 'creation:formTick' ||
    key === 'formTick'
  ) {
    return 2;
  }
  // Rapid-fire cues (letters landing on the board) overlap themselves; a single player would
  // fall back to cold temporary players that miss the cue.
  if (key === 'creation:distillTick' || key === 'distillTick') return 4;
  if (key === 'creation:revealSettle') return 2;
  return 1;
}

export function getMaxPoolSizeForKey(key: string): number {
  if (
    key === 'creation:uiTap' ||
    key === 'uiTap' ||
    key === 'creation:formTick' ||
    key === 'formTick'
  ) {
    return 2;
  }
  if (key === 'creation:distillTick' || key === 'distillTick') return 4;
  if (key === 'creation:revealSettle') return 2;
  // node:* tones stay at 1: a same-pitch retrigger reuses the oldest entry instead of adding a player.
  return 1;
}

export function countLivePlayers(): number {
  let count = 0;
  for (const entries of entriesByKey.values()) {
    count += entries.length;
  }
  return count;
}

function disposeEntry(key: string, entry: Entry): void {
  entry.busy = false;
  Array.from(entry.loadWaiters).forEach((resolve) => resolve(false));
  if (entry.fadeTimer) clearInterval(entry.fadeTimer);
  entry.fadeTimer = undefined;
  try { entry.subscription?.remove(); } catch { /* Non-critical effect cleanup. */ }
  try { entry.errorSubscription?.remove(); } catch { /* Non-critical effect cleanup. */ }
  try { entry.player.pause(); } catch { /* Non-critical effect cleanup. */ }
  try { entry.player.remove(); } catch { /* Non-critical effect cleanup. */ }
  try { entry.player.release?.(); } catch { /* Non-critical effect cleanup. */ }
  const entries = entriesByKey.get(key);
  if (entries) {
    const remaining = entries.filter((candidate) => candidate !== entry);
    if (remaining.length > 0) {
      entriesByKey.set(key, remaining);
    } else {
      entriesByKey.delete(key);
    }
  }
}

function evictOneIdleEntry(exceptKey?: string): boolean {
  for (const [key, entries] of entriesByKey.entries()) {
    if (entries.length > getPoolSizeForKey(key)) {
      const idle = entries.find((e) => !e.busy);
      if (idle) {
        disposeEntry(key, idle);
        return true;
      }
    }
  }
  for (const [key, entries] of entriesByKey.entries()) {
    if (key !== exceptKey && !prewarmQueue.includes(key)) {
      const idle = entries.find((e) => !e.busy);
      if (idle) {
        disposeEntry(key, idle);
        return true;
      }
    }
  }
  for (const [key, entries] of entriesByKey.entries()) {
    if (key !== exceptKey) {
      const idle = entries.find((e) => !e.busy);
      if (idle) {
        disposeEntry(key, idle);
        return true;
      }
    }
  }
  for (const [key, entries] of entriesByKey.entries()) {
    const idle = entries.find((e) => !e.busy);
    if (idle) {
      disposeEntry(key, idle);
      return true;
    }
  }
  return false;
}

function releaseEntry(key: string, entry: Entry, token: number, discard = false): void {
  if (entry.token !== token || !entry.busy) return;
  entry.busy = false;
  entry.playReached = false;
  Array.from(entry.loadWaiters).forEach((resolve) => resolve(false));
  if (entry.fadeTimer) clearInterval(entry.fadeTimer);
  entry.fadeTimer = undefined;
  try { entry.player.pause(); } catch { /* Non-critical effect cleanup. */ }
  if (discard || entry.temporary) {
    disposeEntry(key, entry);
  }
}

function isLoadedSignal(entry: Entry): boolean {
  return (
    entry.player.isLoaded ||
    entry.lastPlaybackState === 'ready' ||
    entry.lastPlaybackState === 'ended'
  );
}

function createEntry(key: string, temporary: boolean): Entry | null {
  const source = sources.get(key);
  if (!source) return null;
  while (countLivePlayers() >= MAX_LIVE_PLAYERS) {
    if (!evictOneIdleEntry(key)) {
      sfxLog(`createEntry key=${key} drop=cap-reached livePlayers=${countLivePlayers()}`);
      return null;
    }
  }
  try {
    const player = createAudioPlayer(source, { updateInterval: 100, keepAudioSessionActive: true });
    const entry: Entry = {
      player,
      busy: false,
      playReached: false,
      temporary,
      token: 0,
      id: nextEntryId++,
      loadWaiters: new Set(),
    };
    entry.subscription = player.addListener('playbackStatusUpdate', (status) => {
      entry.lastPlaybackState = status.playbackState;
      const loaded = entry.player.isLoaded || status.playbackState === 'ready' || status.playbackState === 'ended' || Boolean(status.didJustFinish);
      if (loaded) {
        markEntryLoaded(key, entry);
        Array.from(entry.loadWaiters).forEach((resolve) => resolve(true));
      }
      if (status.didJustFinish && entry.busy && entry.playReached && !entry.player.loop) releaseEntry(key, entry, entry.token);
      else if (status.playbackState === 'idle' && entry.busy && entry.playReached) releaseEntry(key, entry, entry.token, true);
    });
    try {
      const maybeEmitter = player as unknown as {
        addListener?: (event: string, listener: (err: unknown) => void) => { remove: () => void };
      };
      entry.errorSubscription = maybeEmitter.addListener?.('error', (err: unknown) => {
        const text = errorText(err);
        entry.lastError = text;
        sfxLog(`playerError key=${key} entry=${entry.id} error=${text}`);
      });
    } catch {
      // expo-audio may not expose an 'error' event
    }
    const entries = entriesByKey.get(key) ?? [];
    entries.push(entry);
    entriesByKey.set(key, entries);
    if (entry.player.isLoaded) markEntryLoaded(key, entry);
    return entry;
  } catch (error) {
    sfxLog(`createEntry key=${key} error=${errorText(error)}`);
    return null;
  }
}

function markEntryLoaded(key: string, entry: Entry): void {
  if (entry.loadedAtMs !== undefined) return;
  entry.loadedAtMs = Date.now();
  sfxLog(`entry loaded key=${key} entry=${entry.id}`);
}

function waitForLoaded(entry: Entry, timeoutMs: number): Promise<boolean> {
  if (isLoadedSignal(entry)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      entry.loadWaiters.delete(finish);
      resolve(loaded);
    };
    timer = setTimeout(() => finish(false), timeoutMs);
    entry.loadWaiters.add(finish);
    if (isLoadedSignal(entry)) finish(true);
  });
}

function pumpPrewarmQueue(): void {
  prewarmTimer = null;
  if (!enabled()) {
    prewarmQueue = [];
    return;
  }
  let createdCount = 0;
  while (prewarmQueue.length > 0 && createdCount < PREWARM_BATCH_SIZE) {
    if (countLivePlayers() >= MAX_LIVE_PLAYERS) {
      if (!evictOneIdleEntry(prewarmQueue[0])) {
        break;
      }
    }
    const nextKey = prewarmQueue.shift()!;
    const current = (entriesByKey.get(nextKey) ?? []).filter((e) => !e.temporary).length;
    if (current < getPoolSizeForKey(nextKey)) {
      if (createEntry(nextKey, false)) {
        createdCount++;
      }
    }
  }
  if (prewarmQueue.length > 0) {
    prewarmTimer = setTimeout(pumpPrewarmQueue, PREWARM_INTERVAL_MS);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function enabled(): boolean {
  return useSettingsStore.getState().soundEffectsEnabled;
}

export const SoundPool = {
  /** Register a generated/cached source such as a synthesized node tone. */
  register(key: string, source: AudioSource): void {
    sources.set(key, source);
  },

  /** Discard all idle entries for the specified keys (or all keys if omitted). */
  releaseIdle(keys?: string[]): void {
    const targetKeys = keys ?? Array.from(entriesByKey.keys());
    const keySet = new Set(targetKeys);
    prewarmQueue = prewarmQueue.filter((k) => !keySet.has(k));
    for (const key of targetKeys) {
      const entries = entriesByKey.get(key);
      if (!entries) continue;
      const idle = entries.filter((entry) => !entry.busy);
      for (const entry of idle) {
        disposeEntry(key, entry);
      }
    }
  },

  /** Prepare idle players for keys, staggered in batches across 50ms intervals under the live cap. */
  prewarm(keys: string[]): void {
    if (!enabled()) {
      sfxLog(`prewarm count=${keys.length} created=0 drop=gate-off`);
      return;
    }
    for (const key of keys) {
      if (!sources.has(key)) continue;
      const target = getPoolSizeForKey(key);
      const current = (entriesByKey.get(key) ?? []).filter((e) => !e.temporary).length;
      const needed = target - current;
      for (let i = 0; i < needed; i++) {
        prewarmQueue.push(key);
      }
    }
    if (!prewarmTimer) {
      pumpPrewarmQueue();
    }
  },

  /** Reset all pool entries and queues (primarily for tests). */
  reset(): void {
    prewarmQueue = [];
    if (prewarmTimer) {
      clearTimeout(prewarmTimer);
      prewarmTimer = null;
    }
    entriesByKey.forEach((entries, key) => {
      entries.slice().forEach((entry) => {
        disposeEntry(key, entry);
      });
    });
    entriesByKey.clear();
  },

  play(key: string, { volume = 1, rate = 1, loop = false, fadeInMs = 0 }: SoundPoolOptions = {}): SoundPoolHandle | null {
    if (!enabled()) {
      sfxLog(`play key=${key} source=none loadedAtCall=false livePlayers=${countLivePlayers()} playbackState=none seek=not-reached playReached=false retry=0 drop=gate-off`);
      return null;
    }
    if (!sources.has(key)) {
      sfxLog(`play key=${key} source=none loadedAtCall=false livePlayers=${countLivePlayers()} playbackState=none seek=not-reached playReached=false retry=0 drop=unregistered-key`);
      return null;
    }

    const entries = entriesByKey.get(key) ?? [];
    let entry: Entry | null = entries.find((candidate) => !candidate.busy) ?? null;
    if (!entry) {
      const isPool = entries.length < getMaxPoolSizeForKey(key);
      entry = createEntry(key, !isPool);
    }
    if (!entry && entries.length > 0) {
      // Interrupt / re-trigger policy: reuse the oldest active entry for this key rather than dropping
      entry = entries.reduce((oldest, current) => (current.token < oldest.token ? current : oldest));
      entry.busy = false;
      if (entry.fadeTimer) clearInterval(entry.fadeTimer);
      entry.fadeTimer = undefined;
    }
    if (!entry) {
      sfxLog(`play key=${key} source=none loadedAtCall=false livePlayers=${countLivePlayers()} playbackState=none seek=not-reached playReached=false retry=0 drop=no-entry`);
      return null;
    }

    const source = entry.temporary ? 'temporary' : 'prewarmed';
    const loadedAtCall = isLoadedSignal(entry);
    const playbackStateAtCall =
      entry.lastPlaybackState ??
      (entry.player as any).currentStatus?.playbackState ??
      (loadedAtCall ? 'ready' : 'unknown');

    let activeEntry = entry;
    let activeToken = ++entry.token;
    entry.busy = true;

    let rateError = '';
    const applyConfig = (target: Entry) => {
      target.player.volume = fadeInMs > 0 ? 0 : Math.max(0, Math.min(1, volume));
      target.player.loop = loop;
      target.player.shouldCorrectPitch = false;
      if (rate !== 1) {
        try {
          target.player.setPlaybackRate(Math.max(0.5, Math.min(2, rate)));
        } catch (error) {
          rateError = errorText(error);
        }
      }
    };

    try {
      applyConfig(entry);

      void (async () => {
        let seekOutcome = 'not-reached';
        let playReached = false;
        let dropReason = '';
        let retried = false;

        try {
          let loaded = loadedAtCall || (await waitForLoaded(activeEntry, LOAD_TIMEOUT_MS));
          if (!loaded) {
            if (!activeEntry.busy) {
              dropReason = 'entry-released';
              return;
            }
            if (!enabled()) {
              dropReason = 'gate-off';
              releaseEntry(key, activeEntry, activeToken, true);
              return;
            }

            const lastPlaybackState =
              activeEntry.lastPlaybackState ??
              (activeEntry.player as any).currentStatus?.playbackState ??
              'unknown';
            const playerErr = activeEntry.lastError ?? (activeEntry.player as any).error ?? 'none';
            sfxLog(
              `load-timeout key=${key} entry=${activeEntry.id} playbackState=${lastPlaybackState} playerError=${playerErr} livePlayers=${countLivePlayers()} retry=1`
            );

            // Discard that entry
            releaseEntry(key, activeEntry, activeToken, true);

            // Do not release other keys here: one slow load must not tear down every prewarmed cue.

            // Create one fresh entry
            const freshEntry = createEntry(key, false);
            if (!freshEntry) {
              dropReason = 'load-timeout:retry-create-failed';
              return;
            }

            retried = true;
            activeEntry = freshEntry;
            activeToken = ++freshEntry.token;
            activeEntry.busy = true;

            applyConfig(activeEntry);

            // Retry once before dropping
            loaded =
              isLoadedSignal(activeEntry) || (await waitForLoaded(activeEntry, LOAD_TIMEOUT_MS));
            if (!loaded) {
              const retryState =
                activeEntry.lastPlaybackState ??
                (activeEntry.player as any).currentStatus?.playbackState ??
                'unknown';
              const retryErr = activeEntry.lastError ?? (activeEntry.player as any).error ?? 'none';
              sfxLog(
                `load-timeout key=${key} entry=${activeEntry.id} playbackState=${retryState} playerError=${retryErr} livePlayers=${countLivePlayers()} retry=1 final-drop`
              );
              dropReason = 'load-timeout';
              if (activeEntry.busy) releaseEntry(key, activeEntry, activeToken, true);
              return;
            }
          }

          if (!activeEntry.busy || activeEntry.token !== activeToken || !enabled()) {
            dropReason = enabled() ? 'entry-released' : 'gate-off';
            releaseEntry(key, activeEntry, activeToken);
            return;
          }

          try {
            await activeEntry.player.seekTo(0);
            seekOutcome = 'resolved';
          } catch (error) {
            seekOutcome = `rejected:${errorText(error)}`;
          }

          if (!activeEntry.busy || activeEntry.token !== activeToken || !enabled()) {
            dropReason = enabled() ? 'entry-released' : 'gate-off';
            releaseEntry(key, activeEntry, activeToken);
            return;
          }

          playReached = true;
          activeEntry.playReached = true;
          activeEntry.player.play();
          if (fadeInMs > 0) {
            const targetEntry = activeEntry, targetToken = activeToken, startedAt = Date.now();
            targetEntry.fadeTimer = setInterval(() => {
              if (!targetEntry.busy || targetEntry.token !== targetToken) {
                if (targetEntry.fadeTimer) clearInterval(targetEntry.fadeTimer);
                targetEntry.fadeTimer = undefined;
                return;
              }
              const progress = Math.min(1, (Date.now() - startedAt) / fadeInMs);
              targetEntry.player.volume = Math.max(0, Math.min(1, volume)) * progress;
              if (progress >= 1) {
                if (targetEntry.fadeTimer) clearInterval(targetEntry.fadeTimer);
                targetEntry.fadeTimer = undefined;
              }
            }, 16);
          }
        } catch (error) {
          dropReason = `playback-error:${errorText(error)}`;
          releaseEntry(key, activeEntry, activeToken);
        } finally {
          sfxLog(
            `play key=${key} source=${source} loadedAtCall=${loadedAtCall} livePlayers=${countLivePlayers()} playbackState=${playbackStateAtCall} seek=${seekOutcome} playReached=${playReached} rateError=${rateError || 'none'} retry=${retried ? 1 : 0} drop=${dropReason || 'none'}`
          );
        }
      })();

      return {
        stop: (fadeOutMs = 0) => {
          if (fadeOutMs <= 0 || !activeEntry.busy || activeEntry.token !== activeToken) {
            releaseEntry(key, activeEntry, activeToken);
            return;
          }
          if (activeEntry.fadeTimer) clearInterval(activeEntry.fadeTimer);
          const initialVolume = activeEntry.player.volume;
          const startedAt = Date.now();
          const targetEntry = activeEntry;
          const targetToken = activeToken;
          targetEntry.fadeTimer = setInterval(() => {
            if (!targetEntry.busy || targetEntry.token !== targetToken) {
              if (targetEntry.fadeTimer) clearInterval(targetEntry.fadeTimer);
              targetEntry.fadeTimer = undefined;
              return;
            }
            const progress = Math.min(1, (Date.now() - startedAt) / fadeOutMs);
            targetEntry.player.volume = initialVolume * (1 - progress);
            if (progress >= 1) releaseEntry(key, targetEntry, targetToken);
          }, 16);
        },
      };
    } catch (error) {
      sfxLog(
        `play key=${key} source=${source} loadedAtCall=${loadedAtCall} livePlayers=${countLivePlayers()} playbackState=${playbackStateAtCall} seek=not-reached playReached=false retry=0 drop=setup-error:${errorText(error)}`
      );
      releaseEntry(key, activeEntry, activeToken);
      return null;
    }
  },
};
