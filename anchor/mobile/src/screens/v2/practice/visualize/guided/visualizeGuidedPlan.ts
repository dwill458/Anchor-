import type { CinematicGradeKey, CinematicSegment, CinematicTimeline } from '../prototype/cinematicTimeline';
import {
  classifySilence, loadBeatMap, phraseById, SILENCE_LONG_MS, silenceSpans, trackForDuration,
  type BeatMap, type GuideId, type GuidedDurationSeconds, type GuidedTrackId, type SilenceClass,
} from './visualizeBeatMap';
import { captionFor } from './visualizeCaptions';
import { cinematicGradeAt } from './cinematicGrade';

/**
 * One playback engine, three beat maps. This file turns a beat map into the stage's timeline, expressed on
 * the audio-position axis; the per-track differences live in `TRACK_PLANS` as data that points at phrase ids
 * in the JSON maps. No timestamp is restated here, so the maps stay the single timing source.
 */
export const GUIDED_LEAD_MS = 1000;
/** The stage's mask collapse reads 2.8s from the start of `compression`, then resolves into the Anchor. */
export const GUIDED_COMPRESSION_MS = 4000;
const TAIL_HOLD_MS = 1000;
const MOTION_MARGIN_MS = 400;
const MIN_MOTION_MS = 2500;
const CAPTION_TAIL_MS = 450;

type GradeValues = Partial<Omit<CinematicGradeKey, 'atMs'>>;
type GradeStep = { phraseId: number; lead?: boolean; rampMs: number; to: GradeValues };
type TrackPlan = {
  initialGrade: Omit<CinematicGradeKey, 'atMs'>;
  /** The board holds at rest until `untilMs` or a phrase; then the first Vision image breaks out. */
  arrival: { untilMs?: number; untilPhraseId?: number; breakoutMs: number };
  /** Hard cap on distinct Vision images; fewer are used when the map offers fewer change points. */
  maxImages: number;
  /** Candidate change points. Spread across them rather than front-loaded. Never forces every image to appear. */
  imageChanges: ReadonlyArray<{ phraseId: number; lead?: boolean }>;
  crossfadeMs: number;
  grade: readonly GradeStep[];
  /** One push-in after the breakout, easing to still at `untilPhraseId`. Omitted for tracks that should not move. */
  push?: { amount: number; untilPhraseId: number };
  anchorPhraseId: number;
  returnPhraseId: number;
  returnMs: number;
};

const SETTLED: Omit<CinematicGradeKey, 'atMs'> = { dim: 0, warm: 0, soften: 0, watermark: 0 };
const CLEAR: GradeValues = { dim: 0, warm: 0, soften: 0, watermark: 0 };

/** Glimpse is momentum, Immerse is depth, Embody is inhabitation: three paces, not one pace stretched. */
export const TRACK_PLANS: Readonly<Record<GuidedTrackId, TrackPlan>> = {
  glimpse: {
    initialGrade: SETTLED,
    arrival: { untilMs: 700, breakoutMs: 3600 },
    maxImages: 2,
    imageChanges: [{ phraseId: 5 }],
    crossfadeMs: 2200,
    grade: [
      { phraseId: 0, lead: true, rampMs: 3200, to: { watermark: 0.16 } },
      { phraseId: 8, lead: true, rampMs: 4000, to: { warm: 0.6 } },
      { phraseId: 11, rampMs: 2200, to: { warm: 1 } },
      { phraseId: 12, lead: true, rampMs: 3200, to: { watermark: 0.3, warm: 0.7 } },
      { phraseId: 14, lead: true, rampMs: 900, to: CLEAR },
    ],
    push: { amount: 0.07, untilPhraseId: 8 },
    anchorPhraseId: 14,
    returnPhraseId: 18,
    returnMs: 4000,
  },
  immerse: {
    initialGrade: { dim: 0.55, warm: 0, soften: 0, watermark: 0 },
    arrival: { untilPhraseId: 5, breakoutMs: 6500 },
    maxImages: 4,
    imageChanges: [{ phraseId: 13, lead: true }, { phraseId: 20 }, { phraseId: 25 }],
    crossfadeMs: 3200,
    grade: [
      { phraseId: 5, lead: true, rampMs: 7000, to: { dim: 0, watermark: 0.14 } },
      { phraseId: 13, lead: true, rampMs: 6000, to: { warm: 0.4 } },
      { phraseId: 22, rampMs: 8000, to: { warm: 1 } },
      { phraseId: 29, lead: true, rampMs: 4000, to: { warm: 0.6 } },
      { phraseId: 31, rampMs: 9000, to: { soften: 1 } },
      { phraseId: 36, lead: true, rampMs: 900, to: CLEAR },
    ],
    push: { amount: 0.03, untilPhraseId: 13 },
    anchorPhraseId: 36,
    returnPhraseId: 39,
    returnMs: 5000,
  },
  embody: {
    initialGrade: { dim: 0.6, warm: 0, soften: 0, watermark: 0 },
    arrival: { untilPhraseId: 9, breakoutMs: 9000 },
    maxImages: 4,
    imageChanges: [{ phraseId: 18, lead: true }, { phraseId: 24, lead: true }, { phraseId: 33, lead: true }],
    crossfadeMs: 4500,
    grade: [
      { phraseId: 9, lead: true, rampMs: 14000, to: { dim: 0, watermark: 0.12 } },
      { phraseId: 18, lead: true, rampMs: 24000, to: { warm: 0.4 } },
      { phraseId: 24, lead: true, rampMs: 14000, to: { warm: 0.65 } },
      { phraseId: 33, lead: true, rampMs: 12000, to: { warm: 1 } },
      { phraseId: 41, rampMs: 44000, to: { soften: 1, warm: 0.5 } },
      { phraseId: 48, lead: true, rampMs: 1200, to: CLEAR },
    ],
    anchorPhraseId: 48,
    returnPhraseId: 54,
    returnMs: 8000,
  },
};

export type GuidedCaption = { phraseId: number; startMs: number; endMs: number; text: string };

export type GuidedPlan = {
  track: GuidedTrackId;
  guide: GuideId;
  beatMap: BeatMap;
  timeline: CinematicTimeline;
  /** Distinct Vision images the session walks through, in board order; never wraps or revisits. */
  imageCount: number;
  captions: GuidedCaption[];
  anchorStartMs: number;
  /** When the Anchor is fully resolved: the one seal haptic fires here. */
  sealAtMs: number;
  returnStartMs: number;
  durationMs: number;
};

function spread<T>(list: readonly T[], count: number): T[] {
  if (count <= 0) return [];
  if (count >= list.length) return [...list];
  return Array.from({ length: count }, (_, index) => list[Math.floor(((index + 0.5) * list.length) / count)]);
}

export function buildGuidedPlan(params: { durationSeconds: GuidedDurationSeconds; guide: GuideId; imageCount: number }): GuidedPlan {
  if (!Number.isInteger(params.imageCount) || params.imageCount < 1) {
    throw new RangeError('A guided session requires at least one saved Vision image.');
  }
  const track = trackForDuration(params.durationSeconds);
  const plan = TRACK_PLANS[track];
  const beatMap = loadBeatMap(track, params.guide);
  const { durationMs } = beatMap;
  const at = (phraseId: number, lead?: boolean) => Math.max(0, phraseById(beatMap, phraseId).startMs - (lead ? GUIDED_LEAD_MS : 0));
  const silences = silenceSpans(beatMap);
  const longSilences = silences.filter(span => span.durationMs >= SILENCE_LONG_MS);
  // Motion finishes before the next long silence begins, so a long silence never opens on a moving frame.
  const fitMotion = (start: number, plannedMs: number) => {
    const planned = start + plannedMs;
    for (const span of longSilences) {
      if (span.startMs > start + 1500 && span.startMs - MOTION_MARGIN_MS < planned) {
        return Math.max(start + MIN_MOTION_MS, span.startMs - MOTION_MARGIN_MS);
      }
    }
    return planned;
  };

  const anchorStartMs = at(plan.anchorPhraseId, true);
  const returnStartMs = Math.max(at(plan.returnPhraseId, true), anchorStartMs + GUIDED_COMPRESSION_MS + 500);
  const arrivalEndMs = plan.arrival.untilPhraseId != null ? at(plan.arrival.untilPhraseId, true) : plan.arrival.untilMs ?? 0;
  const breakoutEndMs = Math.min(fitMotion(arrivalEndMs, plan.arrival.breakoutMs), anchorStartMs - 500);

  const candidates = plan.imageChanges
    .map(change => ({ ...change, atMs: at(change.phraseId, change.lead) }))
    .filter(change => change.atMs >= breakoutEndMs + 500 && change.atMs + plan.crossfadeMs <= anchorStartMs - 300);
  const used = Math.max(1, Math.min(params.imageCount, plan.maxImages, candidates.length + 1));
  const changes = spread(candidates, used - 1);

  const segments: CinematicSegment[] = [];
  let cursor = 0;
  const push = (kind: CinematicSegment['kind'], endMs: number, imageIndex?: number) => {
    const end = Math.max(cursor, Math.round(endMs));
    segments.push({ kind, startMs: cursor, endMs: end, ...(imageIndex === undefined ? {} : { imageIndex }) });
    cursor = end;
  };
  push('arrival', arrivalEndMs);
  push('breakout', breakoutEndMs, 0);
  changes.forEach((change, index) => {
    push('immersion', change.atMs, index);
    push('transition', change.atMs + plan.crossfadeMs, index + 1);
  });
  push('immersion', anchorStartMs, changes.length);
  push('compression', anchorStartMs + GUIDED_COMPRESSION_MS);
  push('recognition', returnStartMs);
  push('return', Math.min(returnStartMs + plan.returnMs, durationMs - TAIL_HOLD_MS - 500));
  push('carry', durationMs - TAIL_HOLD_MS);
  push('boardHold', durationMs);

  const grade: CinematicGradeKey[] = [{ atMs: 0, ...plan.initialGrade }];
  let current: Omit<CinematicGradeKey, 'atMs'> = { ...plan.initialGrade };
  for (const step of plan.grade) {
    const start = at(step.phraseId, step.lead);
    // A later step interrupts an earlier ramp from wherever that ramp has reached, never after it finishes.
    const reached = cinematicGradeAt({ durationMs, segments: [], grade }, start);
    while (grade.length > 1 && grade[grade.length - 1].atMs > start) grade.pop();
    if (start > grade[grade.length - 1].atMs) grade.push({ atMs: start, ...reached });
    current = { ...reached, ...step.to };
    grade.push({ atMs: start + step.rampMs, ...current });
  }

  const stillness = longSilences
    .map(span => ({ startMs: span.startMs + 600, endMs: span.endMs - 300 }))
    .filter(span => span.endMs - span.startMs > 2000);

  const captions: GuidedCaption[] = [];
  for (const phrase of beatMap.phrases) {
    const inAnchorChapter = phrase.startMs >= anchorStartMs && phrase.startMs < returnStartMs;
    const text = captionFor(phrase.text);
    if (!inAnchorChapter && text) captions.push({ phraseId: phrase.id, startMs: phrase.startMs, endMs: phrase.endMs + CAPTION_TAIL_MS, text });
  }

  return {
    track, guide: params.guide, beatMap, imageCount: used, captions,
    timeline: {
      durationMs, segments, grade, stillness,
      ...(plan.push ? { push: { startMs: breakoutEndMs, endMs: Math.max(breakoutEndMs + 4000, Math.min(at(plan.push.untilPhraseId, true), anchorStartMs - 500)), amount: plan.push.amount } } : {}),
    },
    anchorStartMs, sealAtMs: anchorStartMs + GUIDED_COMPRESSION_MS, returnStartMs, durationMs,
  };
}

export type GuidedResolved = {
  segmentKind: CinematicSegment['kind'];
  imageIndex: number;
  chapter: string | null;
  phraseId: number | null;
  silence: SilenceClass;
  caption: GuidedCaption | null;
};

/** The whole UI follows from `audioPositionMs + plan`. This is the single place that derives it. */
export function resolveGuidedState(plan: GuidedPlan, audioPositionMs: number): GuidedResolved {
  const ms = Math.max(0, Math.min(plan.durationMs, audioPositionMs));
  const segment = plan.timeline.segments.find(item => ms < item.endMs) ?? plan.timeline.segments[plan.timeline.segments.length - 1];
  const imageIndex = segment.kind === 'arrival' || segment.kind === 'breakout' ? 0 :
    segment.kind === 'transition' ? Math.max(0, (segment.imageIndex ?? 1) - 1) :
      segment.kind === 'immersion' ? segment.imageIndex ?? 0 : plan.imageCount - 1;
  const phrases = plan.beatMap.phrases;
  let index = -1;
  for (let i = 0; i < phrases.length && phrases[i].startMs <= ms; i += 1) index = i;
  const phrase = index >= 0 ? phrases[index] : null;
  let silence: SilenceClass = 'none';
  if (phrase && ms >= phrase.endMs) {
    const next = phrases[index + 1];
    silence = classifySilence((next ? next.startMs : plan.durationMs) - phrase.endMs);
  } else if (!phrase) {
    silence = classifySilence(phrases[0]?.startMs ?? 0);
  }
  const caption = plan.captions.find(item => ms >= item.startMs && ms < item.endMs) ?? null;
  return { segmentKind: segment.kind, imageIndex, chapter: phrase?.chapter ?? null, phraseId: phrase?.id ?? null, silence, caption };
}
