import { BOARD_FRAME_WINDOW, type BoardFrameKind, type SceneRect, type Size } from '@/components/v2/vision/board/visionBoardLayouts';

export type Rect = Size & { x: number; y: number };
/** Absolute scene point at the viewport center. Rotation is in degrees. */
export type CinematicCamera = { x: number; y: number; scale: number; rotation: number };

export function rotatedChild(parent: SceneRect, child: Rect): SceneRect {
  'worklet';
  const a = parent.rotation * Math.PI / 180;
  const dx = child.x + child.width / 2 - parent.width / 2;
  const dy = child.y + child.height / 2 - parent.height / 2;
  return { ...child, x: parent.x + parent.width / 2 + dx * Math.cos(a) - dy * Math.sin(a) - child.width / 2,
    y: parent.y + parent.height / 2 + dx * Math.sin(a) + dy * Math.cos(a) - child.height / 2,
    rotation: parent.rotation, zIndex: parent.zIndex };
}

export function photoWindow(photo: SceneRect, kind: BoardFrameKind): SceneRect {
  const w = BOARD_FRAME_WINDOW[kind];
  // The same bleed as VisionBoardPhoto: maintain the source crop at breakout.
  const bleed = 0.012;
  return rotatedChild(photo, { x: (w.left - bleed) * photo.width, y: (w.top - bleed) * photo.height,
    width: (w.right - w.left + 2 * bleed) * photo.width, height: (w.bottom - w.top + 2 * bleed) * photo.height });
}

export function restCinematicCamera(scene: Size, viewport: Size): CinematicCamera {
  return { x: scene.width / 2, y: scene.height / 2, rotation: 0,
    scale: Math.min(viewport.width / scene.width, viewport.height / scene.height) * 0.94 };
}

export function cameraAtRect(rect: SceneRect, viewport: Size, fill: number): CinematicCamera {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, rotation: -rect.rotation,
    scale: Math.min(viewport.width / rect.width, viewport.height / rect.height) * fill };
}

export function projectPoint(point: { x: number; y: number }, camera: CinematicCamera, viewport: Size) {
  'worklet';
  const a = camera.rotation * Math.PI / 180;
  const dx = point.x - camera.x;
  const dy = point.y - camera.y;
  return { x: viewport.width / 2 + camera.scale * (dx * Math.cos(a) - dy * Math.sin(a)),
    y: viewport.height / 2 + camera.scale * (dx * Math.sin(a) + dy * Math.cos(a)) };
}

export function coverRect(source: Size, target: Rect): Rect {
  'worklet';
  const scale = Math.max(target.width / source.width, target.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return { x: target.x + (target.width - width) / 2, y: target.y + (target.height - height) / 2, width, height };
}

export function mix(a: number, b: number, t: number) {
  'worklet';
  return a + (b - a) * t;
}

export function progress(time: number, start: number, end: number) {
  'worklet';
  return Math.max(0, Math.min(1, (time - start) / (end - start)));
}

export function smooth(t: number) {
  'worklet';
  return t * t * (3 - 2 * t);
}

export function mixCamera(a: CinematicCamera, b: CinematicCamera, t: number): CinematicCamera {
  'worklet';
  if (t <= 0) return a;
  if (t >= 1) return b;
  return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), scale: Math.exp(mix(Math.log(a.scale), Math.log(b.scale), t)), rotation: mix(a.rotation, b.rotation, t) };
}
