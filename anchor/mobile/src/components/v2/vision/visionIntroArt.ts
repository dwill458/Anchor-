import type { ImageSourcePropType } from 'react-native';
import { resolveAnchorCategory } from '@/utils/categoryDetection';

/**
 * Cinematic photograph for the Vision intro, chosen by the Anchor's category
 * so the first thing a person sees is not one fixed scene. Photographs are
 * portrait and taller than the intro's viewport, so the camera can travel
 * through them. They carry no text, logos or UI.
 *
 * Replace an entry by dropping a better photograph in `assets/vision/` and
 * changing one line here.
 */
const INTRO_ART: Record<string, ImageSourcePropType> = {
  career: require('@/assets/vision/vision-future-desk.jpg'),
  desire: require('@/assets/vision/vision-future-window.jpg'),
  health: require('@/assets/vision/vision-future-movement.jpg'),
  relationships: require('@/assets/vision/vision-future-home.jpg'),
  creativity: require('@/assets/vision/vision-future-studio.jpg'),
  spirituality: require('@/assets/vision/vision-future-sanctuary.jpg'),
  abundance: require('@/assets/vision/vision-future-abundance.jpg'),
  family: require('@/assets/vision/vision-future-family.jpg'),
  learning: require('@/assets/vision/vision-future-learning.jpg'),
  adventure: require('@/assets/vision/vision-future-open.jpg'),
  focus: require('@/assets/vision/vision-future-threshold.jpg'),
  custom: require('@/assets/vision/vision-future-window.jpg'),
};

export function visionIntroArt(category?: string | null): ImageSourcePropType {
  return INTRO_ART[resolveAnchorCategory(category)] ?? INTRO_ART.custom;
}

/** Decorative photographs for the creation-method cards. */
export const VISION_METHOD_ART = {
  generate: require('@/assets/chart/chart-landscape-desire-cinematic.jpg') as ImageSourcePropType,
  photoA: require('@/assets/vision/vision-future-movement.jpg') as ImageSourcePropType,
  photoB: require('@/assets/vision/vision-future-home.jpg') as ImageSourcePropType,
  photoC: require('@/assets/vision/vision-future-family.jpg') as ImageSourcePropType,
};
