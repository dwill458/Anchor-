import { colors, practiceColors } from '@/theme/v2';

/** "#RRGGBB" + 0-1 alpha -> "rgba(r, g, b, a)". Derives translucent tints from the real tokens. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Anchor Details 2.0 palette.
 * Grounded in the unified Anchor 2.0 paper + ink tokens (colors.canvas and colors.ink.base)
 * matching the Home screen.
 */
export const detailsPalette = {
  cream: colors.canvas,
  ink: colors.ink.base,
  visualize: practiceColors.visualize,
  release: practiceColors.release,
  focus: practiceColors.focus,
  /** Gold appears only on the Chart's flag. */
  gold: '#C9A24B',
  releaseRose: '#F08A7E',
  desireRose: '#A9475E',
  creamSoft: withAlpha(colors.canvas, 0.72),
  creamMuted: withAlpha(colors.canvas, 0.66),
  creamFaint: withAlpha(colors.canvas, 0.08),
  creamHairline: withAlpha(colors.canvas, 0.14),
  inkWash: withAlpha(colors.ink.base, 0.07),
  checkerDark: colors.ink.raised,
  checkerDarker: colors.ink.deep,
} as const;

/**
 * Anchor Details typography. Serif is reserved for Anchor identity (title and
 * thread metrics) in EB Garamond Medium. Section headers and card display titles
 * use Bricolage Grotesque SemiBold to match the rest of the V2 system. UI text
 * and controls use Figtree.
 */
export const detailsFonts = {
  serif: 'EBGaramond-Medium',
  display: 'BricolageGrotesque-SemiBold',
  ui: 'Figtree-Regular',
  uiStrong: 'Figtree-SemiBold',
} as const;
