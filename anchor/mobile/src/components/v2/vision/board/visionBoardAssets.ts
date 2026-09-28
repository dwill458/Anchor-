/**
 * Runtime Vision board assets, extracted and optimised from the design
 * sheets by `scripts/vision-board/build_vision_board_assets.py`. Never render
 * the source sheets directly.
 */
import type { ImageSourcePropType } from 'react-native';
import type { BoardAttachment, BoardDecorAsset, BoardFrameKind } from './visionBoardLayouts';

export const VISION_BOARD_IMAGES = {
  board: require('@/assets/vision/board/board.webp'),
  intentionPaper: require('@/assets/vision/board/intention-paper.webp'),
  compassRose: require('@/assets/vision/board/compass-rose.webp'),
} as const;

export const BOARD_FRAME_IMAGES: Record<BoardFrameKind, ImageSourcePropType> = {
  landscape: require('@/assets/vision/board/frame-landscape.webp'),
  portrait: require('@/assets/vision/board/frame-portrait.webp'),
  square: require('@/assets/vision/board/frame-square.webp'),
};

export const BOARD_DECOR_IMAGES: Record<BoardDecorAsset, ImageSourcePropType> = {
  'leaf-large': require('@/assets/vision/board/leaf-large.webp'),
  'leaf-branch': require('@/assets/vision/board/leaf-branch.webp'),
  'leaf-sprig': require('@/assets/vision/board/leaf-sprig.webp'),
  'scrap-kraft': require('@/assets/vision/board/scrap-kraft.webp'),
  'scrap-light': require('@/assets/vision/board/scrap-light.webp'),
  'map-corner': require('@/assets/vision/board/map-corner.webp'),
  'map-strip': require('@/assets/vision/board/map-strip.webp'),
};

/** Fasteners, sized and placed relative to the photo they hold. */
export const BOARD_ATTACHMENT_ART: Record<BoardAttachment, {
  source: ImageSourcePropType;
  /** Width as a fraction of the photo's width, with the art's own aspect. */
  width: number;
  aspect: number;
  /** Centre, as fractions of the photo. */
  x: number;
  y: number;
  rotation: number;
}> = {
  pin: { source: require('@/assets/vision/board/pin-front.webp'), width: 0.085, aspect: 0.98, x: 0.5, y: 0.075, rotation: 0 },
  'pin-angled': { source: require('@/assets/vision/board/pin-angled.webp'), width: 0.1, aspect: 1, x: 0.5, y: 0.07, rotation: -8 },
  'tape-top': { source: require('@/assets/vision/board/tape-light.webp'), width: 0.34, aspect: 1.61, x: 0.5, y: 0.03, rotation: -4 },
  'tape-left': { source: require('@/assets/vision/board/tape-kraft.webp'), width: 0.3, aspect: 1.46, x: 0.1, y: 0.07, rotation: -32 },
  'tape-right': { source: require('@/assets/vision/board/tape-soft.webp'), width: 0.28, aspect: 1.21, x: 0.9, y: 0.07, rotation: 30 },
};

export const BOARD_CARD_PIN = BOARD_ATTACHMENT_ART.pin.source;
