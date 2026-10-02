import { useDerivedValue } from 'react-native-reanimated';
import type {
  ChartMapAnimState,
  SequenceEasing,
  SequenceStep,
  WaypointPlacement,
} from './chartMapContracts';
import { OVERVIEW_CAMERA, cameraTargetFor, clampCamera } from './chartMapGeometry';

/** Prototype camFor scale (waypoint focus). */
export const FOCUS_SCALE = 1.45;
/** Open sequence lands on the current waypoint at this scale. */
export const OPEN_SCALE = 1.3;
export { OVERVIEW_CAMERA };

export type CameraTarget = { cx: number; cy: number; s: number };

/** Camera target framing waypoint `index` (prototype camFor: cy = y + 30). */
export function focusTarget(placement: WaypointPlacement, index: number, scale: number = FOCUS_SCALE): CameraTarget {
  const i = Math.min(placement.points.length - 1, Math.max(0, index));
  return cameraTargetFor(placement.points[i], scale);
}

/** Overview target (prototype camHome). */
export function overviewTarget(): CameraTarget {
  return { cx: OVERVIEW_CAMERA.cx, cy: OVERVIEW_CAMERA.cy, s: OVERVIEW_CAMERA.s };
}

/** Three parallel tween steps (cx, cy, s) for the sequence engine. */
export function cameraSteps(
  anim: ChartMapAnimState,
  target: CameraTarget,
  at: number,
  duration: number,
  easing: SequenceEasing = 'inOut',
): SequenceStep[] {
  const { cx, cy, s } = anim.camera;
  return [
    { kind: 'tween', at, duration, easing, target: cx, to: target.cx },
    { kind: 'tween', at, duration, easing, target: cy, to: target.cy },
    { kind: 'tween', at, duration, easing, target: s, to: target.s },
  ];
}

/** Imperative jump (reduced motion, initial placement). JS thread only. */
export function setCamera(anim: ChartMapAnimState, target: CameraTarget): void {
  anim.camera.cx.value = target.cx;
  anim.camera.cy.value = target.cy;
  anim.camera.s.value = target.s;
}

/**
 * One camera matrix for every map layer (prototype applyCam): translate(tx, ty)
 * then scale(s * k), in view pixels, applied to content drawn in the 852 x 1180
 * design space. Shared by the land and overlay canvases.
 */
export function useChartMapCameraTransform(anim: ChartMapAnimState, width: number, height: number) {
  return useDerivedValue(() => {
    const s = anim.camera.s.value;
    const c = clampCamera(anim.camera.cx.value, anim.camera.cy.value, s, width, height);
    return [{ translateX: c.tx }, { translateY: c.ty }, { scale: s * c.k }];
  });
}
