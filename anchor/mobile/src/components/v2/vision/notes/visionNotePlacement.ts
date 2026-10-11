import { getVisionNotePreset } from './visionNoteStyles';
import type { VisionNote, VisionNotePresentation } from '@/adapters/v2/vision';
import { detailBoardSizeForWidth, selectDetailBoardLayout } from '@/components/v2/vision/board/visionBoardLayouts';

export type VisionNoteOccupiedRect = { x: number; y: number; width: number; height: number };
/** Notes sit above photos (z 12–18) and below the Anchor card (z 40). */
export function visionNoteZIndex(layerOrder: number): number {
  return 20 + Math.min(19, Math.max(0, Math.floor(layerOrder)));
}

export function visionBoardAspectForCount(photoCount: number): number {
  const size = detailBoardSizeForWidth(1, photoCount);
  return size.height / size.width;
}
export function defaultVisionNoteOccupancy(photoCount: number): VisionNoteOccupiedRect[] {
  const layout = selectDetailBoardLayout(photoCount);
  const aspect = visionBoardAspectForCount(photoCount);
  const rectangles: VisionNoteOccupiedRect[] = layout.photos.map(photo => ({
    x: photo.x, y: photo.y, width: photo.width,
    height: photo.width / photo.aspectRatio / aspect,
  }));
  const card = layout.card;
  rectangles.push({ x: card.x, y: card.y, width: card.width, height: card.width / aspect });
  return rectangles;
}

/**
 * Suggests a normalized placement away from existing note centers. Repeated
 * notes cycle through a loose grid; board users can still reposition them.
 */
export function nextVisionNotePresentation(
  styleId: VisionNotePresentation['styleId'],
  notes: readonly VisionNote[] = [],
  occupiedRects: readonly VisionNoteOccupiedRect[] = [],
  boardAspectRatio = 1,
): VisionNotePresentation {
  const shortSideWidth = Math.max(0.12, 0.26 * Math.min(1, boardAspectRatio));
  const noteHeight = Math.max(0.12, shortSideWidth / boardAspectRatio);
  const edgeSpots = occupiedRects.slice(0, -1).flatMap(rect => [
    { x: rect.x - rect.width * 0.42, y: rect.y + rect.height * 0.36 },
    { x: rect.x + rect.width * 0.42, y: rect.y + rect.height * 0.36 },
  ]);
  const spots = [...edgeSpots, ...Array.from({ length: 25 }, (_, index) => ({
    x: 0.12 + (index % 5) * 0.19,
    y: 0.12 + Math.floor(index / 5) * 0.19,
  }))];
  const active = notes.filter(note => !note.isArchived);
  const score = (spot: { x: number; y: number }) => {
    const overlap = (rect: VisionNoteOccupiedRect) => {
      const area = Math.max(0, Math.min(spot.x + shortSideWidth / 2, rect.x + rect.width / 2) - Math.max(spot.x - shortSideWidth / 2, rect.x - rect.width / 2)) *
        Math.max(0, Math.min(spot.y + noteHeight / 2, rect.y + rect.height / 2) - Math.max(spot.y - noteHeight / 2, rect.y - rect.height / 2));
      return area;
    };
    // With no focal metadata, protect the central subject region, especially
    // the hero, and the Anchor card. Light overlap at photo corners is welcome.
    const noteArea = shortSideWidth * noteHeight;
    const cardIndex = occupiedRects.length - 1;
    let result = occupiedRects.reduce((sum, rect, index) => sum +
      overlap(index === cardIndex ? rect : { ...rect, width: rect.width * 0.58, height: rect.height * 0.60 }) / noteArea *
      (index === cardIndex ? 12 : index === 0 ? 7 : 4), 0);
    if (occupiedRects.length) {
      const distance = Math.min(...occupiedRects.slice(0, -1).map(rect => Math.hypot(
        Math.max(0, Math.abs(spot.x - rect.x) - rect.width / 2),
        Math.max(0, Math.abs(spot.y - rect.y) - rect.height / 2) * boardAspectRatio)));
      if (Number.isFinite(distance)) result += distance * 6;
    }
    // Prefer the visible upper composition for a new note. Empty space below
    // the collage is not a better placement merely because it has no photos.
    result += Math.max(0, spot.y - 0.38) * 8;
    result += Math.hypot(spot.x - 0.5, (spot.y - 0.38) * 0.5) * 0.25;
    for (const note of active) result += overlap({ x: note.presentation.x, y: note.presentation.y, width: note.presentation.width * note.presentation.scale, height: note.presentation.height * note.presentation.scale }) / noteArea * 12;
    return result;
  };
  const clear = (spot: { x: number; y: number }) => active.every(note => {
    const p = note.presentation;
    const dx = (spot.x - p.x) / Math.max(shortSideWidth, p.width * p.scale);
    const dy = (spot.y - p.y) / Math.max(noteHeight, p.height * p.scale);
    return dx * dx + dy * dy > 0.7;
  });
  const safeSpots = spots.map(spot => {
    const initial = { styleId, ...spot, width: shortSideWidth, height: noteHeight,
      rotation: getVisionNotePreset(styleId).rotation || -1.2, scale: 1, layerOrder: 0 };
    const fitted = clampVisionNotePresentationForAspect(initial, boardAspectRatio);
    const minimum = clampVisionNotePresentationForAspect({ ...initial, x: 0, y: 0 }, boardAspectRatio);
    const inset = 0.025;
    return { ...fitted,
      x: Math.min(1 - minimum.x - inset, Math.max(minimum.x + inset, fitted.x)),
      y: Math.min(1 - minimum.y - inset, Math.max(minimum.y + inset, fitted.y)),
    };
  });
  const available = safeSpots.filter(clear);
  const point = (available.length ? available : safeSpots).reduce((best, spot) => score(spot) < score(best) ? spot : best);
  return {
    styleId,
    x: point.x,
    y: point.y,
    width: shortSideWidth,
    height: noteHeight,
    rotation: getVisionNotePreset(styleId).rotation || -1.2,
    scale: 1,
    layerOrder: Math.min(1000, active.reduce((max, note) => Math.max(max, note.presentation.layerOrder), -1) + 1),
  };
}

export function clampVisionNotePresentationForAspect(p: VisionNotePresentation, _boardAspectRatio: number): VisionNotePresentation {
  const angle = p.rotation * Math.PI / 180;
  // Mirror the API's conservative limits so saved geometry remains valid when
  // adding/removing photos changes the board aspect ratio.
  const halfWidth = (Math.abs(p.width * p.scale * Math.cos(angle)) + Math.abs(p.height * 2.65 * p.scale * Math.sin(angle))) / 2;
  const halfHeight = (Math.abs(p.height * p.scale * Math.cos(angle)) + Math.abs(p.width / 0.45 * p.scale * Math.sin(angle))) / 2;
  return { ...p, x: Math.min(1 - halfWidth, Math.max(halfWidth, p.x)), y: Math.min(1 - halfHeight, Math.max(halfHeight, p.y)) };
}

/** Conservative scale cap matching the server's supported board-aspect range. */
export function maximumVisionNoteScale(p: VisionNotePresentation): number {
  const angle = p.rotation * Math.PI / 180;
  const c = Math.abs(Math.cos(angle)); const s = Math.abs(Math.sin(angle));
  return Math.max(0.5, Math.min(2, 1 / (p.width * c + p.height * 2.65 * s), 1 / (p.height * c + p.width / 0.45 * s)));
}
