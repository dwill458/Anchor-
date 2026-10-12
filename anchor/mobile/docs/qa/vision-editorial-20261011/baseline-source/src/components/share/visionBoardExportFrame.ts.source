import type { VisionNote } from '@/adapters/v2/vision';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { toSceneRect, type BoardLayout, type SceneRect, type Size } from '@/components/v2/vision/board/visionBoardLayouts';

export type VisionBoardExportFrame = { scale: number; left: number; top: number; bounds: { left: number; top: number; right: number; bottom: number } };

function includeRect(bounds: { left: number; top: number; right: number; bottom: number }, rect: Pick<SceneRect, 'x' | 'y' | 'width' | 'height' | 'rotation'>) {
  const radians = (rect.rotation * Math.PI) / 180;
  const halfWidth = (Math.abs(rect.width * Math.cos(radians)) + Math.abs(rect.height * Math.sin(radians))) / 2;
  const halfHeight = (Math.abs(rect.width * Math.sin(radians)) + Math.abs(rect.height * Math.cos(radians))) / 2;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  bounds.left = Math.min(bounds.left, centerX - halfWidth);
  bounds.top = Math.min(bounds.top, centerY - halfHeight);
  bounds.right = Math.max(bounds.right, centerX + halfWidth);
  bounds.bottom = Math.max(bounds.bottom, centerY + halfHeight);
}

/** Fits the existing board's real photo/card/note bounds without changing their relative geometry. */
export function visionBoardExportFrame(
  scene: Size,
  layout: BoardLayout,
  notes: readonly VisionNote[],
  viewport: Size,
  margin = viewport.width * 0.055,
  tiles: readonly V2VisionTile[] = [],
  overlays: readonly Pick<SceneRect, 'x' | 'y' | 'width' | 'height' | 'rotation'>[] = [],
): VisionBoardExportFrame {
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const slot of layout.photos) includeRect(bounds, toSceneRect(slot, scene));
  layout.photos.forEach((slot, index) => {
    if (!tiles[index]?.caption?.trim()) return;
    const photo = toSceneRect(slot, scene);
    includeRect(bounds, { ...photo, y: photo.y + photo.height + 5, height: 14 });
  });
  includeRect(bounds, toSceneRect(layout.card, scene));
  for (const note of notes) {
    if (note.isArchived || !note.content.text.trim()) continue;
    const { presentation } = note;
    const width = presentation.width * scene.width * presentation.scale;
    const height = presentation.height * scene.height * presentation.scale;
    includeRect(bounds, {
      x: presentation.x * scene.width - width / 2,
      y: presentation.y * scene.height - height / 2,
      width,
      height,
      rotation: presentation.rotation,
    });
  }
  for (const overlay of overlays) includeRect(bounds, overlay);

  // The card is always present, so valid board data has finite bounds. Keep a safe fallback for malformed payloads.
  if (!Number.isFinite(bounds.left)) {
    bounds.left = 0;
    bounds.top = 0;
    bounds.right = scene.width;
    bounds.bottom = scene.height;
  }
  const contentWidth = Math.max(1, bounds.right - bounds.left);
  const contentHeight = Math.max(1, bounds.bottom - bounds.top);
  const scale = Math.min((viewport.width - margin * 2) / contentWidth, (viewport.height - margin * 2) / contentHeight);
  return {
    scale,
    left: (viewport.width - contentWidth * scale) / 2 - bounds.left * scale,
    top: (viewport.height - contentHeight * scale) / 2 - bounds.top * scale,
    bounds,
  };
}
