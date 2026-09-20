import { API_URL } from '@/config';
import { AuthService } from '@/services/AuthService';
import type { AnchorExpression } from '@/constants/v2/creation';
import type { AnchorCandidate, CreationDraft } from '@/stores/v2/creationStore';
import type { EnhancementMetadata } from '@/types';

/**
 * V2 "finishes" are user-facing names; the backend renders them through its style library.
 * Every value here must be a member of the backend's `AI_STYLE_IDS`.
 */
export const EXPRESSION_TO_AI_STYLE: Record<AnchorExpression, string> = {
  original: 'original',
  monoline: 'minimal_line',
  architectural: 'architectural_trace',
  foil: 'gold_leaf',
  embossed: 'stone_relief',
  etched: 'lunar_etch',
  ink: 'ink_brush',
  halo: 'halo_drift',
  glass: 'tideglass',
  radiant: 'solar_halo',
  organic: 'botanical_etching',
  woven: 'collage_archive',
  cut_paper: 'cut_paper',
};

/** Generation is slow; the backend has its own timeout, this only stops a dead connection hanging the flow. */
const REQUEST_TIMEOUT_MS = 120_000;

type EnhanceVariation = { imageUrl?: unknown; variationId?: unknown; reusedFromPool?: unknown };

/**
 * Asks the enhance endpoint to render the drafted structure in the chosen finish and returns exactly two
 * candidates. Both share the draft's structure SVG (formation truth); only the rendered image differs.
 *
 * Throws when generation fails or fewer than two hosted images come back, so the creation flow surfaces its
 * retry state instead of silently saving the flat structure.
 */
export async function generateEnhancedCandidates(draft: CreationDraft): Promise<AnchorCandidate[]> {
  const expression = draft.expression ?? 'original';
  const structureSvg = draft.structureSvg;
  if (!structureSvg) throw new Error('Your Anchor structure is not ready yet.');

  const styleChoice = EXPRESSION_TO_AI_STYLE[expression];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const token = await AuthService.getIdToken();
    const response = await fetch(`${API_URL}/api/ai/enhance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        sigilSvg: structureSvg,
        styleChoice,
        intentionText: draft.intention,
        anchorId: `temp-${Date.now()}`,
        provider: 'gemini',
        tier: 'premium',
        generationAttempt: 1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'AI enhancement failed');
    }

    const result = await response.json();
    const variations: EnhanceVariation[] = Array.isArray(result.variations) ? result.variations : [];
    // Only hosted images are kept: inline base64 is far too large for the persisted creation draft.
    const hosted = variations.filter(
      (variation): variation is EnhanceVariation & { imageUrl: string } =>
        typeof variation.imageUrl === 'string' && variation.imageUrl.startsWith('http'),
    );
    if (hosted.length < 2) throw new Error('Generation did not return two forms.');

    return hosted.slice(0, 2).map((variation, index) => {
      const enhancementMetadata: EnhancementMetadata = {
        styleApplied: styleChoice,
        modelUsed: result.model || 'unknown-model',
        provider: result.provider || 'unknown',
        controlMethod: result.controlMethod || 'lineart',
        generationTimeMs: typeof result.generationTime === 'number' ? result.generationTime * 1000 : 0,
        promptUsed: result.prompt || '',
        negativePrompt: result.negativePrompt || '',
        appliedAt: new Date(),
        variationId: typeof variation.variationId === 'string' && variation.variationId ? variation.variationId : undefined,
        reuseRequestId: result.reuseRequestId || undefined,
        reusedFromPool: variation.reusedFromPool === true,
      };
      return {
        id: `${draft.draftId}-candidate-${index + 1}`,
        structureSvg,
        expression,
        imageUrl: variation.imageUrl,
        enhancementMetadata,
      };
    });
  } finally {
    clearTimeout(timeout);
  }
}
