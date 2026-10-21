/** Editorial canvas geometry shared by overview, gestures and the protected cinematic camera. */
import { VISION_PHOTO, type VisionTapeTone } from '../material/visionMaterialTokens';

/** The most images a Vision holds; the board has a composition for each count up to this. */
export const VISION_BOARD_MAX_IMAGES = 8;
/** Paper-backed Vision signature: 30% larger than the original 0.94 × slot. */
export const VISION_BOARD_PAPER_MARK_SCALE = 0.94 * 1.3;
/** A finished board holds at least this many; fewer is a partial board (creation, uploads in flight). */
export const VISION_BOARD_TARGET_MIN_IMAGES = 3;

/** Board width / height for a finished (2+ photo) board: the approved mockup's footprint. */
export const VISION_BOARD_ASPECT = 1 / 1.56;
/** Selection, generation and the dominant Canvas aperture use the same centre crop. */
export const VISION_HERO_ASPECT = 1.36;

export type BoardFrameKind = 'landscape' | 'portrait' | 'square';
export const BOARD_FRAME_KINDS: readonly BoardFrameKind[] = ['landscape', 'portrait', 'square'];

/**
 * Print aspect (width / height) for each frame kind. A print is cut to its kind's aspect, so its photograph window
 * is exactly the window BOARD_FRAME_WINDOW describes. Landscape gives the hero a window of about 1.3 : 1 and the
 * others about 1.16 : 1, so a person's face survives a centred cover crop better than a 2 : 1 strip would.
 */
export const BOARD_FRAME_ASPECT: Record<BoardFrameKind, number> = {
  landscape: 1.18,
  portrait: 0.9,
  square: 1.05,
};

/** The caption band at the foot of every print, as a fraction of the print's height (about 12%). */
export const BOARD_CAPTION_BAND_FRACTION = 0.12;

/**
 * Where the photograph shows through each print, as fractions of the print. The print is a mount: a paper
 * border on the sides and top and a caption band below. Side and top insets are measured in print widths, so as
 * fractions of the height they scale with the aspect. The board and the cinematic breakout crop the same photograph.
 */
function mountWindow(aspect: number): { left: number; top: number; right: number; bottom: number } {
  const side = VISION_PHOTO.sidePadRatio;
  return { left: side, top: side * aspect, right: 1 - side, bottom: 1 - BOARD_CAPTION_BAND_FRACTION };
}

export const BOARD_FRAME_WINDOW: Record<BoardFrameKind, { left: number; top: number; right: number; bottom: number }> = {
  landscape: mountWindow(BOARD_FRAME_ASPECT.landscape),
  portrait: mountWindow(BOARD_FRAME_ASPECT.portrait),
  square: mountWindow(BOARD_FRAME_ASPECT.square),
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

/**
 * A strip of tape holding a print to the board. It is attached to photograph `photo` (its index in the layout's
 * photos), so it travels with the print through drags and recomposition.
 */
export type BoardTape = {
  kind: 'tape';
  photo: number;
  /** Centre of the strip across the print's top edge, as a fraction of the print width. */
  offset: number;
  /** Strip width as a fraction of the print width. */
  width: number;
  rotation: number;
  tone: VisionTapeTone;
};

export type BoardLayout = {
  /** How many photos this composition holds. */
  count: number;
  photos: BoardSlot[];
  card: BoardCardSlot;
  /** Tape placements the composition calls for; empty where the composition has none. */
  decor: readonly BoardTape[];
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

/**
 * The legacy composition for a number of photos, never more than the board's maximum. It keeps the
 * protected cinematic overview (three large scenes) and the legacy Anchor rectangle that Visualize uses.
 */
export function selectBoardLayout(imageCount: number): BoardLayout {
  const count = Math.max(0, Math.min(VISION_BOARD_MAX_IMAGES, Math.floor(Number.isFinite(imageCount) ? imageCount : 0)));
  return LAYOUTS[Math.min(count, 3)];
}

/**
 * Board height as a multiple of its width, for each photo count. Counts 0 to 8. Each finished composition is as tall as
 * its lowest print plus a gap of about 24pt above the Add control (on a 320pt board). Counts 4 to 8 keep the Anchor on the
 * board's vertical centre, so the height is set by the hero's foot above the Anchor and the bottom row below it.
 */
const BOARD_HEIGHT_RATIO: readonly number[] = [0.45, 1.25, 1.16, 1.15, 1.44, 1.44, 1.44, 1.56, 1.93];

function clampCount(imageCount: number): number {
  return Math.max(0, Math.min(VISION_BOARD_MAX_IMAGES, Math.floor(Number.isFinite(imageCount) ? imageCount : 0)));
}

/**
 * One print in a recipe: centre x (fraction of board width), centre y in board-width units (measured from the
 * board's top, so a print keeps its place as the board grows taller), width (fraction of board width), frame kind
 * (which sets its aspect and photograph window) and tilt in degrees.
 */
type PrintSpec = readonly [x: number, yWidths: number, width: number, frame: BoardFrameKind, rotation: number];
type TapeSpec = readonly [photo: number, offset: number, width: number, rotation: number, tone: VisionTapeTone];
type Recipe = {
  photos: readonly PrintSpec[];
  /** Anchor centre. `yWidths` is omitted for the centred Anchor (three or more photos). */
  card: { x: number; yWidths?: number; rotation: number };
  tape: readonly TapeSpec[];
};

/** The Anchor card's side, as a fraction of board width. Shared by every composition (about a sixth larger than before). */
const ANCHOR_WIDTH = 0.28;

/**
 * Deterministic scrapbook recipes, one per photo count. Positions are hand-set rather than sampled, so a board always
 * looks the same for the same photos. Vertical positions are in board-width units, so a print keeps its place as the
 * board grows taller.
 *
 * The prints are a prefix family: from four photos up, the first N prints are the same prints in the same places, and
 * photo N+1 is added at the end. Adding a photo therefore moves the existing prints only by the small step the
 * foot print takes (under 0.15 board widths). The hero is the first print and the largest. Neighbouring prints overlap
 * by up to about 30% of the smaller one, horizontally and vertically, so the board reads as layered prints rather
 * than a grid. The Anchor stays on the board's centre line and no print covers its box. Every tilt is
 * within 5 degrees, and no two neighbours tilt the same way.
 */
const HERO_4: PrintSpec = [0.5, 0.2952, 0.64, 'landscape', -2];
const RIGHT_FLANK: PrintSpec = [0.81, 0.66, 0.34, 'square', -3];
const LEFT_FLANK: PrintSpec = [0.19, 0.62, 0.34, 'square', 4];
const FOOT: PrintSpec = [0.5, 1.04, 0.38, 'landscape', 3];
const RIGHT_LOW: PrintSpec = [0.8, 0.92, 0.32, 'square', -4];
const LEFT_LOW: PrintSpec = [0.2, 0.88, 0.32, 'square', 3];
const RIGHT_FAR: PrintSpec = [0.8, 1.18, 0.3, 'square', 2];
const LEFT_FAR: PrintSpec = [0.2, 1.56, 0.3, 'square', -3];
const RIGHT_FAR_FOOT: PrintSpec = [0.5, 1.13, 0.38, 'landscape', 3];
const FOOT_8: PrintSpec = [0.5, 1.27, 0.38, 'landscape', 3];

/** Recipes from four photos up use the same nine prints, in this order, so they are a prefix family. */
const RECIPES: readonly Recipe[] = [
  // 0: an empty board: the Anchor alone, at the legacy resting place.
  { photos: [], card: { x: 0.5, yWidths: 0.225, rotation: 0 }, tape: [] },
  // Low-count medallions overlap the prints' lower edges. Their actual paper diameter
  // (slot width × VISION_BOARD_PAPER_MARK_SCALE) clears the fixed Add control below.
  { photos: [[0.5, 0.444, 0.74, 'portrait', -3]], card: { x: 0.5, yWidths: 0.88, rotation: 0 },
    tape: [[0, 0.5, 0.34, 2.5, 'cream']] },
  // 2: a hero and a supporting print tucked under its right corner, with the Anchor centred between them.
  { photos: [[0.5, 0.37, 0.8, 'landscape', -3], [0.81, 0.78, 0.34, 'square', 4]], card: { x: 0.5, yWidths: 0.79, rotation: 0 },
    tape: [[0, 0.5, 0.3, 2, 'cream'], [1, 0.5, 0.26, -4, 'kraft']] },
  // 3: a dominant hero across the top, with two supporting prints beside the Anchor. The Anchor sits below the hero's foot.
  { photos: [[0.5, 0.37, 0.8, 'landscape', -3], [0.81, 0.76, 0.34, 'square', 4], [0.19, 0.76, 0.34, 'square', -5]],
    card: { x: 0.5, yWidths: 0.78, rotation: 0 },
    tape: [[0, 0.5, 0.3, 2, 'cream'], [1, 0.5, 0.26, -4, 'kraft'], [2, 0.5, 0.26, 5, 'gold']] },
  // 4: the hero across the top, a flank either side of the Anchor, and one print beneath it.
  { photos: [HERO_4, RIGHT_FLANK, LEFT_FLANK, FOOT], card: { x: 0.5, rotation: -2 },
    tape: [[0, 0.5, 0.3, 2, 'cream'], [1, 0.5, 0.26, -4, 'kraft'], [3, 0.5, 0.26, 3, 'gold']] },
  // 5: the four-print spread, with a print at the lower right.
  { photos: [HERO_4, RIGHT_FLANK, LEFT_FLANK, FOOT, RIGHT_LOW], card: { x: 0.5, rotation: 0 },
    tape: [[0, 0.5, 0.3, 2, 'cream'], [1, 0.5, 0.26, -4, 'kraft'], [3, 0.5, 0.26, 3, 'gold']] },
  // 6: the hero, two flanks and three prints along the foot, lower left and right.
  { photos: [HERO_4, RIGHT_FLANK, LEFT_FLANK, FOOT, RIGHT_LOW, LEFT_LOW], card: { x: 0.5, rotation: 0 },
    tape: [[0, 0.5, 0.3, 2, 'cream'], [1, 0.5, 0.26, -4, 'kraft'], [3, 0.5, 0.26, 3, 'gold'], [5, 0.5, 0.26, -3, 'cream']] },
  // 7: the six-print spread, with one more print at the upper right of the lower row.
  { photos: [HERO_4, RIGHT_FLANK, LEFT_FLANK, RIGHT_FAR_FOOT, RIGHT_LOW, LEFT_LOW, RIGHT_FAR], card: { x: 0.5, rotation: -2 },
    tape: [[0, 0.5, 0.3, 2, 'cream'], [1, 0.5, 0.26, -4, 'kraft'], [3, 0.5, 0.26, 3, 'gold'], [6, 0.5, 0.26, -2, 'cream']] },
  // 8: the seven-print spread, with one more print at the lower left.
  { photos: [HERO_4, RIGHT_FLANK, LEFT_FLANK, FOOT_8, RIGHT_LOW, LEFT_LOW, RIGHT_FAR, LEFT_FAR], card: { x: 0.5, rotation: -2 },
    tape: [[0, 0.5, 0.3, 2, 'cream'], [1, 0.5, 0.26, -4, 'kraft'], [3, 0.5, 0.26, 3, 'gold'], [6, 0.5, 0.26, -2, 'cream']] },
];

/** The composition for a number of photos. Three or more keep the Anchor card at the centre of the board. */
export function selectDetailBoardLayout(imageCount: number): BoardLayout {
  const count = clampCount(imageCount);
  const recipe = RECIPES[count];
  const height = BOARD_HEIGHT_RATIO[count];
  const card = recipe.card;
  return {
    count,
    photos: recipe.photos.map(([x, yWidths, width, frame, rotation], index) => ({
      frame, x, y: yWidths / height, width, aspectRatio: BOARD_FRAME_ASPECT[frame], rotation, zIndex: 12 + index,
    })),
    card: {
      x: card.x,
      y: card.yWidths === undefined ? 0.5 : card.yWidths / height,
      width: ANCHOR_WIDTH,
      aspectRatio: BOARD_CARD_ASPECT,
      rotation: card.rotation,
      zIndex: 40,
    },
    decor: recipe.tape.map(([photoIndex, offset, width, rotationDeg, tone]) => ({
      kind: 'tape', photo: photoIndex, offset, width, rotation: rotationDeg, tone,
    })),
  };
}

/** Board size for a width when the board holds `count` photos, using each composition's own proportions. */
export function detailBoardSizeForWidth(width: number, count: number): Size {
  return { width, height: width * BOARD_HEIGHT_RATIO[clampCount(count)] };
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
