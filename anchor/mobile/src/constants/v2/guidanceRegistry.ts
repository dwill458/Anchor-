import type { BeatId } from './teachingCopy';

// Content and contextual predicates stay with the existing feature hosts. Only the
// currently approved surfaces participate; weekly education remains separate.
export const GUIDANCE_REGISTRY = [
  { id: 'thread.glow', beat: null, priority: 0, surface: 'scene_line', maxAttempts: Number.MAX_SAFE_INTEGER },
  { id: 'today.recommended', beat: 'home.today', priority: 1, surface: 'bubble', maxAttempts: 3, maxDisplays: 2, repeatWithinMs: 24 * 60 * 60 * 1000 },
  { id: 'practice.switch_anchor', beat: 'practice.switch', priority: 2, surface: 'bubble', maxAttempts: 2 },
  { id: 'vision.first_photo', beat: 'vision.first', priority: 1, surface: 'whisper', maxAttempts: 3 },
  { id: 'vision.lead_image', beat: 'vision.second', priority: 1, surface: 'bubble', maxAttempts: 3 },
  { id: 'chart.next_move', beat: null, priority: 0, surface: 'bubble', maxAttempts: 3 },
  { id: 'progress.levels', beat: 'progress.thread', priority: 2, surface: 'bubble', maxAttempts: 2 },
] as const;
export type GuidanceId = typeof GUIDANCE_REGISTRY[number]['id'];
export type GuidanceDefinition = typeof GUIDANCE_REGISTRY[number] & { maxDisplays?: number; repeatWithinMs?: number };
export function guidanceForBeat(beat: BeatId) {
  return GUIDANCE_REGISTRY.find(def => def.beat === beat);
}
