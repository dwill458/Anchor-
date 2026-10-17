/**
 * Smart Photo Fit: pure geometry for making a personal photograph sit in the Vision's
 * canonical 9:16 portrait without ever stretching it. Nothing here touches pixels; the
 * results are rectangles that the crop and expand steps apply.
 *
 * The stored Vision image is 1080x1920 (backend `VISION_IMAGE_ASPECT_RATIO`); the board
 * derives its frames from that original, so 9:16 is the target a photo is fitted to.
 */
export const VISION_PHOTO_TARGET_ASPECT = 9 / 16;
/** A photo already this close to the target needs no adjustment (a typical phone portrait is 3:4 = 0.75, which is NOT close). */
export const VISION_PHOTO_FIT_TOLERANCE = 0.06;
/** Outpainting never invents more than this share of the final frame, so the original stays the subject. */
export const VISION_PHOTO_MAX_INVENTED = 0.6;

export type Size = { width: number; height: number };
export type PhotoRelation = 'fits' | 'wider' | 'taller';

export type PhotoFitAssessment = {
  relation: PhotoRelation;
  /** width / height of the source. */
  aspect: number;
  /** Share of the source that survives a crop to the target, 0..1. */
  retained: number;
  /** Share of the final frame that would be invented by expanding, 0..1. */
  invented: number;
  /** Expanding is offered only when the invented share is within VISION_PHOTO_MAX_INVENTED. */
  canExpand: boolean;
};

const valid = (size: Size) => Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;

/** Decides whether a photo needs fitting, and what each fix would cost it. Unknown dimensions are treated as needing no change. */
export function assessPhotoFit(size: Size, target = VISION_PHOTO_TARGET_ASPECT): PhotoFitAssessment {
  if (!valid(size)) return { relation: 'fits', aspect: target, retained: 1, invented: 0, canExpand: false };
  const aspect = size.width / size.height;
  const retained = Math.min(aspect / target, target / aspect);
  const relation: PhotoRelation = Math.abs(aspect - target) / target <= VISION_PHOTO_FIT_TOLERANCE ? 'fits' : aspect > target ? 'wider' : 'taller';
  const invented = relation === 'fits' ? 0 : 1 - retained;
  return { relation, aspect, retained, invented, canExpand: relation !== 'fits' && invented <= VISION_PHOTO_MAX_INVENTED };
}

export type CropRect = { originX: number; originY: number; width: number; height: number };

/**
 * The largest target-aspect rectangle inside the source, positioned by a focal point
 * (0..1 on each axis, 0.5 is centred). Integer pixels, always inside the source.
 */
export function computeCropRect(size: Size, focal: { x: number; y: number } = { x: 0.5, y: 0.5 }, target = VISION_PHOTO_TARGET_ASPECT): CropRect {
  if (!valid(size)) return { originX: 0, originY: 0, width: 0, height: 0 };
  const aspect = size.width / size.height;
  let width = size.width;
  let height = size.height;
  if (aspect > target) width = Math.round(size.height * target); else height = Math.round(size.width / target);
  width = Math.min(size.width, Math.max(1, width));
  height = Math.min(size.height, Math.max(1, height));
  const clamp = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5);
  const originX = Math.round((size.width - width) * clamp(focal.x));
  const originY = Math.round((size.height - height) * clamp(focal.y));
  return { originX, originY, width, height };
}

export type ExpandPlan = {
  canvas: Size;
  /** Where the untouched original sits on the canvas. Only the area outside it is generated. */
  offset: { x: number; y: number };
};

/** The smallest target-aspect canvas that holds the whole original, centred. Null when no expansion is needed or possible. */
export function computeExpandPlan(size: Size, target = VISION_PHOTO_TARGET_ASPECT): ExpandPlan | null {
  const assessment = assessPhotoFit(size, target);
  if (assessment.relation === 'fits' || !assessment.canExpand) return null;
  const aspect = size.width / size.height;
  const canvas: Size = aspect > target
    ? { width: size.width, height: Math.round(size.width / target) }
    : { width: Math.round(size.height * target), height: size.height };
  return { canvas, offset: { x: Math.round((canvas.width - size.width) / 2), y: Math.round((canvas.height - size.height) / 2) } };
}

/** Consumer language for why the photo needs a choice. */
export function photoFitExplanation(relation: PhotoRelation): string {
  if (relation === 'wider') return 'This photo is wider than your Vision frame. Choose how you’d like it to appear.';
  if (relation === 'taller') return 'This photo is taller than your Vision frame. Choose how you’d like it to appear.';
  return 'This photo already fits your Vision frame.';
}
