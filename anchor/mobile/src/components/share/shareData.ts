import { anchorArtworkSvg, anchorKeptExpression, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { Anchor } from '@/types';
import type { VisionNote, V2VisionTile } from '@/adapters/v2/vision';
import { resolveShareStyleId } from './shareEnvironments';
import type { ShareExportData } from './shareTypes';

type ShareAnchor = Pick<
  Anchor,
  'intentionText' | 'category' | 'baseSigilSvg' | 'reinforcedSigilSvg' | 'enhancedImageUrl' | 'classifierMeta' | 'enhancementMetadata'
> & Partial<Pick<Anchor, 'id'>>;

/**
 * Everything a share template may print, taken from the Anchor's own data.
 * Nothing here is generated: an absent Vision image or state simply stays absent.
 */
export function buildShareExportData(
  anchor: ShareAnchor,
  extras: {
    visionImageUrl?: string | null;
    visionTiles?: readonly V2VisionTile[] | null;
    visionNotes?: readonly VisionNote[] | null;
    visionAnnotation?: string | null;
    stateLabel?: string | null;
  } = {},
): ShareExportData {
  return {
    anchorId: anchor.id,
    svg: anchorArtworkSvg(anchor),
    imageUrl: anchor.enhancedImageUrl,
    category: anchor.category,
    categoryLabel: categoryLabel(anchor.category),
    expression: anchorKeptExpression(anchor),
    styleId: resolveShareStyleId([anchor.classifierMeta?.v2StyleChoice, anchor.enhancementMetadata?.styleApplied]),
    intention: anchor.intentionText.trim(),
    stateLabel: extras.stateLabel ?? null,
    visionImageUrl: extras.visionImageUrl || extras.visionTiles?.find(tile => tile.imageUrl?.trim())?.imageUrl || null,
    visionTiles: extras.visionTiles ?? null,
    visionNotes: extras.visionNotes ?? null,
    visionAnnotation: extras.visionAnnotation ?? null,
  };
}
