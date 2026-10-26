import glimpseMap from '../beatmaps/beatmap_glimpse.json';
import immerseMap from '../beatmaps/beatmap_immerse.json';
import embodyMap from '../beatmaps/beatmap_embody.json';
import type { GuidanceVoice } from '@/types/sessionAudio';

/** The JSON beat maps are the only source of narration timing; nothing else may restate a timestamp. */
export type GuidedTrackId = 'glimpse' | 'immerse' | 'embody';
export type GuideId = 'dominic' | 'lina';
export type GuidedDurationSeconds = 60 | 180 | 600;

export type BeatPhrase = {
  id: number;
  text: string;
  startMs: number;
  endMs: number;
  silenceAfterMs: number;
  chapter: string;
  captionSpans?: { text: string; startMs: number; endMs: number }[];
};
export type BeatMap = { track: GuidedTrackId; guide: GuideId; durationMs: number; phrases: BeatPhrase[] };

/** Silence thresholds from the playback brief: short settles on its own, meaningful stills, long freezes. */
export const SILENCE_MEANINGFUL_MS = 2500;
export const SILENCE_LONG_MS = 5000;
export type SilenceClass = 'none' | 'short' | 'meaningful' | 'long';

export function classifySilence(ms: number): Exclude<SilenceClass, 'none'> {
  return ms >= SILENCE_LONG_MS ? 'long' : ms >= SILENCE_MEANINGFUL_MS ? 'meaningful' : 'short';
}

type RawPhrase = { id: number; text: string; start: number; end: number; silence_after: number; chapter: string;
  caption_spans?: { text: string; start: number; end: number }[] };
type RawMap = { track: string; audio_duration: number; voices: Record<string, { phrases: RawPhrase[]; audio_duration?: number }> };
const RAW: Record<GuidedTrackId, RawMap> = { glimpse: glimpseMap, immerse: immerseMap, embody: embodyMap } as Record<GuidedTrackId, RawMap>;
const ms = (seconds: number) => Math.round(seconds * 1000);

const cache = new Map<string, BeatMap>();
export function loadBeatMap(track: GuidedTrackId, guide: GuideId): BeatMap {
  const key = `${track}:${guide}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const raw = RAW[track];
  const voice = raw.voices[guide];
  if (!voice) throw new RangeError(`No ${guide} beat map for ${track}`);
  const map: BeatMap = {
    track, guide, durationMs: ms(voice.audio_duration ?? raw.audio_duration),
    phrases: voice.phrases.map(phrase => ({
      id: phrase.id, text: phrase.text, startMs: ms(phrase.start), endMs: ms(phrase.end),
      silenceAfterMs: ms(phrase.silence_after), chapter: phrase.chapter,
      ...(phrase.caption_spans ? { captionSpans: phrase.caption_spans.map(span => ({ text: span.text, startMs: ms(span.start), endMs: ms(span.end) })) } : {}),
    })),
  };
  cache.set(key, map);
  return map;
}

export function trackForDuration(durationSeconds: GuidedDurationSeconds): GuidedTrackId {
  return durationSeconds === 60 ? 'glimpse' : durationSeconds === 180 ? 'immerse' : 'embody';
}

/** Display the runtime from the same source that controls playback and completion. */
export function v2VisualizeDurationLabel(seconds: GuidedDurationSeconds, accessible = false): string {
  const runtimeSeconds = Math.round(loadBeatMap(trackForDuration(seconds), 'dominic').durationMs / 1000);
  const minutes = Math.floor(runtimeSeconds / 60);
  const remainder = runtimeSeconds % 60;
  return accessible
    ? `${minutes} minute${minutes === 1 ? '' : 's'} ${remainder} second${remainder === 1 ? '' : 's'}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** Dominic is the male guide and Lina the female guide. A silenced session still follows a beat map. */
export function guideForVoice(voice: GuidanceVoice): GuideId {
  return voice === 'male' ? 'dominic' : 'lina';
}

export function phraseById(map: BeatMap, id: number): BeatPhrase {
  const phrase = map.phrases.find(item => item.id === id);
  if (!phrase) throw new RangeError(`Beat map ${map.track}/${map.guide} has no phrase ${id}`);
  return phrase;
}

/** Gaps between narrated phrases, from the map's own `silence_after` data. */
export function silenceSpans(map: BeatMap): Array<{ startMs: number; endMs: number; durationMs: number; afterPhraseId: number }> {
  return map.phrases.map((phrase, index) => {
    const next = map.phrases[index + 1];
    const endMs = next ? next.startMs : Math.min(map.durationMs, phrase.endMs + phrase.silenceAfterMs);
    return { startMs: phrase.endMs, endMs, durationMs: Math.max(0, endMs - phrase.endMs), afterPhraseId: phrase.id };
  }).filter(span => span.durationMs > 0);
}
