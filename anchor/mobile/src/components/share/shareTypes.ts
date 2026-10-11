import type { AnchorExpression } from '@/constants/v2/creation';
import type { VisionNote, V2VisionTile } from '@/adapters/v2/vision';

export type ShareLayoutId = 'minimal' | 'style' | 'editorial' | 'vision';

/** The one export size for now. Other ratios (1:1, 4:5, Pinterest tall) plug in beside it. */
export const SHARE_EXPORT_SIZE = { width: 1080, height: 1920 } as const;
export const SHARE_ASPECT = SHARE_EXPORT_SIZE.height / SHARE_EXPORT_SIZE.width;

export const SHARE_LAYOUT_LABELS: Record<ShareLayoutId, string> = {
  minimal: 'Minimal',
  style: 'Style',
  editorial: 'Editorial',
  vision: 'Vision',
};

/**
 * Everything an export template is allowed to print. Real Anchor data only:
 * there is no slot for invented copy.
 */
export interface ShareExportData {
  /** Stable structure SVG (reinforced if present, else base). */
  svg: string;
  /** The finished, styled Anchor artwork. It only ever fills the circular Anchor; it is never used as a background. */
  imageUrl?: string | null;
  category: string;
  /** "Abundance" */
  categoryLabel: string;
  expression?: AnchorExpression;
  intention: string;
  /** "Building" — present only when the Anchor has an established thread. */
  stateLabel?: string | null;
  /** Canonical creation-style id (e.g. "velvet-ember"); selects the Share Environment. Null means the neutral ground. */
  styleId?: string | null;
  /** The user's actual Vision image. Absent means the Vision layout is not offered. */
  visionImageUrl?: string | null;
  /** Ordered board photographs from the user's persisted Vision. */
  visionTiles?: readonly V2VisionTile[] | null;
  /** Persisted board notes, including their original placement and layer order. */
  visionNotes?: readonly VisionNote[] | null;
  /** The board's optional handwritten annotation. */
  visionAnnotation?: string | null;
}

export interface ShareTemplateProps {
  data: ShareExportData;
  /** Rendered width in dp. Every measurement inside a template derives from this, so one template serves thumbnails, the preview and the export. */
  width: number;
  showMark: boolean;
  /** Fired once each image the template depends on has loaded or failed. */
  onAssetsReady?: () => void;
}

export function availableShareLayouts(data: Pick<ShareExportData, 'visionImageUrl' | 'visionTiles' | 'visionNotes'>): ShareLayoutId[] {
  const layouts: ShareLayoutId[] = ['minimal', 'style', 'editorial'];
  const hasBoardContent = Boolean(data.visionTiles?.some(tile => tile.imageUrl?.trim()) || data.visionNotes?.some(note => !note.isArchived && note.content.text.trim()));
  if (hasBoardContent || data.visionImageUrl?.trim()) layouts.push('vision');
  return layouts;
}
