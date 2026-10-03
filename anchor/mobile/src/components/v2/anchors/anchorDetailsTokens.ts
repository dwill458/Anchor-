import { colors, practiceColors } from '@/theme/v2';

/**
 * Anchor Details 2.0 palette. Where the V2 theme already has the value it is
 * reused (cream is the frame colour, Visualize blue is the practice hue);
 * ink has no token with this exact hex, so the prototype's value lives here.
 */
export const detailsPalette = {
  cream: colors.frame, // #F4EDE0
  ink: '#14162B',
  visualize: practiceColors.visualize, // #3B82C4
  /** Gold appears only on the Chart's flag. */
  gold: '#C9A24B',
  releaseRose: '#F08A7E',
  creamSoft: 'rgba(244,237,224,.72)',
  creamMuted: 'rgba(244,237,224,.66)',
  creamFaint: 'rgba(244,237,224,.08)',
  creamHairline: 'rgba(244,237,224,.14)',
  inkWash: 'rgba(20,22,43,.07)',
  checkerDark: '#2c2f48',
  checkerDarker: '#1f2237',
} as const;

/**
 * The prototype sets titles and numerals in Fraunces and UI text in Figtree.
 * Figtree is loaded (Regular / SemiBold). Fraunces is NOT loaded in the app, so
 * serif text uses EB Garamond Medium, the serif Thread Strength already uses.
 */
export const detailsFonts = {
  serif: 'EBGaramond-Medium',
  ui: 'Figtree-Regular',
  uiStrong: 'Figtree-SemiBold',
} as const;
