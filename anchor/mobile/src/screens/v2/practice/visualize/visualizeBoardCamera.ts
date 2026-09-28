/**
 * The Visualize camera path over the Vision board, planned up front so the
 * session only ever issues one timed move per phase (no per-frame JS).
 *
 *   opening   - on the Anchor card, pushing in slightly
 *   visit i   - glide to photograph i (1.2-1.8s by distance), then hold with
 *               a barely perceptible push until the visit ends
 *   ending    - (after the timer) pull back to the whole board, then settle
 *               around the Anchor
 */
import {
  cameraTravelMs, focusCamera, restCamera, type CameraState,
} from '@/components/v2/vision/board/visionBoardCamera';
import type { SceneRect, Size } from '@/components/v2/vision/board/visionBoardLayouts';
import { V2_VISUALIZE_TIMING, type VisionSceneSlot } from './visualizeVisionPlan';

const B = V2_VISUALIZE_TIMING.board;

export type VisualizeCameraVisit = VisionSceneSlot & {
  travelMs: number;
  /** Where the glide arrives. */
  target: CameraState;
  /** Where the hold drifts to by the end of the visit. */
  drift: CameraState;
};

export type VisualizeCameraPlan = {
  openingEndMs: number;
  anchor: CameraState;
  anchorPush: CameraState;
  visits: VisualizeCameraVisit[];
  rest: CameraState;
  finale: CameraState;
};

function pushed(state: CameraState, factor: number): CameraState {
  return { ...state, scale: state.scale * factor };
}

export function planVisualizeCamera(input: {
  schedule: VisionSceneSlot[];
  /** Photo rects by image index, in scene px. */
  photoRects: SceneRect[];
  cardRect: SceneRect;
  scene: Size;
  viewport: Size;
}): VisualizeCameraPlan {
  const { schedule, photoRects, cardRect, scene, viewport } = input;
  const rest = restCamera(scene, viewport, 12);
  const baseOptions = { minZoom: B.minZoom, maxZoom: B.maxZoom, clamp: false } as const;
  const anchor = focusCamera(cardRect, scene, viewport, { ...baseOptions, fill: B.anchorFill });
  const anchorPush = pushed(anchor, B.openingPush);
  let previous = anchorPush;
  const visits = schedule.map(slot => {
    const rect = photoRects[slot.imageIndex] ?? cardRect;
    const target = focusCamera(rect, scene, viewport, { ...baseOptions, fill: B.photoFill });
    const available = Math.max(0, slot.endMs - slot.startMs);
    const travelMs = Math.min(cameraTravelMs(previous, target, viewport, B.travelMinMs, B.travelMaxMs), Math.round(available * 0.5));
    const drift = pushed(target, B.holdPush);
    previous = drift;
    return { ...slot, travelMs, target, drift };
  });
  const finale = { x: anchor.x, y: anchor.y, scale: rest.scale * V2_VISUALIZE_TIMING.ending.settleZoom };
  return { openingEndMs: schedule[0]?.startMs ?? Number.POSITIVE_INFINITY, anchor, anchorPush, visits, rest, finale };
}

export type VisualizeCameraPhase =
  | { kind: 'opening'; key: 'opening'; to: CameraState; remainingMs: number }
  | { kind: 'travel'; key: string; visit: VisualizeCameraVisit; remainingTravelMs: number; remainingHoldMs: number }
  | { kind: 'hold'; key: string; visit: VisualizeCameraVisit; remainingMs: number };

/**
 * Where the camera should be heading at `elapsedMs`, and how long it has.
 * Used when a phase begins and when a paused session resumes, so the camera
 * always continues from where it stopped towards where it belongs.
 */
export function visualizeCameraPhaseAt(plan: VisualizeCameraPlan, elapsedMs: number): VisualizeCameraPhase {
  if (!plan.visits.length || elapsedMs < plan.openingEndMs) {
    const end = plan.visits.length ? plan.openingEndMs : Number.POSITIVE_INFINITY;
    return { kind: 'opening', key: 'opening', to: plan.anchorPush, remainingMs: Math.max(0, Math.min(end, 600_000) - elapsedMs) };
  }
  const visit = plan.visits.find(item => elapsedMs < item.endMs) ?? plan.visits[plan.visits.length - 1];
  const intoVisit = Math.max(0, elapsedMs - visit.startMs);
  const holdMs = Math.max(0, visit.endMs - visit.startMs - visit.travelMs);
  if (intoVisit < visit.travelMs) {
    return { kind: 'travel', key: `visit-${visit.index}`, visit, remainingTravelMs: visit.travelMs - intoVisit, remainingHoldMs: holdMs };
  }
  return { kind: 'hold', key: `visit-${visit.index}`, visit, remainingMs: Math.max(0, visit.endMs - elapsedMs) };
}
