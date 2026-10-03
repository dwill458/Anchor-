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
 * The camera's push-in as an extra scale. Ease-out: present and quick when it begins, arriving at exactly
 * zero velocity on the chapter that wants stillness. Pure in the audio position, so it resyncs for free.
 */
export function cinematicPushAt(timeline: CinematicTimeline, ms: number): number {
  'worklet';
  const push = timeline.push;
  if (!push || push.amount === 0) return 0;
  const t = Math.max(0, Math.min(1, (ms - push.startMs) / Math.max(1, push.endMs - push.startMs)));
  const inv = 1 - t;
  return push.amount * (1 - inv * inv * inv);
}

/** The anchor's slow glow while it is held: ~7 s period, nonzero only inside the hold. */
export const CINEMATIC_ANCHOR_GLOW_PERIOD_MS = 7000;
export function cinematicAnchorGlowAt(startMs: number, endMs: number, ms: number): number {
  'worklet';
  if (ms < startMs || ms >= endMs) return 0;
  const edge = Math.min(1, (ms - startMs) / 1500, (endMs - ms) / 1500);
  return Math.max(0, edge) * (0.5 - 0.5 * Math.cos((2 * Math.PI * (ms - startMs)) / CINEMATIC_ANCHOR_GLOW_PERIOD_MS));
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
