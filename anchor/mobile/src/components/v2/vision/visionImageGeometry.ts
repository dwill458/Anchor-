/**
 * Generated photographs are composed for the frame, so they always fill it.
 * A person's own photograph is never cropped past a small trim: beyond that the
 * whole original is kept within the existing aperture over neutral paper.
 */
export const UPLOAD_MIN_RETAINED = 0.86;

/** Share of the source that survives a `cover` fit into the display aspect. */
export function visionImageRetained(sourceAspect: number, displayAspect: number): number {
  if (!Number.isFinite(sourceAspect) || sourceAspect <= 0 || !Number.isFinite(displayAspect) || displayAspect <= 0) return 1;
  return Math.min(sourceAspect / displayAspect, displayAspect / sourceAspect);
}

/**
 * A full-screen portrait takes a person's own landscape photograph too hard if it is covered:
 * past this much loss the whole photograph is shown, over a blurred copy of itself.
 */
export const FULLSCREEN_MIN_RETAINED = 0.6;

export function fullscreenFit(source: { width: number; height: number }, viewport: { width: number; height: number }, uploaded: boolean): 'cover' | 'contain' {
  if (!uploaded || source.width <= 0 || source.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return 'cover';
  return visionImageRetained(source.width / source.height, viewport.width / viewport.height) < FULLSCREEN_MIN_RETAINED ? 'contain' : 'cover';
}

export function visionImageFit(sourceAspect: number, displayAspect: number, uploaded = false): 'cover' | 'contain' {
  if (!uploaded) return 'cover';
  if (!Number.isFinite(sourceAspect) || sourceAspect <= 0) return 'contain';
  return visionImageRetained(sourceAspect, displayAspect) < UPLOAD_MIN_RETAINED ? 'contain' : 'cover';
}
