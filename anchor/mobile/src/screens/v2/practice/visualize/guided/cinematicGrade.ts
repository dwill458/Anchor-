import type { CinematicTimeline } from '../prototype/cinematicTimeline';

export type CinematicGrade = { dim: number; warm: number; soften: number; watermark: number };

/** Whole seconds a long silence takes to ease in and out of its breathing. */
const BREATH_EDGE_MS = 1200;
const BREATH_PERIOD_MS = 8000;
/** Peak of the luminance breath; it must read as a living still, never as an effect. */
export const CINEMATIC_BREATH_PEAK = 0.04;

/** Grade at an audio position. Pure and worklet-safe: the same position always yields the same grade. */
export function cinematicGradeAt(timeline: CinematicTimeline, ms: number): CinematicGrade {
  'worklet';
  const keys = timeline.grade;
  if (!keys || keys.length === 0) return { dim: 0, warm: 0, soften: 0, watermark: 0 };
  if (ms <= keys[0].atMs) return { dim: keys[0].dim, warm: keys[0].warm, soften: keys[0].soften, watermark: keys[0].watermark };
  for (let index = 1; index < keys.length; index += 1) {
    const next = keys[index];
    if (ms < next.atMs) {
      const previous = keys[index - 1];
      const span = Math.max(1, next.atMs - previous.atMs);
      const t = Math.max(0, Math.min(1, (ms - previous.atMs) / span));
      const e = t * t * (3 - 2 * t);
      return {
        dim: previous.dim + (next.dim - previous.dim) * e,
        warm: previous.warm + (next.warm - previous.warm) * e,
        soften: previous.soften + (next.soften - previous.soften) * e,
        watermark: previous.watermark + (next.watermark - previous.watermark) * e,
      };
    }
  }
  const last = keys[keys.length - 1];
  return { dim: last.dim, warm: last.warm, soften: last.soften, watermark: last.watermark };
}

/**
 * Luminance breathing, nonzero only inside a long silence. It is a function of the audio position,
 * so a resume or a background return lands on exactly the breath the track is at.
 */
export function cinematicBreathAt(timeline: CinematicTimeline, ms: number): number {
  'worklet';
  const spans = timeline.stillness;
  if (!spans) return 0;
  for (let index = 0; index < spans.length; index += 1) {
    const span = spans[index];
    if (ms < span.startMs || ms >= span.endMs) continue;
    const edge = Math.min(1, (ms - span.startMs) / BREATH_EDGE_MS, (span.endMs - ms) / BREATH_EDGE_MS);
    const wave = 0.5 - 0.5 * Math.cos((2 * Math.PI * (ms - span.startMs)) / BREATH_PERIOD_MS);
    return CINEMATIC_BREATH_PEAK * Math.max(0, edge) * wave;
  }
  return 0;
}
