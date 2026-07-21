import {
  VISUALIZE_DURATIONS_SECONDS,
  VISUALIZE_PHASE_IDS,
  getVisualizeSessionAudioManifest,
  type VisualizeDurationSeconds,
  type VisualizePhaseId,
} from '@/services/visualizeAudioManifest';

export const VISUALIZATION_DURATIONS_SECONDS = VISUALIZE_DURATIONS_SECONDS;
export type VisualizationDurationSeconds = VisualizeDurationSeconds;

export const VISUALIZATION_PHASE_IDS = VISUALIZE_PHASE_IDS;
export type VisualizationPhaseId = VisualizePhaseId;

export interface VisualizationPhaseSchedule {
  id: VisualizationPhaseId;
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
}

export function buildVisualizationSchedule(
  totalSeconds: VisualizationDurationSeconds
): VisualizationPhaseSchedule[] {
  return getVisualizeSessionAudioManifest(totalSeconds).phases.map(phase => ({ ...phase }));
}

export function getVisualizationPhaseAtElapsed(
  schedule: readonly VisualizationPhaseSchedule[],
  elapsedSeconds: number
): VisualizationPhaseSchedule {
  const clamped = Math.max(0, elapsedSeconds);
  return (
    schedule.find(phase => clamped < phase.endSeconds) ??
    schedule[schedule.length - 1]
  );
}

export function getVisualizationPhaseProgress(
  phase: VisualizationPhaseSchedule,
  elapsedSeconds: number
): number {
  return Math.max(
    0,
    Math.min(1, (elapsedSeconds - phase.startSeconds) / Math.max(1, phase.durationSeconds))
  );
}
