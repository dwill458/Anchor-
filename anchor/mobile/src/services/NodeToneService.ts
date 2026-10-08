import * as FileSystem from 'expo-file-system/legacy';

import { useSettingsStore } from '@/stores/settingsStore';
import { SoundPool } from '@/services/audio/SoundPool';
import { sfxLog } from '@/services/audio/sfxLog';
import {
  bytesToBase64,
  encodeWav,
  nodeFrequency,
  nodeToneKey,
  synthNodeTone,
} from '@/utils/audio/nodeTone';

/** Quiet by design: the line is thinking out loud, not performing. */
const NODE_TONE_VOLUME = 0.32;

const uriByNote = new Map<number, string>();
const pending = new Map<number, Promise<string | null>>();
let releaseEpoch = 0;

async function buildTone(cell: number): Promise<string | null> {
  const note = nodeToneKey(cell);
  const cached = uriByNote.get(note);
  if (cached) return cached;
  const inflight = pending.get(note);
  if (inflight) return inflight;

  const work = (async () => {
    try {
      const directory = FileSystem.cacheDirectory;
      if (!directory) return null;
      const uri = `${directory}anchor-node-tone-${note}.wav`;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        const wav = encodeWav(synthNodeTone(nodeFrequency(cell)));
        await FileSystem.writeAsStringAsync(uri, bytesToBase64(wav), {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      uriByNote.set(note, uri);
      return uri;
    } catch {
      // Audio is never worth interrupting the flow for.
      return null;
    } finally {
      pending.delete(note);
    }
  })();
  pending.set(note, work);
  return work;
}

/**
 * Plays the generative Mapping tones. `prepare` builds every tone a grid needs up front (a few
 * kilobytes each, cached on disk across launches) so `play` is instant when the line reaches a node.
 */
export const NodeToneService = {
  async prepare(cells: number[]): Promise<void> {
    if (!useSettingsStore.getState().soundEffectsEnabled) return;
    const epoch = releaseEpoch;
    await Promise.all(Array.from(new Set(cells.map(nodeToneKey))).map((note) => {
      const cell = cells.find((c) => nodeToneKey(c) === note) ?? 1;
      return buildTone(cell);
    }));
    const prepared = Array.from(new Set(cells.map(nodeToneKey)))
      .map((note) => uriByNote.get(note))
      .filter((uri): uri is string => Boolean(uri));
    for (const uri of prepared) SoundPool.register(`node:${uri}`, { uri });
    // Mapping already ended while the tones were building: do not re-create players it just released.
    if (epoch !== releaseEpoch) return;
    SoundPool.prewarm(prepared.map((uri) => `node:${uri}`));
  },

  release(): void {
    releaseEpoch++;
    const keys = Array.from(uriByNote.values()).map((uri) => `node:${uri}`);
    SoundPool.releaseIdle(keys);
  },

  play(cell: number): void {
    const uri = uriByNote.get(nodeToneKey(cell));
    // Not built yet: skip this droplet rather than stutter the line.
    if (!uri) {
      sfxLog(`mappingTone cell=${cell} result=skipped-unprepared`);
      return;
    }
    sfxLog(`mappingTone cell=${cell} result=play`);
    SoundPool.play(`node:${uri}`, { volume: NODE_TONE_VOLUME });
  },
};
