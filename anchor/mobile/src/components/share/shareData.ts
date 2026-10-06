import { anchorArtworkSvg, anchorKeptExpression, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { Anchor } from '@/types';
import { resolveShareStyleId } from './shareEnvironments';
import type { ShareExportData } from './shareTypes';

type ShareAnchor = Pick<
  Anchor,
  'intentionText' | 'category' | 'baseSigilSvg' | 'reinforcedSigilSvg' | 'enhancedImageUrl' | 'classifierMeta' | 'enhancementMetadata'
>;

/**
 * Everything a share template may print, taken from the Anchor's own data.
 * Nothing here is generated: an absent Vision image or state simply stays absent.
 */
export function buildShareExportData(
  anchor: ShareAnchor,
  extras: { visionImageUrl?: string | null; stateLabel?: string | null } = {},
): ShareExportData {
  return {
    svg: anchorArtworkSvg(anchor),
    imageUrl: anchor.enhancedImageUrl,
    category: anchor.category,
    categoryLabel: categoryLabel(anchor.category),
    expression: anchorKeptExpression(anchor),
    styleId: resolveShareStyleId([anchor.classifierMeta?.v2StyleChoice, anchor.enhancementMetadata?.styleApplied]),
    intention: anchor.intentionText.trim(),
    stateLabel: extras.stateLabel ?? null,
    visionImageUrl: extras.visionImageUrl || null,
  };
}
