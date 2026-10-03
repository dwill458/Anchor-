import { useMemo } from 'react';
import {
  DRAWN_FORGET_SECONDS,
  SEGMENT_TIMES,
  type CreationMode,
} from './creationFlowConfig';

export interface CreationTimelineInput {
  mode: CreationMode;
  /** Number of distilled letters. */
  n: number;
  drawn: boolean;
}

export interface CreationTimeline {
  /** Durations in seconds. */
  handoff: number;
  distill: number;
  map: number;
  forget: number;
  stillness: number;
  formMin: number;
  sweep: number;
  /** Absolute start (seconds from the Continue tap) of each pre-Style segment. */
  start: { distill: number; map: number; forget: number; stillness: number };
  /** When the raw geometry is fully on screen (end of Forget). */
  rawGeometryAt: number;
  /** When Style opens (after the stillness beat). */
  styleAt: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export function buildCreationTimeline({ mode, n, drawn }: CreationTimelineInput): CreationTimeline {
  const t = SEGMENT_TIMES[mode];
  const letters = Math.max(0, Math.floor(n));

  const handoff = t.handoff;
  const distill = drawn ? 0 : t.distill;
  const map = drawn ? 0 : round(clamp(t.map.base + t.map.perLetter * letters, t.map.min, t.map.max));
  const forget = drawn ? DRAWN_FORGET_SECONDS[mode] : t.forget;

  const distillStart = handoff;
  const mapStart = distillStart + distill;
  const forgetStart = mapStart + map;
  const stillnessStart = forgetStart + forget;

  return {
    handoff,
    distill,
    map,
    forget,
    stillness: t.stillness,
    formMin: t.formMin,
    sweep: t.sweep,
    start: { distill: distillStart, map: mapStart, forget: forgetStart, stillness: stillnessStart },
    rawGeometryAt: round(stillnessStart),
    styleAt: round(stillnessStart + t.stillness),
  };
}

export function useCreationTimeline(input: CreationTimelineInput): CreationTimeline {
  const { mode, n, drawn } = input;
  return useMemo(() => buildCreationTimeline({ mode, n, drawn }), [mode, n, drawn]);
}

/**
 * Timeline instants (seconds from Continue) at which each letter lands in Map — 42% through its
 * slot. One `letter-drop` and one light haptic fire at each, never more often than the haptic floor.
 */
export function mapLetterEventTimes(timeline: CreationTimeline, letterCount: number): number[] {
  if (letterCount <= 0 || timeline.map <= 0) return [];
  const intro = Math.min(0.6, timeline.map * 0.12);
  const slot = (timeline.map - intro) / letterCount;
  return Array.from({ length: letterCount }, (_, i) => round(timeline.start.map + intro + i * slot + slot * 0.42));
}
