import type { V2VisionTile, VisionNote } from '@/adapters/v2/vision';
import { composeVisionBoard } from '../board/visionBoardComposition';
import { VISION_BOARD_PAPER_MARK_SCALE } from '../board/visionBoardLayouts';
import type { VisionNoteOccupiedRect } from './visionNotePlacement';

/**
 * Where the saved Classic board really holds its prints and its Anchor, in a note's coordinates (x in board widths, y as a
 * share of the note base height). Note presentations are stored in those coordinates, so a new note placed against these
 * rects lands on paper on the board the person sees, not where the old detail board used to keep its photographs.
 * Order matches `nextVisionNotePresentation`: the hero print first when it is on the board, the Anchor last.
 */
export function classicVisionNoteOccupancy(
  tiles: readonly V2VisionTile[],
  notes: readonly VisionNote[],
  slotMap: readonly (string | null)[],
): VisionNoteOccupiedRect[] {
  const composition = composeVisionBoard({ tiles, notes, width: 1, boardLayout: 'CLASSIC', slotMap });
  const { ratio, noteBaseRatio, layout } = composition;
  const toNoteY = (boardY: number) => (boardY * ratio) / noteBaseRatio;
  const rects: VisionNoteOccupiedRect[] = layout.photos.flatMap((photo, slot) => {
    if (!composition.slotMap[slot]) return [];
    const band = photo.caption?.kind === 'band' ? photo.caption.extra : 0;
    const height = photo.width / photo.aspectRatio;
    // The caption band hangs under the window; the rect grows down to cover it, keeping its top edge.
    return [{ x: photo.x, y: toNoteY(photo.y) + band / 2 / noteBaseRatio, width: photo.width, height: (height + band) / noteBaseRatio }];
  });
  const seal = layout.card.width * VISION_BOARD_PAPER_MARK_SCALE;
  rects.push({ x: layout.card.x, y: toNoteY(layout.card.y), width: seal, height: seal / noteBaseRatio });
  return rects;
}
