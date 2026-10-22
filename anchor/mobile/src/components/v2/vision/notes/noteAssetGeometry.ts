import type { NoteAssetKey } from '@/assets/vision/notes/noteAssets';

/** Measured nontransparent bounds at alpha > 12 in the 512px shared paper cutouts. */
const ALPHA_BOUNDS: Partial<Record<NoteAssetKey, { left: number; top: number; right: number; bottom: number }>> = {
  tornPaper: { left: 13 / 512, top: 14 / 512, right: 501 / 512, bottom: 502 / 512 },
  handmadePaper: { left: 19 / 512, top: 20 / 512, right: 501 / 512, bottom: 499 / 512 },
};

/** Fit the visible alpha silhouette to a note frame without cropping its irregular edge. */
export function resolveNoteAssetFrame(asset: NoteAssetKey, width: number, height: number) {
  const bounds = ALPHA_BOUNDS[asset];
  if (!bounds || width <= 0 || height <= 0) return { position: 'absolute' as const, left: 0, top: 0, width, height };
  const contentWidth = bounds.right - bounds.left;
  const contentHeight = bounds.bottom - bounds.top;
  const scale = Math.min(width / contentWidth, height / contentHeight);
  const renderedWidth = scale;
  const renderedHeight = scale;
  return {
    position: 'absolute' as const,
    left: (width - contentWidth * scale) / 2 - bounds.left * renderedWidth,
    top: (height - contentHeight * scale) / 2 - bounds.top * renderedHeight,
    width: renderedWidth,
    height: renderedHeight,
  };
}
