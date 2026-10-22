import { colors } from '@/theme/v2';
import { draftingInk, draftingCopyOpacity } from '../draftingTone';

const rgb = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
const luminance = (channels: number[]) => channels.reduce((sum, value, i) => {
  const s = value / 255;
  const linear = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  return sum + linear * [0.2126, 0.7152, 0.0722][i];
}, 0);

describe('drafting room contrast', () => {
  it('keeps surviving large letters readable through both environment transitions', () => {
    const paper = rgb(colors.canvas);
    const ink = rgb(colors.ink.base);
    for (let step = 0; step <= 100; step += 1) {
      const tone = step / 100;
      // Reanimated interpolates RGB with gamma 2.2 by default.
      const background = paper.map((c, i) => (c ** 2.2 * (1 - tone) + ink[i] ** 2.2 * tone) ** (1 / 2.2));
      const a = luminance(background);
      const b = luminance(rgb(draftingInk(tone)));
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the reduced-motion settled row in ink on cream', () => {
    expect(draftingInk(0)).toBe(colors.text.primary);
    expect(draftingCopyOpacity(0)).toBe(1);
    expect(draftingCopyOpacity(1)).toBe(1);
    expect(draftingCopyOpacity(0.8)).toBe(0);
  });
});
