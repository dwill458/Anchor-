import type { Size } from '@/components/v2/vision/board/visionBoardLayouts';

export type PhotoFocus = { x: number; y: number };

/** Low-resolution contrast centroid, not a face detector. Never licenses cropping. */
export function subjectFocusFromPixels(pixels: Uint8Array | Float32Array, width: number, height: number): PhotoFocus {
  const count = width * height;
  if (pixels.length < count * 4) return { x: 0.5, y: 0.5 };
  const mean = [0, 0, 0];
  for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) mean[c] += pixels[i * 4 + c] / count;
  let sum = 0, weightedX = 0, weightedY = 0;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const p = (y * width + x) * 4;
    let contrast = 0;
    for (let c = 0; c < 3; c++) contrast += (pixels[p + c] - mean[c]) ** 2;
    const nx = x / (width - 1), ny = y / (height - 1);
    const weight = contrast * Math.max(0.1, 1 - Math.hypot(nx - 0.5, ny - 0.5));
    sum += weight; weightedX += nx * weight; weightedY += ny * weight;
  }
  return sum > 0 ? { x: weightedX / sum, y: weightedY / sum } : { x: 0.5, y: 0.5 };
}

export function photoMotionPlan(size: Size, viewport: Size, focus: PhotoFocus | null = null) {
  const scale = Math.min(viewport.width / size.width, viewport.height / size.height) * 0.90;
  const width = size.width * scale, height = size.height * scale;
  const horizontal = size.width >= size.height;
  const travel = Math.max(0, Math.min(horizontal ? viewport.width - width : viewport.height - height,
    (horizontal ? viewport.width : viewport.height) * 0.12)) * 0.9;
  const subject = horizontal ? focus?.x : focus?.y;
  const direction = subject != null && subject > 0.5 ? -1 : 1;
  return { width, height, horizontal, from: -direction * travel / 2, to: direction * travel / 2 };
}
export type PhotoMotionPlan = ReturnType<typeof photoMotionPlan>;

/** Constant-speed translation: no zoom, stall, reversal, or hidden image edge. */
export function photoMotionFrame(plan: PhotoMotionPlan, progress: number) {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  const offset = plan.from + (plan.to - plan.from) * t;
  return { x: -plan.width / 2 + (plan.horizontal ? offset : 0),
    y: -plan.height / 2 + (plan.horizontal ? 0 : offset), width: plan.width, height: plan.height };
}

/** The playback position owns both fades, so backgrounding freezes them too. */
export function ambientDarknessAt(ms: number, lightReturnMs: number) {
  'worklet';
  const opening = Math.max(0, Math.min(1, ms / 2000));
  const closing = Math.max(0, Math.min(1, (ms - lightReturnMs) / 2000));
  const ease = (t: number) => { 'worklet'; return t * t * (3 - 2 * t); };
  return ease(opening) * (1 - ease(closing));
}
