/** Editorial canvas geometry shared by overview, gestures and the protected cinematic camera. */
/** The most images a Vision holds; the board has a composition for each count up to this. */
export const VISION_BOARD_MAX_IMAGES = 6;
/** A finished board holds at least this many; fewer is a partial board (creation, uploads in flight). */
export const VISION_BOARD_TARGET_MIN_IMAGES = 3;

/** Board width / height for a finished (2+ photo) board: the approved mockup's footprint. */
export const VISION_BOARD_ASPECT = 1 / 1.56;
/** Selection, generation and the dominant Canvas aperture use the same centre crop. */
export const VISION_HERO_ASPECT = 1.36;

export type BoardFrameKind = 'landscape' | 'portrait' | 'square';
export const BOARD_FRAME_KINDS: readonly BoardFrameKind[] = ['landscape', 'portrait', 'square'];

export const BOARD_FRAME_ASPECT: Record<BoardFrameKind, number> = {
  landscape: 1.56,
  portrait: 0.92,
  square: 1.2,
};

/** Where the photograph shows through each photograph, as fractions of the frame. */
export const BOARD_FRAME_WINDOW: Record<BoardFrameKind, { left: number; top: number; right: number; bottom: number }> = {
  landscape: { left: 0, top: 0, right: 1, bottom: 1 },
  portrait: { left: 0, top: 0, right: 1, bottom: 1 },
  square: { left: 0, top: 0, right: 1, bottom: 1 },
};

export const BOARD_CARD_ASPECT = 1;

export type BoardSlot = {
  x: number;
  y: number;
  width: number;
  aspectRatio: number;
  rotation: number;
  zIndex: number;
  frame: BoardFrameKind;
};

export type BoardCardSlot = Omit<BoardSlot, 'frame'>;

export type BoardLayout = {
  /** How many photos this composition holds. */
  count: number;
  photos: BoardSlot[];
  card: BoardCardSlot;
  /** No decorative physical materials. */
  decor: [];
};

// Compatibility names retain the proven camera/gesture contract. No physical board is rendered.
function photo(frame: BoardFrameKind, x: number, y: number, width: number, aspectRatio: number, zIndex = 12): BoardSlot {
  return { frame, x, y, width, aspectRatio, rotation: 0, zIndex };
}
function seal(y: number, x = 0.49): BoardCardSlot {
  return { x, y, width: 0.24, aspectRatio: 1, rotation: 0, zIndex: 40 };
}
const LAYOUTS: readonly BoardLayout[] = [
  { count: 0, photos: [], card: seal(0.5), decor: [] },
  { count: 1, photos: [photo('portrait', 0.5, 0.445, 1, 0.9)], card: seal(0.78, 0.73), decor: [] },
  { count: 2, photos: [photo('landscape', 0.5, 0.2355, 1, VISION_HERO_ASPECT),
    photo('square', 0.64, 0.695, 0.72, 1.04)], card: seal(0.47, 0.40), decor: [] },
  { count: 3, photos: [photo('landscape', 0.5, 0.2355, 1, VISION_HERO_ASPECT),
    photo('portrait', 0.235, 0.679, 0.45, 0.76), photo('square', 0.755, 0.697, 0.48, 0.8, 13)], card: seal(0.47), decor: [] },
];

/** The composition for a number of photos; never more than the board's maximum. */
export function selectBoardLayout(imageCount: number): BoardLayout {
  const count = Math.max(0, Math.min(VISION_BOARD_MAX_IMAGES, Math.floor(Number.isFinite(imageCount) ? imageCount : 0)));
  return LAYOUTS[Math.min(count, 3)];
}

/** The slots offered as "add an image" placeholders on an empty board. */
export function emptyBoardPlaceholderSlots(): BoardSlot[] {
  return [];
}

export type Size = { width: number; height: number };

/** A resolved object on a rendered board: top-left position and size in scene pixels. */
export type SceneRect = { x: number; y: number; width: number; height: number; rotation: number; zIndex: number };

/** Resolves a normalised slot to scene pixels for a board of `scene` size. */
export function toSceneRect(slot: Pick<BoardSlot, 'x' | 'y' | 'width' | 'aspectRatio' | 'rotation' | 'zIndex'>, scene: Size): SceneRect {
  const width = slot.width * scene.width;
  const height = width / slot.aspectRatio;
  return {
    x: slot.x * scene.width - width / 2,
    y: slot.y * scene.height - height / 2,
    width,
    height,
    rotation: slot.rotation,
    zIndex: slot.zIndex,
  };
}

/** The board's rendered size for a given width. */
export function boardSizeForWidth(width: number, imageCount = 3): Size {
  return { width, height: width / (imageCount === 0 ? 1 / 0.45 : imageCount === 1 ? 1 / 1.25 : VISION_BOARD_ASPECT) };
}
