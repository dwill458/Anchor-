/**
 * The virtual camera over the Vision board.
 *
 * The whole board is one scene view laid out at `scene` size and centred in a
 * `viewport`. The camera is three numbers:
 *   x, y  - the scene point (relative to the scene's centre, scene px) that
 *           sits at the centre of the viewport
 *   scale - how large the scene is drawn
 * and is applied as a single transform on the scene's parent:
 *   translateX = -scale * x, translateY = -scale * y, scale
 * (the view's transform origin is its centre). Board objects never move for
 * the camera; only this transform does.
 *
 * Every function here is a pure worklet, so gestures and camera animations
 * can use them on the UI thread and tests can use them in Node.
 */
import type { SceneRect, Size } from './visionBoardLayouts';

export type CameraState = { x: number; y: number; scale: number };

/** The whole board, as large as fits the viewport. */
export function restCamera(scene: Size, viewport: Size, margin = 0): CameraState {
  'worklet';
  const scale = Math.min((viewport.width - margin * 2) / scene.width, (viewport.height - margin * 2) / scene.height);
  return { x: 0, y: 0, scale };
}

/**
 * Keeps the board covering the viewport wherever it can: a zoomed camera never
 * reveals empty space past the board's edge on an axis where the scaled board
 * is larger than the viewport, and centres the board on an axis where it is
 * not.
 */
export function clampCamera(state: CameraState, scene: Size, viewport: Size): CameraState {
  'worklet';
  const clampAxis = (value: number, sceneLength: number, viewportLength: number) => {
    const scaled = sceneLength * state.scale;
    if (scaled <= viewportLength) return 0;
    const limit = (scaled - viewportLength) / 2 / state.scale;
    return Math.max(-limit, Math.min(limit, value));
  };
  return {
    x: clampAxis(state.x, scene.width, viewport.width),
    y: clampAxis(state.y, scene.height, viewport.height),
    scale: state.scale,
  };
}

export type FocusOptions = {
  /** Fraction of the viewport the focused object should fill (the tighter of width and height wins). */
  fill: number;
  /** Zoom relative to the resting (whole-board) scale. */
  minZoom: number;
  maxZoom: number;
  /** Keep the board covering the viewport (interactive board) or centre exactly (Visualize). */
  clamp: boolean;
  /** Shifts the focal point up (negative) or down in viewport px, e.g. to clear controls. */
  offsetY?: number;
};

/** The camera that brings one board object to the centre of attention. */
export function focusCamera(rect: SceneRect, scene: Size, viewport: Size, options: FocusOptions): CameraState {
  'worklet';
  const rest = restCamera(scene, viewport).scale;
  // Rotation is mild; the rotated bounding box is what has to fit.
  const radians = (Math.abs(rect.rotation) * Math.PI) / 180;
  const boundsW = rect.width * Math.cos(radians) + rect.height * Math.sin(radians);
  const boundsH = rect.width * Math.sin(radians) + rect.height * Math.cos(radians);
  const fitting = Math.min((viewport.width * options.fill) / boundsW, (viewport.height * options.fill) / boundsH);
  const scale = Math.max(rest * options.minZoom, Math.min(rest * options.maxZoom, fitting));
  const centreX = rect.x + rect.width / 2 - scene.width / 2;
  const centreY = rect.y + rect.height / 2 - scene.height / 2 - (options.offsetY ?? 0) / scale;
  const camera = { x: centreX, y: centreY, scale };
  return options.clamp ? clampCamera(camera, scene, viewport) : camera;
}

/** The transform the camera applies to the scene view. */
export function cameraTransform(state: CameraState): { translateX: number; translateY: number; scale: number } {
  'worklet';
  return { translateX: -state.scale * state.x, translateY: -state.scale * state.y, scale: state.scale };
}

/** How far the camera travels, in multiples of the viewport, so move durations can follow distance. */
export function cameraTravelDistance(from: CameraState, to: CameraState, viewport: Size): number {
  'worklet';
  const scale = Math.max(from.scale, to.scale);
  const dx = ((to.x - from.x) * scale) / viewport.width;
  const dy = ((to.y - from.y) * scale) / viewport.height;
  const zoom = Math.abs(Math.log(to.scale / from.scale));
  return Math.sqrt(dx * dx + dy * dy) + zoom;
}

/** A move duration within [minMs, maxMs] that grows with distance, so near neighbours glide and far ones travel. */
export function cameraTravelMs(from: CameraState, to: CameraState, viewport: Size, minMs: number, maxMs: number): number {
  'worklet';
  const distance = cameraTravelDistance(from, to, viewport);
  // About 1.5 viewports of travel reaches the longest move.
  const t = Math.max(0, Math.min(1, distance / 1.5));
  return Math.round(minMs + (maxMs - minMs) * t);
}
