import { selectEditorialImages, type VisionEditorialImage, type VisionEditorialTile } from './visionEditorialLayout';
import { VISION_PHOTO } from './material/visionMaterialTokens';

/**
 * Pure model behind the compact Vision preview cards (Home, Anchor Details, Progress).
 *
 * Item definition (one source of truth for every card):
 * - a photo is a Vision tile with a non-empty image URL, each tile counted once
 *   (the same selection the Vision board and collage use);
 * - a note is a saved, non-archived note with text (the notes the collage renders);
 * - "items" = photos + notes. The overflow "+N" counts photos only, because the
 *   Progress thumbnails are photos.
 */

/** Most prints a home or details card draws, and the most thumbnails Progress shows. */
export const VISION_PREVIEW_PRINT_LIMIT = 3;

export type VisionPreviewCardVariant = 'home' | 'details' | 'progress';

/** Renderable photographs, featured first, each tile once. Tiles without an image URL are not photographs. */
export function visionPreviewPhotos(
  tiles: readonly VisionEditorialTile[],
  featuredTileId?: string,
): VisionEditorialImage[] {
  return selectEditorialImages(tiles, 'home', featuredTileId);
}

/** Photos plus notes. Negative or non-finite inputs count as zero. */
export function visionPreviewItemCount(photoCount: number, noteCount = 0): number {
  return safeCount(photoCount) + safeCount(noteCount);
}

/** Count text shown on every card. Zero reads as an honest empty state, never as a fake photo. */
export function visionItemCountLabel(count: number): string {
  const total = safeCount(count);
  if (total === 0) return 'No items yet';
  return total === 1 ? '1 item' : `${total} items`;
}

/**
 * "+N" for the thumbnail row: photographs beyond the visible ones. Never shown
 * when the total fits in the visible slots (3 photos -> 0, 8 photos -> 5).
 */
export function visionPreviewOverflow(photoTotal: number, visible = VISION_PREVIEW_PRINT_LIMIT): number {
  const total = safeCount(photoTotal);
  const shown = safeCount(visible);
  return total > shown ? total - shown : 0;
}

/** Deterministic seed from a stable identity (tile id), so paper and tape never shuffle between renders. */
export function visionPreviewSeed(identity: string): number {
  let hash = 2166136261;
  for (let i = 0; i < identity.length; i++) {
    hash ^= identity.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash || 1;
}

export type VisionPrintSlot = {
  /** Left edge, as a fraction of the stage width. */
  x: number;
  /** Top edge, as a fraction of the stage width (the stage is square-ish in these units). */
  y: number;
  /** Print width, as a fraction of the stage width. */
  width: number;
  rotation: number;
  zIndex: number;
};

/**
 * Width / height of each card photograph's window: a landscape-ish frame, cover-cropped, so three prints fit the card's
 * width with slight overlap rather than tall portrait prints clipped at the card's edge.
 */
export const VISION_PREVIEW_PRINT_ASPECT = 1.22;

/**
 * Print geometry by photograph count. Index 0 is the featured print: the
 * largest, placed in front. Positions are in stage-width units, so the layout
 * scales with the card and never depends on measured image aspect ratios.
 * Each print's height is its width times about 0.87 (mount included, at VISION_PREVIEW_PRINT_ASPECT).
 */
const PRINT_SLOTS: Record<1 | 2 | 3, VisionPrintSlot[]> = {
  1: [{ x: 0.22, y: 0.05, width: 0.56, rotation: -1.5, zIndex: 3 }],
  2: [
    { x: 0.2, y: 0.05, width: 0.52, rotation: -3, zIndex: 3 },
    { x: 0.64, y: 0.2, width: 0.34, rotation: 4, zIndex: 2 },
  ],
  // The featured print is the largest and sits in front at the centre; the two supporting prints tuck under its
  // corners, tilted in alternating directions. Each overlaps the featured print by a quarter of its own area at most.
  3: [
    { x: 0.24, y: 0.03, width: 0.42, rotation: -2, zIndex: 3 },
    { x: 0.07, y: 0.17, width: 0.29, rotation: -4, zIndex: 2 },
    { x: 0.57, y: 0.16, width: 0.29, rotation: 3, zIndex: 1 },
  ],
};

/** Share of each side print that stays visible beside the featured print on Home (the featured print covers the rest). */
export const HOME_SIDE_VISIBLE = 0.68;
/** How much wider the featured print is than a side print on Home. */
export const HOME_FEATURED_SCALE = 1.4;
/** A side print's width as a fraction of the stage, before fitting. */
const SIDE_WIDTH = 0.3;
/** Clear space kept between the outermost rotated print and the card's content edge, in points. */
export const HOME_STAGE_GUTTER = 8;

/** Mount height of a print as a multiple of its width, at the card's window aspect. */
const printHeightRatio = () => 3 * VISION_PHOTO.sidePadRatio + (1 - 2 * VISION_PHOTO.sidePadRatio) / VISION_PREVIEW_PRINT_ASPECT;

/** Horizontal extent of a tilted print, as a fraction of the stage width: its box plus the corners the tilt swings out. */
function tiltedHalfWidth(width: number, rotation: number): number {
  const height = width * printHeightRatio();
  const radians = Math.abs(rotation) * Math.PI / 180;
  return (width * Math.cos(radians) + height * Math.sin(radians)) / 2;
}

/**
 * Home's spread: positions computed from the card's own width instead of fixed fractions. The side prints are pushed
 * out until `HOME_SIDE_VISIBLE` of each shows beside the featured print, and the whole group is then fitted inside the
 * stage (less a gutter) by scaling every print together, so a narrow card shrinks the prints rather than clipping them
 * or crowding the centre. The featured print stays the largest and in front.
 */
export function visionHomePrintSlots(printCount: number, stageWidth: number): VisionPrintSlot[] {
  const count = Math.min(VISION_PREVIEW_PRINT_LIMIT, Math.max(0, Math.floor(printCount)));
  if (count === 0) return [];
  const gutter = Math.min(0.08, HOME_STAGE_GUTTER / Math.max(1, stageWidth));
  if (count === 1) return [{ x: 0.22, y: 0.05, width: 0.56, rotation: -1.5, zIndex: 3 }];
  const build = (scale: number): VisionPrintSlot[] => {
    const s = SIDE_WIDTH * scale, f = s * HOME_FEATURED_SCALE, h = s * (1 - HOME_SIDE_VISIBLE);
    const ratio = printHeightRatio(), fy = 0.03, dy = (f - s) * ratio / 2;
    // Left to right: [left side], featured, right side. The side prints are `s - h` wide beyond the featured print.
    const total = count === 3 ? f + 2 * (s - h) : f + (s - h);
    const fx = count === 3 ? (1 - total) / 2 + (s - h) : (1 - total) / 2;
    const featured: VisionPrintSlot = { x: fx, y: fy, width: f, rotation: -2, zIndex: 3 };
    const right: VisionPrintSlot = { x: fx + f - h, y: fy + dy + f * ratio * 0.03, width: s, rotation: 3, zIndex: 1 };
    if (count === 2) return [featured, right];
    return [featured, { x: fx - (s - h), y: fy + dy + f * ratio * 0.04, width: s, rotation: -4, zIndex: 2 }, right];
  };
  let scale = 1, slots = build(scale);
  for (let i = 0; i < 16; i += 1) {
    const spans = slots.map(visionPrintSpan);
    const overflow = Math.max(gutter - Math.min(...spans.map(span => span.left)), Math.max(...spans.map(span => span.right)) - (1 - gutter), 0);
    if (overflow <= 0.0005) break;
    scale *= Math.max(0.6, 1 - overflow);
    slots = build(scale);
  }
  return slots;
}

/** Slots for up to three prints; a count above three uses the three-print layout. Given a stage width, Home's spread. */
export function visionPrintSlots(printCount: number, stageWidth?: number): VisionPrintSlot[] {
  if (stageWidth !== undefined) return visionHomePrintSlots(printCount, stageWidth);
  const count = Math.min(VISION_PREVIEW_PRINT_LIMIT, Math.max(0, Math.floor(printCount)));
  if (count === 0) return [];
  return PRINT_SLOTS[count as 1 | 2 | 3];
}

export function visionStageHeight(printCount: number, stageWidth?: number): number {
  // Match VisionPhotoArtifact's mount, including the rotated bottom edge. The
  // caption follows this stage in normal flow and must never sit under a print.
  return Math.max(0, ...visionPrintSlots(printCount, stageWidth).map(slot => {
    const height = slot.width * printHeightRatio();
    const radians = slot.rotation * Math.PI / 180;
    const rotatedHeight = Math.abs(slot.width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
    return slot.y + height / 2 + rotatedHeight / 2;
  }));
}

/** A print's rotated horizontal extent, as fractions of the stage width. For layout checks. */
export function visionPrintSpan(slot: VisionPrintSlot): { left: number; right: number } {
  const centre = slot.x + slot.width / 2, half = tiltedHalfWidth(slot.width, slot.rotation);
  return { left: centre - half, right: centre + half };
}

/** Collapses whitespace and case so a caption that repeats the intention is recognised. */
export function normalizedCaption(text: string | null | undefined): string {
  return (text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The statement, unless it repeats the intention the host already shows. */
export function visionPreviewCaption(statement: string | null | undefined, intentionText?: string | null): string | null {
  // The vision text always sits under the prints; the intention stands in when the Vision has no statement of its own.
  return statement?.trim() || intentionText?.trim() || null;
}

function safeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
