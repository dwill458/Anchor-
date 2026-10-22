/**
 * Where a photograph sits inside its print window.
 *
 * A photo always covers its window at its own proportions (never stretched, never zoomed past cover), so the only
 * freedom is which part of the overflow is shown. That is a focal position: `x` and `y` run 0..1 along the overflow,
 * the way CSS `object-position` does. 0 shows the image's left/top edge, 1 its right/bottom edge, and any value in
 * between keeps the window fully covered, so blank edges cannot happen. The value is resolution independent, which
 * is what lets one saved position serve every print size and every device.
 */
export type VisionFocal = { x: number; y: number };

const clamp01 = (value: number) => {
  'worklet';
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
};

/** A stored focal that is a real, in-range pair; anything else is treated as "not set". */
export function parseVisionFocal(value: unknown): VisionFocal | null {
  if (!value || typeof value !== 'object') return null;
  const { x, y } = value as { x?: unknown; y?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: clamp01(x), y: clamp01(y) };
}

/** Faces and subjects sit in the upper part of a portrait, so tall photographs are shown from near the top. */
export const PORTRAIT_FOCAL_Y = 0.08;
/** Near-square and landscape photographs lose little vertically; a gentle upper bias keeps skies and heads in. */
export const LANDSCAPE_FOCAL_Y = 0.38;

/**
 * The position used until a person sets one. It is deliberately simple (no detector, no dependency): the further the
 * image is taller than its window, the closer to the top it is anchored. Horizontal overflow stays centred.
 * Face or subject metadata, when a source ever carries it, is passed as `subject` and wins.
 */
export function defaultVisionFocal(sourceAspect: number, windowAspect: number, subject?: VisionFocal | null): VisionFocal {
  'worklet';
  if (subject) return { x: clamp01(subject.x), y: clamp01(subject.y) };
  if (!(sourceAspect > 0) || !(windowAspect > 0)) return { x: 0.5, y: 0.3 };
  // Only a taller-than-window image overflows vertically.
  const tallness = Math.min(1, Math.max(0, (windowAspect / sourceAspect - 1) / 0.3));
  return { x: 0.5, y: LANDSCAPE_FOCAL_Y + (PORTRAIT_FOCAL_Y - LANDSCAPE_FOCAL_Y) * tallness };
}

export type VisionCoverFrame = { width: number; height: number; left: number; top: number; overflowX: number; overflowY: number };

/** The size and offset of the image inside a window so it covers the window at its own proportions. */
export function visionCoverFrame(sourceAspect: number, windowWidth: number, windowHeight: number, focal: VisionFocal): VisionCoverFrame {
  'worklet';
  if (!(sourceAspect > 0) || !(windowWidth > 0) || !(windowHeight > 0)) {
    return { width: Math.max(0, windowWidth), height: Math.max(0, windowHeight), left: 0, top: 0, overflowX: 0, overflowY: 0 };
  }
  const windowAspect = windowWidth / windowHeight;
  const wide = sourceAspect > windowAspect;
  const width = wide ? windowHeight * sourceAspect : windowWidth;
  const height = wide ? windowHeight : windowWidth / sourceAspect;
  const overflowX = Math.max(0, width - windowWidth);
  const overflowY = Math.max(0, height - windowHeight);
  return { width, height, left: -overflowX * clamp01(focal.x), top: -overflowY * clamp01(focal.y), overflowX, overflowY };
}

/**
 * Moves a focal by a finger drag, in window points. Dragging the picture right reveals more of its left side, so the
 * focal moves opposite the finger. Axes with no overflow cannot move, and the result is always clamped.
 */
export function panVisionFocal(start: VisionFocal, drag: { x: number; y: number }, overflow: { x: number; y: number }): VisionFocal {
  'worklet';
  return {
    x: overflow.x > 0.5 ? clamp01(start.x - drag.x / overflow.x) : start.x,
    y: overflow.y > 0.5 ? clamp01(start.y - drag.y / overflow.y) : start.y,
  };
}

/** True when the two focals differ enough to be worth saving. */
export function visionFocalChanged(a: VisionFocal | null | undefined, b: VisionFocal | null | undefined): boolean {
  if (!a || !b) return Boolean(a) !== Boolean(b);
  return Math.abs(a.x - b.x) > 0.002 || Math.abs(a.y - b.y) > 0.002;
}

/**
 * A focal as the UI thread holds it: two shared numbers, where a negative `y` or `x` means "not set" and the
 * automatic position applies. Returns a concrete focal.
 */
export function resolveVisionFocal(x: number, y: number, sourceAspect: number, windowAspect: number): VisionFocal {
  'worklet';
  const auto = defaultVisionFocal(sourceAspect, windowAspect);
  return { x: x < 0 ? auto.x : clamp01(x), y: y < 0 ? auto.y : clamp01(y) };
}
