import { AnchorCategory, ApiResponse, PlanetaryTier, CATEGORY_TO_TIER } from '@/types';
import { post } from '@/services/ApiClient';
import { detectCategoryFromText } from './categoryDetection';

export interface ClassificationResult {
  tier: PlanetaryTier;
  confidenceScore: number;
  category: AnchorCategory;
  isCustomFallback: boolean;
}

export const FALLBACK_CATEGORIES: readonly AnchorCategory[] = ['desire', 'custom'];

const VALID_PLANETARY_TIERS = new Set<string>([
  PlanetaryTier.SATURN,
  PlanetaryTier.JUPITER,
  PlanetaryTier.MARS,
  PlanetaryTier.SUN,
  PlanetaryTier.VENUS,
]);

export function isFallbackCategory(category: AnchorCategory): boolean {
  return category === 'desire' || category === 'custom';
}

/**
 * Precedence rule: the deterministic `CATEGORY_TO_TIER` map is authoritative for all nine
 * specific categories (`career`, `health`, `abundance`, `relationships`, `family`, `learning`,
 * `creativity`, `spirituality`, `adventure`). The Gemini tier classifier (`/api/anchors/classify-tier`)
 * is permitted to run ONLY when the resolved category is a fallback (`desire` or `custom`), i.e.
 * the exact cases where the deterministic keyword classifier or onboarding choice has declared
 * uncertainty. In all other cases the deterministic tier mapping must not be overridden.
 */
export function classifyToTierPreliminary(
  intentionText: string,
  resolvedCategory?: AnchorCategory,
): ClassificationResult {
  const category = resolvedCategory ?? detectCategoryFromText(intentionText);

  if (!isFallbackCategory(category)) {
    return {
      tier: CATEGORY_TO_TIER[category] || PlanetaryTier.SATURN,
      confidenceScore: 0.8,
      category,
      isCustomFallback: false,
    };
  }

  return {
    tier: CATEGORY_TO_TIER[category] || PlanetaryTier.SATURN,
    confidenceScore: 0.3,
    category,
    isCustomFallback: true,
  };
}

/**
 * Resolves the planetary tier for an intention while enforcing the AI tier precedence rule:
 * the deterministic `CATEGORY_TO_TIER` map is authoritative for every specific category, and
 * the Gemini `/api/anchors/classify-tier` endpoint is called ONLY when the resolved category
 * is a fallback (`desire` or `custom`). When a specific category is present, this returns the
 * deterministic mapping immediately and never invokes the LLM endpoint.
 */
export async function classifyToTier(
  intentionText: string,
  resolvedCategory?: AnchorCategory,
  requestAiTier?: (intentionText: string, category: AnchorCategory) => Promise<{ tier: string; confidenceScore: number }>,
): Promise<ClassificationResult> {
  const preliminary = classifyToTierPreliminary(intentionText, resolvedCategory);

  if (!preliminary.isCustomFallback) {
    return preliminary;
  }

  try {
    const fetcher =
      requestAiTier ??
      (async (text: string, category: AnchorCategory) => {
        const response = await post<ApiResponse<{ tier: string; confidenceScore: number }>>(
          '/api/anchors/classify-tier',
          { intentionText: text, category },
        );
        return response?.data ?? { tier: preliminary.tier, confidenceScore: preliminary.confidenceScore };
      });

    const aiResult = await fetcher(intentionText, preliminary.category);
    if (aiResult && VALID_PLANETARY_TIERS.has(aiResult.tier)) {
      return {
        tier: aiResult.tier as PlanetaryTier,
        confidenceScore:
          typeof aiResult.confidenceScore === 'number' ? aiResult.confidenceScore : preliminary.confidenceScore,
        category: preliminary.category,
        isCustomFallback: true,
      };
    }
  } catch {
    // Fall back to deterministic preliminary tier if the AI endpoint is unreachable.
  }

  return preliminary;
}
