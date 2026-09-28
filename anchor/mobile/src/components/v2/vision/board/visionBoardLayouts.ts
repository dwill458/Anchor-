/**
 * The Vision board's curated compositions, in normalised board coordinates.
 *
 * Every object on the board is placed by its centre:
 *   x      - fraction of the board's width  (0 = left edge, 1 = right edge)
 *   y      - fraction of the board's height (0 = top edge,  1 = bottom edge)
 *   width  - fraction of the board's width
 *   height - derived from the object's aspect ratio, never stored
 *   rotation - degrees, clockwise
 *
 * Nothing here depends on screen pixels: `toSceneRect` resolves a slot for
 * any rendered board size, so the same composition scales between phones,
 * the Vision screen and the full-screen Visualize camera.
 *
 * The linen field sits inside the wooden frame at roughly x 0.08-0.92,
 * y 0.06-0.94 (see VISION_BOARD_ASSET_METRICS.board.inner). Objects may
 * overhang the frame slightly, as they would on a real board.
 */
import { VISION_BOARD_ASSET_METRICS as M } from './visionBoardAssetMetrics.generated';

/** The most images a Vision holds; the board has a composition for each count up to this. */
export const VISION_BOARD_MAX_IMAGES = 6;
/** A finished board holds at least this many; fewer is a partial board (creation, uploads in flight). */
export const VISION_BOARD_TARGET_MIN_IMAGES = 3;

/** Board width / height. */
export const VISION_BOARD_ASPECT = M.board.aspect;

export type BoardFrameKind = 'landscape' | 'portrait' | 'square';
export const BOARD_FRAME_KINDS: readonly BoardFrameKind[] = ['landscape', 'portrait', 'square'];

export const BOARD_FRAME_ASPECT: Record<BoardFrameKind, number> = {
  landscape: M['frame-landscape'].aspect,
  portrait: M['frame-portrait'].aspect,
  square: M['frame-square'].aspect,
};

/** Where the photograph shows through each torn frame, as fractions of the frame. */
export const BOARD_FRAME_WINDOW: Record<BoardFrameKind, { left: number; top: number; right: number; bottom: number }> = {
  landscape: M['frame-landscape'].window,
  portrait: M['frame-portrait'].window,
  square: M['frame-square'].window,
};

export const BOARD_CARD_ASPECT = M['intention-paper'].aspect;

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

export type BoardDecorAsset =
  | 'leaf-large' | 'leaf-branch' | 'leaf-sprig'
  | 'scrap-kraft' | 'scrap-light' | 'map-corner' | 'map-strip';

export const BOARD_DECOR_ASPECT: Record<BoardDecorAsset, number> = {
  'leaf-large': M['leaf-large'].aspect,
  'leaf-branch': M['leaf-branch'].aspect,
  'leaf-sprig': M['leaf-sprig'].aspect,
  'scrap-kraft': M['scrap-kraft'].aspect,
  'scrap-light': M['scrap-light'].aspect,
  'map-corner': M['map-corner'].aspect,
  'map-strip': M['map-strip'].aspect,
};

export type BoardDecorItem = {
  asset: BoardDecorAsset;
  x: number;
  y: number;
  width: number;
  rotation: number;
  zIndex: number;
  opacity: number;
};

export type BoardLayout = {
  /** How many photos this composition holds. */
  count: number;
  photos: BoardSlot[];
  card: BoardCardSlot;
  /** Restrained ephemera: at most three pieces, always beneath the photographs. */
  decor: BoardDecorItem[];
};

const Z = { decor: 2, decorFront: 6, photo: 12, card: 40 } as const;

function photo(frame: BoardFrameKind, x: number, y: number, width: number, rotation: number, zOffset = 0): BoardSlot {
  return { x, y, width, rotation, frame, aspectRatio: BOARD_FRAME_ASPECT[frame], zIndex: Z.photo + zOffset };
}

function card(x: number, y: number, width: number, rotation: number): BoardCardSlot {
  return { x, y, width, rotation, aspectRatio: BOARD_CARD_ASPECT, zIndex: Z.card };
}

function decor(asset: BoardDecorAsset, x: number, y: number, width: number, rotation: number, opacity = 1, front = false): BoardDecorItem {
  return { asset, x, y, width, rotation, opacity, zIndex: front ? Z.decorFront : Z.decor };
}

/**
 * One curated composition per image count. The Anchor card stays central and
 * dominant; photos gather around it with mild rotations and slight overlaps;
 * negative space is deliberate rather than filled.
 */
const LAYOUTS: readonly BoardLayout[] = [
  {
    // Nothing chosen yet: the Anchor and its intention hold the board alone.
    count: 0,
    photos: [],
    card: card(0.5, 0.47, 0.42, -1),
    decor: [
      decor('leaf-large', 0.13, 0.8, 0.17, -16),
      decor('map-corner', 0.84, 0.2, 0.2, 7, 0.9),
    ],
  },
  {
    count: 1,
    photos: [photo('landscape', 0.5, 0.79, 0.58, 2)],
    card: card(0.5, 0.36, 0.38, -1.5),
    decor: [
      decor('leaf-large', 0.13, 0.62, 0.16, -14),
      decor('map-corner', 0.85, 0.44, 0.2, 8, 0.9),
    ],
  },
  {
    count: 2,
    photos: [
      photo('landscape', 0.33, 0.19, 0.48, -3),
      photo('landscape', 0.66, 0.8, 0.5, 2.5),
    ],
    card: card(0.5, 0.49, 0.36, -1),
    decor: [
      decor('leaf-large', 0.15, 0.76, 0.17, -14),
      decor('map-corner', 0.84, 0.3, 0.2, 7, 0.9),
    ],
  },
  {
    // The reference composition: two above, the Anchor, one wide hero below.
    count: 3,
    photos: [
      photo('landscape', 0.31, 0.175, 0.46, -3.5),
      photo('square', 0.725, 0.19, 0.36, 3, -1),
      photo('landscape', 0.5, 0.8, 0.58, 1.5, 1),
    ],
    card: card(0.5, 0.5, 0.36, -1.2),
    decor: [
      decor('scrap-light', 0.16, 0.47, 0.22, -6, 0.95),
      decor('map-corner', 0.86, 0.52, 0.2, 8, 0.9),
      decor('leaf-large', 0.12, 0.74, 0.16, -18, 1, true),
    ],
  },
  {
    count: 4,
    photos: [
      photo('landscape', 0.3, 0.17, 0.44, -3),
      photo('square', 0.74, 0.185, 0.34, 2.5, -1),
      photo('square', 0.27, 0.81, 0.34, 2, 1),
      photo('landscape', 0.72, 0.8, 0.42, -2.5),
    ],
    card: card(0.5, 0.495, 0.34, -1),
    decor: [
      decor('scrap-light', 0.28, 0.37, 0.2, -8, 0.95),
      decor('map-strip', 0.84, 0.5, 0.3, 84, 0.9),
      decor('leaf-branch', 0.11, 0.58, 0.15, 12, 1, true),
    ],
  },
  {
    count: 5,
    photos: [
      photo('landscape', 0.29, 0.165, 0.42, -3),
      photo('portrait', 0.755, 0.215, 0.27, 2.5, -1),
      photo('square', 0.19, 0.5, 0.25, -1.6, 1),
      photo('landscape', 0.31, 0.815, 0.42, 2),
      photo('square', 0.745, 0.79, 0.31, -2.8, 1),
    ],
    card: card(0.525, 0.505, 0.31, -1),
    decor: [
      decor('map-corner', 0.13, 0.32, 0.16, -6, 0.9),
      decor('leaf-sprig', 0.87, 0.52, 0.1, -10, 1, true),
    ],
  },
  {
    count: 6,
    photos: [
      photo('landscape', 0.29, 0.16, 0.42, -3),
      photo('square', 0.745, 0.175, 0.32, 2.5, -1),
      photo('portrait', 0.17, 0.485, 0.22, 1.8, 1),
      photo('square', 0.83, 0.5, 0.22, -3.5, 1),
      photo('square', 0.27, 0.815, 0.32, -1.4),
      photo('landscape', 0.715, 0.81, 0.42, 2.2),
    ],
    card: card(0.5, 0.495, 0.29, -1),
    decor: [
      decor('map-strip', 0.55, 0.07, 0.3, -4, 0.85),
      decor('leaf-sprig', 0.5, 0.9, 0.09, 8, 1, true),
    ],
  },
];

/** The composition for a number of photos; never more than the board's maximum. */
export function selectBoardLayout(imageCount: number): BoardLayout {
  const count = Math.max(0, Math.min(VISION_BOARD_MAX_IMAGES, Math.floor(Number.isFinite(imageCount) ? imageCount : 0)));
  return LAYOUTS[count];
}

/** The slots offered as "add an image" placeholders on an empty board. */
export function emptyBoardPlaceholderSlots(): BoardSlot[] {
  return LAYOUTS[VISION_BOARD_TARGET_MIN_IMAGES].photos;
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

export function decorAspect(item: BoardDecorItem): number {
  return BOARD_DECOR_ASPECT[item.asset];
}

/** The board's rendered size for a given width. */
export function boardSizeForWidth(width: number): Size {
  return { width, height: width / VISION_BOARD_ASPECT };
}

/** Deterministic, stable per photo: how it is fixed to the board. */
export type BoardAttachment = 'pin' | 'pin-angled' | 'tape-top' | 'tape-left' | 'tape-right';
const ATTACHMENTS: readonly BoardAttachment[] = ['pin', 'tape-top', 'pin-angled', 'tape-left', 'pin', 'tape-right'];

export function boardAttachmentFor(id: string): BoardAttachment {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return ATTACHMENTS[hash % ATTACHMENTS.length];
}
