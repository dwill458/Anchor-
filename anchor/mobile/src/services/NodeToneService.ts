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

/** All 10 notes across the 2-octave pentatonic ladder: cells 1..10 cover every note key. */
const SCALE_CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const uriByNote = new Map<number, string>();
const pending = new Map<number, Promise<string | null>>();

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
      SoundPool.register(`node:${uri}`, { uri });
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
  async prepare(cells?: number[]): Promise<void> {
    if (!useSettingsStore.getState().soundEffectsEnabled) return;
    const targetCells = cells && cells.length > 0 ? Array.from(new Set([...SCALE_CELLS, ...cells])) : SCALE_CELLS;
    await Promise.all(targetCells.map((c) => buildTone(c)));
    const prepared = Array.from(new Set(targetCells.map(nodeToneKey)))
      .map((note) => uriByNote.get(note))
      .filter((uri): uri is string => Boolean(uri));
    for (const uri of prepared) SoundPool.register(`node:${uri}`, { uri });
    SoundPool.prewarm(prepared.map((uri) => `node:${uri}`));
  },

  release(): void {
    const keys = Array.from(uriByNote.values()).map((uri) => `node:${uri}`);
    SoundPool.releaseIdle(keys);
  },

  play(cell: number): void {
    if (!useSettingsStore.getState().soundEffectsEnabled) return;
    const note = nodeToneKey(cell);
    const uri = uriByNote.get(note);
    if (uri) {
      sfxLog(`mappingTone cell=${cell} note=${note} result=play`);
      SoundPool.play(`node:${uri}`, { volume: NODE_TONE_VOLUME });
      return;
    }
    // If not prepared yet (e.g. fast user / disk write pending), build and play immediately without dropping.
    sfxLog(`mappingTone cell=${cell} note=${note} result=building`);
    void buildTone(cell).then((builtUri) => {
      if (builtUri) {
        SoundPool.register(`node:${builtUri}`, { uri: builtUri });
        sfxLog(`mappingTone cell=${cell} note=${note} result=play-async`);
        SoundPool.play(`node:${builtUri}`, { volume: NODE_TONE_VOLUME });
      } else {
        sfxLog(`mappingTone cell=${cell} note=${note} result=skipped-unprepared`);
      }
    });
  },
};
