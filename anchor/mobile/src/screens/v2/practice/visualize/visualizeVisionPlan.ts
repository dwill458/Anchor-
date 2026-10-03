/**
 * Pure planning for the immersive Visualize session: which Vision image is on
 * screen when, when the sparse reflection prompts appear, how the ending is
 * timed, and the scene snapshot the completion record carries.
 */
import {
  buildFallbackSceneSuggestions,
  normalizeVisualizationSceneText,
  VISUALIZATION_SCENE_MAX_LENGTH,
} from '@/services/VisualizationSceneService';
import { Image } from 'react-native';
import type { Anchor } from '@/types';

export const V2_VISUALIZE_DURATIONS = [60, 180, 600] as const;
export type V2VisualizeDuration = (typeof V2_VISUALIZE_DURATIONS)[number];

export function isV2VisualizeDuration(value: number): value is V2VisualizeDuration {
  return (V2_VISUALIZE_DURATIONS as readonly number[]).includes(value);
}

/**
 * Every duration in the session, in one place. Ceremonial moments run longer
 * than an HTML prototype would suggest because they read faster on a device.
 * Ending offsets are measured from the moment the timer reaches zero.
 */
export const V2_VISUALIZE_TIMING = {
  openingDelayMs: 1400,
  openingHoldMs: 6800,
  textFadeMs: 1200,
  promptHoldMs: 5200,
  controlsIdleMs: 4000,
  /** Setup fades to darkness before the session opens on the board. */
  handoffMs: 480,
  /** The board rises out of that darkness. */
  openingRevealMs: 1600,
  /**
   * The camera over the Vision board. The session opens on the Anchor card,
   * pushes in slightly, then glides photograph to photograph; each glide is
   * 1.2-1.8s depending on distance, then the camera holds with a barely
   * perceptible push while the person stays with the scene.
   */
  board: {
    /** Scene layout scale; the deepest zoom stays sharp. */
    renderScale: 2.6,
    /** Opening on the Anchor before the first photograph. */
    openingAnchorMs: 7000,
    openingPush: 1.05,
    travelMinMs: 1200,
    travelMaxMs: 1800,
    /** Drift during a hold, as a scale multiple. */
    holdPush: 1.035,
    /** A photograph fills this much of the screen (the tighter axis wins). */
    photoFill: 0.86,
    anchorFill: 0.72,
    /** Zoom limits relative to the whole-board view. */
    minZoom: 1.6,
    maxZoom: 3,
    /** A short session still gives every photograph this long. */
    minDwellMs: 8000,
    /** Reduce Motion: a quiet dip between photographs instead of travel. */
    reducedDipOutMs: 500,
    reducedDipInMs: 800,
  },
  /**
   * SEE -> REINFORCE. The camera pulls back to reveal the whole board, holds,
   * then settles around the Anchor at its centre while the edges quiet.
   */
  ending: {
    chromeOutMs: 500,
    pullBackMs: 2600,
    settleAtMs: 3300,
    settleMs: 2200,
    /** The finale frames the Anchor card at this multiple of the whole-board zoom. */
    settleZoom: 1.45,
    quietAtMs: 3000,
    quietMs: 1800,
    lineAtMs: 5000,
    continueAtMs: 6200,
    fadeInMs: 900,
  },
  reducedEnding: {
    chromeOutMs: 300,
    crossAtMs: 600,
    crossMs: 1400,
    lineAtMs: 2400,
    continueAtMs: 3200,
    fadeInMs: 700,
  },
} as const;

/** Warm the image cache ahead of a transition. Fire-and-forget; failures are harmless. */
export function preloadVisionImages(uris: string[]): void {
  if (typeof Image.prefetch !== 'function') return;
  for (const uri of uris) {
    try { void Promise.resolve(Image.prefetch(uri)).catch(() => undefined); } catch { /* ignore */ }
  }
}

export type VisionSceneSlot = { index: number; imageIndex: number; startMs: number; endMs: number };

/**
 * How many scene slots a duration holds for a number of selected images.
 * Short sessions show fewer scenes so each can actually be seen; five
 * minutes revisits scenes rather than stretching one image for a minute+.
 */
export function visionSceneSlotCount(durationSeconds: number, imageCount: number): number {
  const images = Math.max(1, Math.floor(imageCount));
  if (durationSeconds <= 60) return Math.min(images, 2);
  if (durationSeconds <= 180) return Math.min(images, 6);
  if (images === 1) return 1;
  return Math.min(Math.max(images, 5), images * 2);
}

export function visionSceneSlotAt(schedule: VisionSceneSlot[], elapsedMs: number): VisionSceneSlot {
  return schedule.find(slot => elapsedMs < slot.endMs) ?? schedule[schedule.length - 1];
}

/**
 * The camera's visits across the Vision board. The session opens on the
 * Anchor for `openingMs`; the rest of the duration is shared between
 * photographs. A short session visits every photograph it can give at least
 * `minDwellMs`; three minutes visits each once; five minutes revisits, as
 * `visionSceneSlotCount` always has.
 */
export function buildBoardVisitSchedule(
  durationSeconds: number,
  imageCount: number,
  openingMs: number = V2_VISUALIZE_TIMING.board.openingAnchorMs,
  minDwellMs: number = V2_VISUALIZE_TIMING.board.minDwellMs,
): VisionSceneSlot[] {
  const images = Math.max(0, Math.floor(imageCount));
  const totalMs = Math.max(1, durationSeconds) * 1000;
  if (images === 0) return [];
  const start = Math.min(openingMs, totalMs * 0.25);
  const available = totalMs - start;
  const visits = durationSeconds <= 60
    ? Math.max(1, Math.min(images, Math.floor(available / minDwellMs)))
    : visionSceneSlotCount(durationSeconds, images);
  const slotMs = available / visits;
  return Array.from({ length: visits }, (_, index) => ({
    index,
    imageIndex: index % images,
    startMs: Math.round(start + index * slotMs),
    endMs: index === visits - 1 ? totalMs : Math.round(start + (index + 1) * slotMs),
  }));
}

export type VisualizeReflectionPrompt = { id: string; atMs: number; text: string };

/** Sparse by design: long stretches show nothing but the Vision. */
export function visualizeReflectionPrompts(durationSeconds: number): VisualizeReflectionPrompt[] {
  if (durationSeconds <= 60) return [{ id: 'different', atMs: 30_000, text: 'Notice what’s different.' }];
  if (durationSeconds <= 180) return [
    { id: 'around', atMs: 42_000, text: 'What can you see around you?' },
    { id: 'different', atMs: 98_000, text: 'Notice what’s different.' },
    { id: 'stay', atMs: 150_000, text: 'Stay with the scene.' },
  ];
  return [
    { id: 'around', atMs: 48_000, text: 'What can you see around you?' },
    { id: 'different', atMs: 115_000, text: 'Notice what’s different.' },
    { id: 'feel', atMs: 182_000, text: 'How does it feel to be here?' },
    { id: 'stay', atMs: 250_000, text: 'Stay with the scene.' },
  ];
}

export function visualizePromptAt(prompts: VisualizeReflectionPrompt[], elapsedMs: number): VisualizeReflectionPrompt | null {
  return prompts.find(prompt => elapsedMs >= prompt.atMs && elapsedMs < prompt.atMs + V2_VISUALIZE_TIMING.promptHoldMs) ?? null;
}

// Mirrors backend `validateVisualizationScene` (services/VisualizationSceneService.ts):
// a Visualize completion without a snapshot that passes these rules is rejected.
const UNSUPPORTED_DETAIL_PATTERN =
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december|tomorrow|next week|at my company|executive meeting|my boss|my coworker|my partner|my spouse|at the office|at school|at the hospital|at the airport|at the restaurant)\b/i;
const INVENTED_PROPER_NAME_PATTERN = /\b(?:meet|tell|ask|call|with)\s+[A-Z][a-z]{2,}\b/;
const FIRST_PERSON_PATTERN = /\b(?:I|I'm|my|me|myself)\b/i;

function sentenceCount(value: string): number {
  return value.split(/[.!?]+/).map(part => part.trim()).filter(Boolean).length;
}

export function isValidVisualizeSceneSnapshot(value: string): boolean {
  const normalized = normalizeVisualizationSceneText(value);
  if (!normalized || normalized.length > VISUALIZATION_SCENE_MAX_LENGTH) return false;
  if (UNSUPPORTED_DETAIL_PATTERN.test(normalized) || INVENTED_PROPER_NAME_PATTERN.test(normalized)) return false;
  if (!FIRST_PERSON_PATTERN.test(normalized)) return false;
  const count = sentenceCount(normalized);
  return count >= 1 && count <= 2;
}

/** First sentence of the Vision, shortened at a word boundary to fit the record. */
function leadSentence(description: string): string {
  const normalized = normalizeVisualizationSceneText(description);
  const first = normalized.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? normalized;
  let sentence = first.replace(/[.!?]+$/, '');
  const limit = VISUALIZATION_SCENE_MAX_LENGTH - 1;
  if (sentence.length > limit) {
    sentence = sentence.slice(0, limit);
    const lastSpace = sentence.lastIndexOf(' ');
    if (lastSpace > 40) sentence = sentence.slice(0, lastSpace);
    sentence = sentence.replace(/[\s,;:–—-]+(?:and|or|but|with|to|the|a|an|of)?$/i, '').replace(/[\s,;:–—-]+$/, '');
  }
  return sentence ? `${sentence}.` : '';
}

/**
 * The scene the completion record carries. It is the person's own Vision
 * where that satisfies the backend contract, and the deterministic Anchor
 * scene otherwise, so a real completion is never rejected for its wording.
 */
export function buildVisionSceneSnapshot(
  description: string | null | undefined,
  anchor: Pick<Anchor, 'category'> & { intentionText?: string },
): string {
  const lead = leadSentence(description ?? '');
  if (lead && isValidVisualizeSceneSnapshot(lead)) return lead;
  return buildFallbackSceneSuggestions(anchor)[0];
}
