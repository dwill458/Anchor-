const DEFAULT_AVATARS = [
  require('../assets/avatars/avatar_01_ascending_threads.png') as number,
  require('../assets/avatars/avatar_02_centered_radiance.png') as number,
  require('../assets/avatars/avatar_03_woven_chamber.png') as number,
  require('../assets/avatars/avatar_04_bonded_spiral.png') as number,
  require('../assets/avatars/avatar_05_dual_threads.png') as number,
  require('../assets/avatars/avatar_06_echoing_rings.png') as number,
  require('../assets/avatars/avatar_07_interlocking.png') as number,
  require('../assets/avatars/avatar_08_anchored_axis.png') as number,
  require('../assets/avatars/avatar_09_layered_intention.png') as number,
  require('../assets/avatars/avatar_10_unified_field.png') as number,
] as const;

export function getAvatarByIndex(index: number): number {
  const normalizedIndex = ((index % DEFAULT_AVATARS.length) + DEFAULT_AVATARS.length) % DEFAULT_AVATARS.length;

  return DEFAULT_AVATARS[normalizedIndex];
}

export function getDefaultAvatar(userId: string): number {
  const avatarIndex = userId.charCodeAt(0) % DEFAULT_AVATARS.length;

  return getAvatarByIndex(Number.isNaN(avatarIndex) ? 0 : avatarIndex);
}
