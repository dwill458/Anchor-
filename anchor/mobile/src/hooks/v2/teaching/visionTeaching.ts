import type { BeatId } from '@/constants/v2/teachingCopy';
import type { TeachingRect } from '@/components/v2/teaching/scrollToTarget';
import type { SceneRect, Size } from '@/components/v2/vision/board/visionBoardLayouts';
import type { CameraState } from '@/components/v2/vision/board/visionBoardCamera';

export function visionTeachingBeats(photoCount: number): BeatId[] {
  return photoCount === 1 ? ['vision.first'] : photoCount >= 2 ? ['vision.second'] : [];
}
export function newestVisionScene(scenes: ReadonlyArray<{ id: string; createdAt: string; isArchived: boolean }>): string | null {
  return scenes.filter(scene => !scene.isArchived).reduce<typeof scenes[number] | null>((latest, scene) =>
    !latest || Date.parse(scene.createdAt) >= Date.parse(latest.createdAt) ? scene : latest, null)?.id ?? null;
}
/** Rotated slot bounds through the same centered camera transform used by VisionBoard. */
export function projectTeachingSlot(rect: SceneRect, scene: Size, viewport: Size, camera: CameraState, origin: TeachingRect): TeachingRect {
  const angle = Math.abs(rect.rotation) * Math.PI / 180;
  const width = (rect.width * Math.cos(angle) + rect.height * Math.sin(angle)) * camera.scale;
  const height = (rect.height * Math.cos(angle) + rect.width * Math.sin(angle)) * camera.scale;
  const centerX = origin.x + viewport.width / 2 + (rect.x + rect.width / 2 - scene.width / 2 - camera.x) * camera.scale;
  const centerY = origin.y + viewport.height / 2 + (rect.y + rect.height / 2 - scene.height / 2 - camera.y) * camera.scale;
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}
