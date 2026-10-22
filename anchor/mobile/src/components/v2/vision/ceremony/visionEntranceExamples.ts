import type { ImageSourcePropType } from 'react-native';
import type { VisionPolaroidVariant } from '@/assets/vision/materials/manifest';

/**
 * The three prints on the Vision entrance. They are decoration: a picture of what a finished Vision can hold.
 * They are not templates, never tappable, and nothing about them reaches the person's Vision. The files are
 * photograph-only; the cream frame, paper, shadow and handwriting are drawn in code (`VisionEntrancePolaroid`).
 */
export type VisionEntranceExample = {
  id: 'achievement' | 'creation' | 'connection';
  image: ImageSourcePropType;
  /** Source pixels, so the print can be laid out before the picture decodes. */
  size: { width: number; height: number };
  caption: string;
  frame: VisionPolaroidVariant;
};

/** Left, centre, right of the fan. The achievement print is the centre and sits on top. */
export const VISION_ENTRANCE_EXAMPLES: readonly [VisionEntranceExample, VisionEntranceExample, VisionEntranceExample] = [
  { id: 'creation', image: require('@/assets/vision/entrance/vision_example_creation.png'), size: { width: 869, height: 961 }, caption: 'I built this.', frame: 'rough-edge' },
  { id: 'achievement', image: require('@/assets/vision/entrance/vision_example_achievement.png'), size: { width: 827, height: 942 }, caption: 'I actually did it.', frame: 'classic' },
  { id: 'connection', image: require('@/assets/vision/entrance/vision_example_connection.png'), size: { width: 855, height: 875 }, caption: 'This is my life.', frame: 'torn-bottom' },
];
