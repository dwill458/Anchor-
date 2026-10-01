import { colors } from '@/theme/v2';

/** Keep large type legible while the room changes polarity. Blending foreground
 * and background together would make them meet at the same grey. */
export function draftingInk(tone: number): string {
  'worklet';
  return tone < 0.8 ? colors.text.primary : colors.paper;
}

/** Supporting type steps aside briefly at the polarity crossover. */
export function draftingCopyOpacity(tone: number): number {
  'worklet';
  if (tone <= 0.7 || tone >= 0.9) return 1;
  if (tone < 0.76) return (0.76 - tone) / 0.06;
  if (tone > 0.84) return (tone - 0.84) / 0.06;
  return 0;
}
