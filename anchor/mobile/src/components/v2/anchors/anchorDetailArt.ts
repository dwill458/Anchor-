import type { ImageSourcePropType } from 'react-native';
import type { V2PracticeMode } from '@/constants/v2/practice';

/**
 * Bundled artwork for Anchor Details. Shared so Home can warm the art of the
 * screen it is most likely to open next (see `V2AssetPrewarm`).
 */
export const ANCHOR_DETAIL_HERO_ART: Record<string, ImageSourcePropType> = {
  desire: require('@/assets/anchor-details/categories/desire-details.jpg'),
  health: require('@/assets/anchor-details/categories/health-details.jpg'),
  career: require('@/assets/anchor-details/categories/career-details-palette.jpg'),
  relationships: require('@/assets/anchor-details/categories/relationships-details.jpg'),
  creativity: require('@/assets/anchor-details/categories/creativity-details-palette.jpg'),
  spirituality: require('@/assets/anchor-details/categories/spirituality-details-palette.jpg'),
  abundance: require('@/assets/anchor-details/categories/abundance-details.jpg'),
  family: require('@/assets/anchor-details/categories/family-details-palette.jpg'),
  learning: require('@/assets/anchor-details/categories/learning-details.jpg'),
  adventure: require('@/assets/anchor-details/categories/adventure-details-palette.jpg'),
  focus: require('@/assets/anchor-details/categories/focus-details.jpg'),
  custom: require('@/assets/anchor-details/categories/custom-details-palette.jpg'),
};
export const ANCHOR_DETAIL_PRACTICE_ART: Record<V2PracticeMode, ImageSourcePropType> = {
  focus: require('@/assets/practice/today/focus.jpg'),
  deep_prime: require('@/assets/practice/today/deep-prime.jpg'),
  visualize: require('@/assets/practice/today/visualize.jpg'),
  release: require('@/assets/practice/today/release.jpg'),
};
export const ANCHOR_DETAIL_EMPTY_ART = {
  // Photography, not landscape illustration: see src/assets/vision/README.md.
  vision: require('@/assets/vision/vision-future-window-wide.jpg'),
  chart: require('@/assets/anchor-details/chart-empty-card.jpg'),
} satisfies Record<'vision' | 'chart', ImageSourcePropType>;
