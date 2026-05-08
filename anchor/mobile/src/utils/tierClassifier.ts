import { AnchorCategory, PlanetaryTier, CATEGORY_TO_TIER } from '@/types';
import { detectCategoryFromText } from './categoryDetection';

export interface ClassificationResult {
  tier: PlanetaryTier;
  confidenceScore: number;
  category: AnchorCategory;
  isCustomFallback: boolean;
}

/**
 * Classifies the intention text to a planetary tier.
 * It first uses the local keyword detection to find a category.
 * If the category is clear and not 'custom', it maps directly to a tier.
 * If it's 'custom' or the caller needs a fallback, this would typically
 * call the backend /classify-tier endpoint.
 * 
 * Note: Since the backend call is async, this function returns a
 * preliminary result and the caller decides whether to fetch the fallback.
 */
export function classifyToTierPreliminary(intentionText: string): ClassificationResult {
  const category = detectCategoryFromText(intentionText);
  
  if (category !== 'custom' && category !== 'desire') {
    // 'desire' often acts as a fallback in categoryDetection, we might want to check it via LLM too if needed.
    // For now, if we have a direct mapping, use it with a moderate/high confidence.
    return {
      tier: CATEGORY_TO_TIER[category] || PlanetaryTier.SATURN,
      confidenceScore: 0.8,
      category,
      isCustomFallback: false
    };
  }

  // If we couldn't confidently classify using keywords
  return {
    tier: CATEGORY_TO_TIER[category] || PlanetaryTier.SATURN,
    confidenceScore: 0.3,
    category,
    isCustomFallback: true
  };
}
