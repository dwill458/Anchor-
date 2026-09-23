import type { ImageSourcePropType } from 'react-native';
import type { AnchorCategory } from '@/types';
import { resolveAnchorCategory } from '@/utils/categoryDetection';

/**
 * Curated category atmosphere for the Vision entrance only. These are never
 * used as generation inputs or substitutes for a person's own Vision images.
 */
export const VISION_ENTRANCE_ART: Record<AnchorCategory, readonly ImageSourcePropType[]> = {
  desire: [require('@/assets/vision/entrance/desire-1.jpg'), require('@/assets/vision/entrance/desire-2.jpg'), require('@/assets/vision/entrance/desire-3.jpg')],
  health: [require('@/assets/vision/entrance/health-1.jpg'), require('@/assets/vision/entrance/health-2.jpg'), require('@/assets/vision/entrance/health-3.jpg')],
  career: [require('@/assets/vision/entrance/career-1.jpg'), require('@/assets/vision/entrance/career-2.jpg'), require('@/assets/vision/entrance/career-3.jpg')],
  relationships: [require('@/assets/vision/entrance/relationships-1.jpg'), require('@/assets/vision/entrance/relationships-2.jpg'), require('@/assets/vision/entrance/relationships-3.jpg')],
  creativity: [require('@/assets/vision/entrance/creativity-1.jpg'), require('@/assets/vision/entrance/creativity-2.jpg'), require('@/assets/vision/entrance/creativity-3.jpg')],
  spirituality: [require('@/assets/vision/entrance/spirituality-1.jpg'), require('@/assets/vision/entrance/spirituality-2.jpg'), require('@/assets/vision/entrance/spirituality-3.jpg')],
  abundance: [require('@/assets/vision/entrance/abundance-1.jpg'), require('@/assets/vision/entrance/abundance-2.jpg'), require('@/assets/vision/entrance/abundance-3.jpg')],
  family: [require('@/assets/vision/entrance/family-1.jpg'), require('@/assets/vision/entrance/family-2.jpg'), require('@/assets/vision/entrance/family-3.jpg')],
  learning: [require('@/assets/vision/entrance/learning-1.jpg'), require('@/assets/vision/entrance/learning-2.jpg'), require('@/assets/vision/entrance/learning-3.jpg')],
  adventure: [require('@/assets/vision/entrance/adventure-1.jpg'), require('@/assets/vision/entrance/adventure-2.jpg'), require('@/assets/vision/entrance/adventure-3.jpg')],
  custom: [require('@/assets/vision/entrance/custom-1.jpg'), require('@/assets/vision/entrance/custom-2.jpg'), require('@/assets/vision/entrance/custom-3.jpg')],
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** The same persisted Anchor retains its scene; peers in a category vary. */
export function visionEntranceScene(category?: string | null, anchorId?: string | null): ImageSourcePropType {
  const scenes = VISION_ENTRANCE_ART[resolveAnchorCategory(category)];
  const index = anchorId ? stableHash(anchorId) % scenes.length : 0;
  return scenes[index];
}

export function visionPossibleFuturePhoto(category?: string | null, anchorId?: string | null): ImageSourcePropType {
  return visionEntranceScene(category, anchorId);
}

/** Wide crop for the Anchor Details "no Vision yet" card. */
export const VISION_POSSIBLE_FUTURE_WIDE: ImageSourcePropType = require('@/assets/vision/vision-future-window-wide.jpg');

/** Every bundled entrance photo, for pre-decoding ahead of navigation. */
export const VISION_POSSIBLE_FUTURE_ALL: ImageSourcePropType[] = Object.values(VISION_ENTRANCE_ART).flatMap(scenes => [...scenes]);
