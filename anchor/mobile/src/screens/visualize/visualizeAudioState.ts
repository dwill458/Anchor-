import type { VisualizeCueDefinition } from '@/services/visualizeAudioManifest';

export const VISUALIZE_AMBIENT_LEVELS = {
  guidedResting: 0.34,
  guidedDucked: 0.21,
  ambientOnly: 0.5,
} as const;

export function getNextDueVisualizeCue(
  cues: readonly VisualizeCueDefinition[],
  elapsedMs: number,
  handledCueIds: ReadonlySet<string>,
): VisualizeCueDefinition | null {
  return cues.find(cue => cue.startSeconds * 1_000 <= elapsedMs && !handledCueIds.has(cue.id)) ?? null;
}

export function getNextUnhandledVisualizeCue(
  cues: readonly VisualizeCueDefinition[],
  handledCueIds: ReadonlySet<string>,
): VisualizeCueDefinition | null {
  return cues.find(cue => !handledCueIds.has(cue.id)) ?? null;
}

export function getVisualizeAmbientRestingVolume(hasVoiceGuidance: boolean): number {
  return hasVoiceGuidance
    ? VISUALIZE_AMBIENT_LEVELS.guidedResting
    : VISUALIZE_AMBIENT_LEVELS.ambientOnly;
}

export function getVisualizeFinalFadeRemainingMs(
  durationSeconds: number,
  fadeOutMs: number,
  elapsedMs: number,
): number | null {
  const sessionEndMs = durationSeconds * 1_000;
  const fadeStartMs = sessionEndMs - fadeOutMs;
  if (elapsedMs < fadeStartMs) return null;
  return Math.max(0, sessionEndMs - elapsedMs);
}

