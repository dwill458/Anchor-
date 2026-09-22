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

export const V2_VISUALIZE_DURATIONS = [60, 180, 300] as const;
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
  kenBurnsFrom: 1.02,
  kenBurnsTo: 1.06,
  crossfadeMs: 2600,
  reducedCrossfadeMs: 1400,
  openingDelayMs: 1400,
  openingHoldMs: 6800,
  textFadeMs: 1200,
  promptHoldMs: 5200,
  controlsIdleMs: 4000,
  /** Setup fades to darkness before the session opens on the first image. */
  handoffMs: 480,
  /** The first image rises out of that darkness. */
  openingRevealMs: 1600,
  /**
   * SEE -> REINFORCE. The final image holds, quiets, and is drawn in toward
   * its centre while the Anchor sharpens out of the same centre; for a moment
   * both are present, then only the Anchor remains. The transformation itself
   * (transformAtMs -> anchor fully present) is ~2.2s.
   */
  ending: {
    chromeOutMs: 500,
    /** The final image holds, Ken Burns easing to rest. */
    settleMs: 1200,
    transformAtMs: 1200,
    /** Desaturate, darken, soften. */
    quietMs: 1400,
    /** The Vision is drawn inward: scale 1 -> compressTo, corners rounding. */
    compressAtMs: 1300,
    compressMs: 2100,
    compressTo: 0.58,
    photoOutAtMs: 1900,
    photoOutMs: 1500,
    anchorAtMs: 1600,
    /** Anchor opacity keyframes after `anchorAtMs`: 0 -> 0.25 -> 0.6 -> 1. */
    anchorStepsMs: [500, 600, 700] as const,
    anchorFromScale: 1.1,
    lineAtMs: 4000,
    continueAtMs: 5200,
    fadeInMs: 900,
  },
  reducedEnding: {
    chromeOutMs: 300,
    crossAtMs: 900,
    crossMs: 1600,
    lineAtMs: 3000,
    continueAtMs: 4000,
    fadeInMs: 700,
  },
} as const;

/**
 * How a Vision image fills the portrait session. Portrait-first images fill
 * the screen with only a sliver cropped. Images far wider than the screen
 * (older square sets, landscape uploads) are not cut down to a narrow strip:
 * they are scaled only as far as `maxOverscan` beyond "fit", and a soft
 * extension of the same image fills the rest.
 */
export function visionImageFit(
  image: { width: number; height: number } | null | undefined,
  frame: { width: number; height: number },
  maxOverscan = 1.25,
): { width: number; height: number; left: number; top: number; extended: boolean } {
  if (!image || image.width <= 0 || image.height <= 0) {
    return { width: frame.width, height: frame.height, left: 0, top: 0, extended: false };
  }
  const cover = Math.max(frame.width / image.width, frame.height / image.height);
  const contain = Math.min(frame.width / image.width, frame.height / image.height);
  const scale = Math.min(cover, contain * maxOverscan);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    width, height,
    left: (frame.width - width) / 2,
    top: (frame.height - height) / 2,
    extended: scale < cover - 1e-6,
  };
}

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
  if (durationSeconds <= 180) return Math.min(images, 5);
  if (images === 1) return 1;
  return Math.min(Math.max(images, 5), images * 2);
}

export function buildVisionSceneSchedule(durationSeconds: number, imageCount: number): VisionSceneSlot[] {
  const totalMs = Math.max(1, durationSeconds) * 1000;
  const images = Math.max(1, Math.floor(imageCount));
  const slots = visionSceneSlotCount(durationSeconds, images);
  const slotMs = totalMs / slots;
  return Array.from({ length: slots }, (_, index) => ({
    index,
    imageIndex: index % images,
    startMs: Math.round(index * slotMs),
    endMs: index === slots - 1 ? totalMs : Math.round((index + 1) * slotMs),
  }));
}

export function visionSceneSlotAt(schedule: VisionSceneSlot[], elapsedMs: number): VisionSceneSlot {
  return schedule.find(slot => elapsedMs < slot.endMs) ?? schedule[schedule.length - 1];
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
