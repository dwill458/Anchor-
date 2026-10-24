import { boardSizeForWidth, boardPrintRect, boardCaptionRect, detailBoardSizeForWidth, selectBoardLayout, selectDetailBoardLayout, toSceneRect, VISION_BOARD_PAPER_MARK_SCALE,
  type BoardLayout, type Size } from '@/components/v2/vision/board/visionBoardLayouts';
import type { VisionNote } from '@/adapters/v2/vision';

export type VisualizePhotoFrame = {
  scene: Size;
  width: number;
  height: number;
  scale: number;
  sceneOriginX: number;
  sceneOriginY: number;
  sceneLayoutLeft: number;
  sceneLayoutTop: number;
};

export const VISUALIZE_PHOTO_MAX_HEIGHT_FRACTION = 0.8;
const PHOTO_FRAME_BLEED = 12;

/** Leaves room for all non-photo setup content inside the measured scroll viewport. */
export function availableVisualizePhotoHeight(input: {
  viewportHeight: number;
  headingHeight: number;
  identityHeight?: number;
  topPadding: number;
  bodyGap: number;
  maximumHeight: number;
}): number {
  // The entrance opts into reserving its measured identity. Other callers retain
  // the original photo-only budget; duration/audio controls stay in the scroll flow.
  const fixedContent = input.headingHeight + input.topPadding + input.bodyGap
    + (input.identityHeight === undefined ? 0 : input.identityHeight + input.bodyGap);
  return Math.max(1, Math.min(input.maximumHeight, input.viewportHeight - fixedContent - 4));
}

export type VisualizeRect = { x: number; y: number; width: number; height: number };

/** Expanded photo scenes retain the exact legacy Anchor card rectangle used by the guided session. */
export function preserveVisualizeAnchorLayout(layout: BoardLayout, imageCount: number, scene: Size): BoardLayout {
  const legacyScene = boardSizeForWidth(scene.width, imageCount);
  const legacyCard = selectBoardLayout(imageCount).card;
  return { ...layout, card: { ...legacyCard, y: legacyCard.y * legacyScene.height / scene.height } };
}

/** The ready-state scene origin inside its union-bounds preview frame. */
export function visualizePhotoSceneTarget(targetFrame: VisualizeRect, photoFrame: VisualizePhotoFrame): VisualizeRect {
  return { x: targetFrame.x + photoFrame.sceneOriginX, y: targetFrame.y + photoFrame.sceneOriginY,
    width: photoFrame.scene.width * photoFrame.scale, height: photoFrame.scene.height * photoFrame.scale };
}

/** Interpolated transform keeps the whole measured source scene aligned to the target scene bounds. */
export function visualizeEntrySceneTransform(progress: number, sourceFrame: VisualizeRect, photoFrame: VisualizePhotoFrame) {
  'worklet';
  const scale = sourceFrame.width / Math.max(1, photoFrame.scene.width)
    + (photoFrame.scale - sourceFrame.width / Math.max(1, photoFrame.scene.width)) * progress;
  return { scale, left: -photoFrame.scene.width * (1 - scale) / 2, top: -photoFrame.scene.height * (1 - scale) / 2 };
}

type EntranceDecor = { anchor?: boolean; notes?: readonly VisionNote[]; layout?: BoardLayout; order?: readonly string[] };

function photoCompositionBounds(imageCount: number, scene: Size, decor?: EntranceDecor) {
  const layout = decor?.layout ?? selectDetailBoardLayout(imageCount);
  const rectangles = layout.photos.filter((_,i)=>!decor?.order||decor.order[i]).flatMap(photo => {
    const caption=boardCaptionRect(photo,scene);
    return caption?[boardPrintRect(photo,scene),caption]:[boardPrintRect(photo,scene)];
  });
  if (decor?.anchor) {
    const rect = toSceneRect(layout.card, scene);
    const diameter = rect.width * VISION_BOARD_PAPER_MARK_SCALE;
    rectangles.push({ ...rect, x: rect.x + (rect.width - diameter) / 2, y: rect.y + (rect.height - diameter) / 2,
      width: diameter, height: diameter });
  }
  for (const note of decor?.notes ?? []) {
    if (note.isArchived) continue;
    const p = note.presentation;
    const width = p.width * scene.width * p.scale;
    const height = p.height * scene.height * p.scale;
    rectangles.push({ x: p.x * scene.width - width / 2, y: p.y * scene.height - height / 2,
      width, height, rotation: p.rotation, zIndex: p.layerOrder });
  }
  const bounds = rectangles.map(rect => {
    const radians = rect.rotation * Math.PI / 180;
    const width = Math.abs(rect.width * Math.cos(radians)) + Math.abs(rect.height * Math.sin(radians));
    const height = Math.abs(rect.height * Math.cos(radians)) + Math.abs(rect.width * Math.sin(radians));
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    return { left: centerX - width / 2, right: centerX + width / 2, top: centerY - height / 2, bottom: centerY + height / 2 };
  });
  if (bounds.length === 0) return { left: 0, right: scene.width, top: 0, bottom: scene.height };
  return {
    left: Math.min(...bounds.map(rect => rect.left)) - PHOTO_FRAME_BLEED,
    right: Math.max(...bounds.map(rect => rect.right)) + PHOTO_FRAME_BLEED,
    top: Math.min(...bounds.map(rect => rect.top)) - PHOTO_FRAME_BLEED,
    bottom: Math.max(...bounds.map(rect => rect.bottom)) + PHOTO_FRAME_BLEED,
  };
}

/**
 * Fit the existing board photo composition into a preview frame. The scene
 * itself is never cropped or reshaped; scale is uniform so every photo keeps
 * its saved relationship to the others.
 */
export function fitVisualizePhotoFrame(
  sceneWidth: number,
  imageCount: number,
  maxWidth: number,
  maxHeight: number,
  sceneHeight?: number,
  decor?: EntranceDecor,
): VisualizePhotoFrame {
  const scene = Number.isFinite(sceneHeight) && (sceneHeight ?? 0) > 0
    ? { width: sceneWidth, height: sceneHeight! }
    : detailBoardSizeForWidth(sceneWidth, imageCount);
  const bounds = photoCompositionBounds(imageCount, scene, decor);
  const compositionWidth = Math.max(1, bounds.right - bounds.left);
  const compositionHeight = Math.max(1, bounds.bottom - bounds.top);
  const scale = Math.min(1, Math.max(1, maxWidth) / compositionWidth, Math.max(1, maxHeight) / compositionHeight);
  const width = compositionWidth * scale;
  const height = compositionHeight * scale;
  const sceneOriginX = -bounds.left * scale;
  const sceneOriginY = -bounds.top * scale;
  return { scene, scale, width, height, sceneOriginX, sceneOriginY,
    sceneLayoutLeft: sceneOriginX - scene.width * (1 - scale) / 2,
    sceneLayoutTop: sceneOriginY - scene.height * (1 - scale) / 2 };
}
