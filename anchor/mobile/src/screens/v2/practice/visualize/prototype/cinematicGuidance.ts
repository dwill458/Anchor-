import type { CinematicSegment, CinematicTimeline } from './cinematicTimeline';

export type TimedCinematicGuidance = { atMs: number; endMs: number; text: string };
export type CinematicGuidanceWindow = { startMs: number; endMs: number };
export type CinematicGuidanceOptions = {
  /** A recorded cue already owns this interval, so saved-content text stays silent there. */
  recordingWindows?: readonly CinematicGuidanceWindow[];
  /** Optional intentional silence spans for other sound or reflection cues. */
  silentWindows?: readonly CinematicGuidanceWindow[];
};

export const CINEMATIC_GUIDANCE_FALLBACK = 'Stay with this moment.';
export const CINEMATIC_FEELING_COPY = 'Hold the feeling.';
export const CINEMATIC_CARRY_COPY = 'Carry it with you.';

const MAX_GUIDANCE_CHARS = 80;
const MIN_GUIDANCE_WORDS = 3;
const PREFERRED_MAX_GUIDANCE_WORDS = 8;
const MAX_GUIDANCE_WORDS = 10;
const UNSAFE_GUIDANCE = [
  /\b(?:system|developer|negative)\s+prompt\s*:/i,
  /\bprompt\s*:/i,
  /\b(?:ignore|disregard|override)\s+(?:(?:all|any|the)\s+)?(?:previous|prior|system|developer|user)?\s*instructions?\b/i,
  /^\s*(?:please\s+)?(?:generate|create|draw|render|paint|illustrate|depict|make\s+(?:an?\s+)?(?:image|picture)|show\s+(?:me\s+)?(?:an?\s+)?(?:image|picture)|include|exclude|add\s+(?:text|labels|watermarks)|negative\s+prompt)\b/i,
  /^\s*the\s+image\s+should\s+(?:show|depict|include|contain|feature)\b/i,
  /^\s*use\s+(?:cinematic|dramatic|soft|natural|studio|golden[- ]hour)\s+(?:lighting|light)\b/i,
  /^\s*aspect\s+ratio\s+is\s+\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?\s*\.?\s*$/i,
];

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function completeThoughts(savedContent: string) {
  const sentences = savedContent.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [];
  const seen = new Set<string>();
  return sentences
    .map(sentence => sentence.trim().replace(/\s+/g, ' '))
    .filter(sentence => sentence.length <= MAX_GUIDANCE_CHARS)
    .filter(sentence => wordCount(sentence) >= MIN_GUIDANCE_WORDS && wordCount(sentence) <= MAX_GUIDANCE_WORDS)
    .filter(sentence => !UNSAFE_GUIDANCE.some(pattern => pattern.test(sentence)))
    .filter(sentence => {
      const key = sentence.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function immersionSegments(timeline: CinematicTimeline) {
  return timeline.segments.filter(segment => segment.kind === 'immersion');
}

function isSuppressed(startMs: number, endMs: number, windows: readonly CinematicGuidanceWindow[]) {
  return windows.some(window => startMs < window.endMs && endMs > window.startMs);
}

function cueDurationMs(text: string) {
  // 400ms per word keeps ten-word thoughts under the two-line display budget.
  return Math.max(3000, wordCount(text) * 400);
}

function segmentAtImmersionOffset(segments: CinematicSegment[], offsetMs: number) {
  let elapsed = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const duration = segment.endMs - segment.startMs;
    if (offsetMs < elapsed + duration || index === segments.length - 1) {
      return { segment, offsetInSegment: Math.min(duration, Math.max(0, offsetMs - elapsed)), duration };
    }
    elapsed += duration;
  }
  const segment = segments[segments.length - 1];
  return { segment, offsetInSegment: segment.endMs - segment.startMs, duration: segment.endMs - segment.startMs };
}

function cueInImmersion(
  text: string,
  segments: CinematicSegment[],
  cueIndex: number,
  cueCount: number,
  totalImmersionMs: number,
): TimedCinematicGuidance | null {
  const targetCenter = ((cueIndex + 0.5) / cueCount) * totalImmersionMs;
  const { segment, offsetInSegment, duration } = segmentAtImmersionOffset(segments, targetCenter);
  const cueMs = cueDurationMs(text);
  if (duration < cueMs) return null;
  const center = segment.startMs + offsetInSegment;
  const atMs = Math.max(segment.startMs, Math.min(segment.endMs - cueMs, Math.round(center - cueMs / 2)));
  return { atMs, endMs: atMs + cueMs, text };
}

/**
 * Schedules only complete, short sentences from the saved Vision description during image immersion.
 * It never reads image-generation prompts, invents scene facts, or assigns text to a specific image.
 */
export function buildCinematicGuidance(
  savedVisionDescription: string | null | undefined,
  timeline: CinematicTimeline,
  options: CinematicGuidanceOptions = {},
): TimedCinematicGuidance[] {
  const segments = immersionSegments(timeline);
  if (segments.length === 0) return [];

  const usable = typeof savedVisionDescription === 'string' ? completeThoughts(savedVisionDescription) : [];
  const preferred = usable.filter(thought => wordCount(thought) <= PREFERRED_MAX_GUIDANCE_WORDS);
  const sourceThoughts = preferred.length > 0
    ? [...preferred, ...usable.filter(thought => wordCount(thought) > PREFERRED_MAX_GUIDANCE_WORDS)]
    : usable;
  const availableThoughts = sourceThoughts.length > 0 ? sourceThoughts : [CINEMATIC_GUIDANCE_FALLBACK];
  // One distinct thought per minute: longer sessions deepen observation without inventing or repeating text.
  const cueCount = Math.min(availableThoughts.length, Math.max(1, Math.floor(timeline.durationMs / 60_000)));
  const totalImmersionMs = segments.reduce((total, segment) => total + segment.endMs - segment.startMs, 0);
  const reserved = [...(options.recordingWindows ?? []), ...(options.silentWindows ?? [])];
  const cues: TimedCinematicGuidance[] = [];

  for (let index = 0; index < cueCount; index += 1) {
    const cue = cueInImmersion(availableThoughts[index], segments, index, cueCount, totalImmersionMs);
    if (cue && !isSuppressed(cue.atMs, cue.endMs, reserved)) cues.push(cue);
  }
  return cues;
}

/** Returns display-only guidance while an immersion cue is active; null means deliberate silence. */
export function cinematicGuidanceAt(
  guidance: TimedCinematicGuidance[],
  elapsedMs: number,
): TimedCinematicGuidance | null {
  'worklet';
  for (let index = 0; index < guidance.length; index += 1) {
    const cue = guidance[index];
    if (elapsedMs >= cue.atMs && elapsedMs < cue.endMs) return cue;
  }
  return null;
}
