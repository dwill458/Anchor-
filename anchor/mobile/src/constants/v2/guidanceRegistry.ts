import type { BeatId } from './teachingCopy';

// Content and contextual predicates stay with the existing feature hosts. Only the
// currently approved surfaces participate; weekly education remains separate.
export const GUIDANCE_REGISTRY = [
  { id: 'thread.glow', beat: null, priority: 0, surface: 'scene_line', maxAttempts: Number.MAX_SAFE_INTEGER },
  { id: 'home.thread_glow', beat: 'home.glow', priority: 1, surface: 'bubble', maxAttempts: 3, followThrough: true },
  { id: 'home.progress_moved', beat: 'home.thread', priority: 1, surface: 'bubble', maxAttempts: 3, followThrough: true },
  { id: 'home.swipe_anchors', beat: 'home.swipe', priority: 1, surface: 'bubble', maxAttempts: 3, followThrough: true },
  { id: 'today.recommended', beat: 'home.today', priority: 1, surface: 'bubble', maxAttempts: 3, maxDisplays: 2, repeatWithinMs: 24 * 60 * 60 * 1000 },
  { id: 'home.open_anchor', beat: 'home.anchor', priority: 1, surface: 'bubble', maxAttempts: 3, followThrough: true },
  { id: 'home.progress_section', beat: 'home.progress', priority: 1, surface: 'bubble', maxAttempts: 3, followThrough: true },
  { id: 'home.create_anchor', beat: 'home.create', priority: 1, surface: 'bubble', maxAttempts: 3, followThrough: true },
  { id: 'details.vision_chart', beat: 'details.vision', priority: 1, surface: 'bubble', maxAttempts: 3, followThrough: true },
  { id: 'details.chart_next', beat: 'details.chart', priority: 1, surface: 'bubble', maxAttempts: 3, followThrough: true },
  { id: 'practice.switch_anchor', beat: 'practice.switch', priority: 2, surface: 'bubble', maxAttempts: 2 },
  { id: 'vision.first_photo', beat: 'vision.first', priority: 1, surface: 'whisper', maxAttempts: 3 },
  { id: 'vision.lead_image', beat: 'vision.second', priority: 1, surface: 'bubble', maxAttempts: 3 },
  { id: 'chart.next_move', beat: null, priority: 0, surface: 'bubble', maxAttempts: 3 },
  { id: 'progress.levels', beat: 'progress.thread', priority: 2, surface: 'bubble', maxAttempts: 2 },
] as const;
export type GuidanceId = typeof GUIDANCE_REGISTRY[number]['id'];
export type GuidanceDefinition = typeof GUIDANCE_REGISTRY[number] & { maxDisplays?: number; repeatWithinMs?: number; followThrough?: boolean };
export function guidanceForBeat(beat: BeatId) {
  return GUIDANCE_REGISTRY.find(def => def.beat === beat);
}
