/**
 * Which of a Vision's existing photographs are shown to the image model when another
 * moment is added to it. Only the person's OWN photographs are attached: they carry real
 * subjects (a car, a house, the person) that must stay true. Generated board images are never
 * attached, because the model copies their environment into the new scene (a gym image turned a
 * requested classroom into a gym). The new scene owns its own setting.
 */
export const VISION_WORLD_REFERENCE_MAX = 3;

export type WorldReferenceScene = {
  id: string;
  sourceType: string;
  sortOrder: number;
  createdAt: Date;
  asset: { storageKey: string; mimeType: string } | null;
};

const isPersonal = (scene: WorldReferenceScene) => scene.sourceType === 'USER_UPLOAD' || scene.sourceType === 'USER_CAMERA';

/**
 * Priority: the person's own photographs (they carry the highest authority), the hero
 * (the image that leads the Vision) within each group, then the most recently approved.
 * Enough context to keep the world consistent without overwhelming the provider.
 */
export function selectWorldReferenceScenes<T extends WorldReferenceScene>(scenes: readonly T[], max = VISION_WORLD_REFERENCE_MAX): T[] {
  const usable = scenes.filter(scene => scene.asset?.storageKey && isPersonal(scene));
  if (!usable.length || max <= 0) return [];
  const heroOrder = Math.min(...usable.map(scene => scene.sortOrder));
  const rank = (scene: T) => (isPersonal(scene) ? 2 : 0) + (scene.sortOrder === heroOrder ? 1 : 0);
  return [...usable]
    .sort((a, b) => rank(b) - rank(a) || b.createdAt.getTime() - a.createdAt.getTime() || a.sortOrder - b.sortOrder)
    .slice(0, max);
}
