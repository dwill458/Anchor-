import * as FileSystem from 'expo-file-system/legacy';

import { useSettingsStore } from '@/stores/settingsStore';
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
    await Promise.all(Array.from(new Set(cells.map(nodeToneKey))).map((note) => {
      const cell = cells.find((c) => nodeToneKey(c) === note) ?? 1;
      return buildTone(cell);
    }));
  },

  play(cell: number): void {
    if (!useSettingsStore.getState().soundEffectsEnabled) return;
    const uri = uriByNote.get(nodeToneKey(cell));
    // Not built yet: skip this droplet rather than stutter the line.
    if (!uri) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
      const player = createAudioPlayer({ uri }, { updateInterval: 250 });
      player.volume = NODE_TONE_VOLUME;
      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (!status.didJustFinish) return;
        try {
          subscription.remove();
          player.remove();
        } catch {
          // Already released.
        }
      });
      player.play();
    } catch {
      // Audio is non-critical.
    }
  },
};
