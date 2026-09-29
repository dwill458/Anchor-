import type { ImageSourcePropType } from 'react-native';
import type { AnchorCategory } from '@/types';
import { resolveAnchorCategory } from '@/utils/categoryDetection';

/**
 * Modular environmental illustration assets for the Vision screen.
 * Surrounds the physical Vision board with quiet, restrained cartographic,
 * topographic, and botanical pen-line artwork that bridges the dark navy
 * header and the cream canvas.
 */
export interface VisionEnvironmentPack {
  /** Upper-left vintage compass rose & celestial marks on navy. */
  headerCompass: ImageSourcePropType;
  /** Upper-right botanical pen branch and navigation marks on navy. */
  headerBotanical: ImageSourcePropType;
  /** Left terrain linework, green botanical leaves, and contour lines that tuck behind the board. */
  leftEnvironment: ImageSourcePropType;
  /** Right topographic contour linework, navigation route, stars, and botanical sprig. */
  rightEnvironment: ImageSourcePropType;
  /** Faint, fading contour linework bridging navy to cream behind the board's base. */
  bottomContours: ImageSourcePropType;
}

export const DESIRE_ENVIRONMENT_PACK: VisionEnvironmentPack = {
  headerCompass: require('@/assets/vision/environment/desire-header-compass.webp'),
  headerBotanical: require('@/assets/vision/environment/desire-header-botanical.webp'),
  leftEnvironment: require('@/assets/vision/environment/desire-left-environment.webp'),
  rightEnvironment: require('@/assets/vision/environment/desire-right-environment.webp'),
  bottomContours: require('@/assets/vision/environment/desire-bottom-contours.webp'),
};

/**
 * Category-aware environmental pack registry.
 * Establishes the architecture for category-specific atmosphere while defaulting
 * cleanly to the approved Desire reference pack.
 */
export const VISION_ENVIRONMENT_PACKS: Record<AnchorCategory, VisionEnvironmentPack> = {
  desire: DESIRE_ENVIRONMENT_PACK,
  health: DESIRE_ENVIRONMENT_PACK,
  career: DESIRE_ENVIRONMENT_PACK,
  relationships: DESIRE_ENVIRONMENT_PACK,
  creativity: DESIRE_ENVIRONMENT_PACK,
  spirituality: DESIRE_ENVIRONMENT_PACK,
  abundance: DESIRE_ENVIRONMENT_PACK,
  family: DESIRE_ENVIRONMENT_PACK,
  learning: DESIRE_ENVIRONMENT_PACK,
  adventure: DESIRE_ENVIRONMENT_PACK,
  custom: DESIRE_ENVIRONMENT_PACK,
};

/** Resolves the environmental artwork pack for an Anchor's category. */
export function resolveVisionEnvironment(category?: string | null): VisionEnvironmentPack {
  const resolved = resolveAnchorCategory(category);
  return VISION_ENVIRONMENT_PACKS[resolved] ?? DESIRE_ENVIRONMENT_PACK;
}
