import type { ImageSourcePropType } from 'react-native';

/** Bundled Home environments. All categories are mounted up-front for flicker-free switching. */
export const HOME_CATEGORY_ART: Readonly<Record<string, ImageSourcePropType>> = {
  desire: require('@/assets/home/categories/desire-home-compact.jpg'),
  health: require('@/assets/home/categories/health-home-compact.jpg'),
  career: require('@/assets/home/categories/career-home-compact.jpg'),
  relationships: require('@/assets/home/categories/relationships-home-compact.jpg'),
  creativity: require('@/assets/home/categories/creativity-home-compact.jpg'),
  spirituality: require('@/assets/home/categories/spirituality-home-compact.jpg'),
  abundance: require('@/assets/home/categories/abundance-home-compact.jpg'),
  family: require('@/assets/home/categories/family-home-compact.jpg'),
  learning: require('@/assets/home/categories/learning-home-compact.jpg'),
  adventure: require('@/assets/home/categories/adventure-home-compact.jpg'),
  focus: require('@/assets/home/categories/focus-home-compact.jpg'),
  custom: require('@/assets/home/categories/custom-home-compact.jpg'),
};

export function homeCategoryArt(category?: string | null): ImageSourcePropType | null {
  return HOME_CATEGORY_ART[category?.trim().toLowerCase() ?? ''] ?? null;
}
