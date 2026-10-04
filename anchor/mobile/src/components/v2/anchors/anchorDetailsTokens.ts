import { colors, practiceColors } from '@/theme/v2';

/**
 * Anchor Details 2.0 palette.
 * Exact hexes and opacities matching anchor-details-2.0-prototype.html.
 */
export const detailsPalette = {
  cream: '#F4EDE0',
  ink: '#14162B',
  visualize: '#3B82C4',
  release: '#DD5F2C',
  focus: '#8B5CF6',
  /** Gold appears only on the Chart's flag. */
  gold: '#C9A24B',
  releaseRose: '#F08A7E',
  desireRose: '#A9475E',
  creamSoft: 'rgba(244,237,224,.72)',
  creamMuted: 'rgba(244,237,224,.66)',
  creamFaint: 'rgba(244,237,224,.08)',
  creamHairline: 'rgba(244,237,224,.14)',
  inkWash: 'rgba(20,22,43,.07)',
  checkerDark: '#2c2f48',
  checkerDarker: '#1f2237',
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
