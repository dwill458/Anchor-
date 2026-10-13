import type { ImageSourcePropType } from 'react-native';

export type VisionShareBackgroundId = 'canvas' | 'scrapbook' | 'soft_focus' | 'midnight' | 'editorial';

export interface VisionShareBackgroundOption {
  id: VisionShareBackgroundId;
  name: string;
  assetFilename: string;
  source: ImageSourcePropType;
  thumbSource: ImageSourcePropType;
  tone: 'light' | 'dark';
}

export const VISION_SHARE_BACKGROUNDS: readonly VisionShareBackgroundOption[] = [
  {
    id: 'canvas',
    name: 'Canvas',
    assetFilename: 'vision_canvas.png',
    source: require('@/assets/share-vision/vision_canvas.png'),
    thumbSource: require('@/assets/share-vision/vision_canvas_thumb.png'),
    tone: 'light',
  },
  {
    id: 'scrapbook',
    name: 'Scrapbook',
    assetFilename: 'vision_scrapbook.png',
    source: require('@/assets/share-vision/vision_scrapbook.png'),
    thumbSource: require('@/assets/share-vision/vision_scrapbook_thumb.png'),
    tone: 'light',
  },
  {
    id: 'soft_focus',
    name: 'Soft Focus',
    assetFilename: 'vision_soft_focus.png',
    source: require('@/assets/share-vision/vision_soft_focus.png'),
    thumbSource: require('@/assets/share-vision/vision_soft_focus_thumb.png'),
    tone: 'light',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    assetFilename: 'vision_midnight.png',
    source: require('@/assets/share-vision/vision_midnight.png'),
    thumbSource: require('@/assets/share-vision/vision_midnight_thumb.png'),
    tone: 'dark',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    assetFilename: 'vision_editorial.png',
    source: require('@/assets/share-vision/vision_editorial.png'),
    thumbSource: require('@/assets/share-vision/vision_editorial_thumb.png'),
    tone: 'light',
  },
] as const;

export const DEFAULT_VISION_SHARE_BACKGROUND_ID: VisionShareBackgroundId = 'canvas';

export function getVisionShareBackground(id?: string | null): VisionShareBackgroundOption {
  const found = VISION_SHARE_BACKGROUNDS.find((b) => b.id === id);
  return found ?? VISION_SHARE_BACKGROUNDS[0];
}
