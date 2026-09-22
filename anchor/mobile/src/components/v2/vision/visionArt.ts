import type { ImageSourcePropType } from 'react-native';
import type { AnchorCategory } from '@/types';
import { resolveAnchorCategory } from '@/utils/categoryDetection';

/**
 * Photography for an Anchor that has no Vision yet: a quiet, deliberately
 * ambiguous glimpse of a possible future. Colour-neutral files; the category
 * wash is applied at render time by `VisionPhoto`. Once a Vision exists, the
 * person's own cover image replaces these everywhere.
 *
 * One photograph per established category, no sharing. The key is the
 * persisted Anchor category (via `resolveAnchorCategory`), never a fresh
 * reading of the intention text.
 */
export const VISION_ENTRANCE_ART: Record<AnchorCategory, ImageSourcePropType> = {
  desire: require('@/assets/vision/vision-future-window.jpg'),
  health: require('@/assets/vision/vision-future-movement.jpg'),
  career: require('@/assets/vision/vision-future-desk.jpg'),
  relationships: require('@/assets/vision/vision-future-home.jpg'),
  creativity: require('@/assets/vision/vision-future-studio.jpg'),
  spirituality: require('@/assets/vision/vision-future-sanctuary.jpg'),
  abundance: require('@/assets/vision/vision-future-abundance.jpg'),
  family: require('@/assets/vision/vision-future-family.jpg'),
  learning: require('@/assets/vision/vision-future-learning.jpg'),
  adventure: require('@/assets/vision/vision-future-threshold.jpg'),
  custom: require('@/assets/vision/vision-future-open.jpg'),
};

export function visionPossibleFuturePhoto(category?: string | null): ImageSourcePropType {
  // Unknown or missing categories resolve to Custom, which always has art.
  return VISION_ENTRANCE_ART[resolveAnchorCategory(category)];
}

/** Wide crop for the Anchor Details "no Vision yet" card. */
export const VISION_POSSIBLE_FUTURE_WIDE: ImageSourcePropType = require('@/assets/vision/vision-future-window-wide.jpg');

/** Every bundled Vision photo, for pre-decoding ahead of navigation. */
export const VISION_POSSIBLE_FUTURE_ALL: ImageSourcePropType[] = Object.values(VISION_ENTRANCE_ART);
