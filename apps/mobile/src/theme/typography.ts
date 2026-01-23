/**
 * Anchor App - Typography System
 *
 * Font families, sizes, and line heights for consistent typography.
 *
 * Fonts:
 * - Cinzel: Elegant serif for headings
 * - Inter: Clean sans-serif for body text
 * - Roboto Mono: Monospace for technical text
 */

export const typography = {
  // Legacy font names (keeping for backward compatibility)
  fonts: {
    heading: 'Cinzel-Regular',
    headingBold: 'Cinzel-Bold',
    headingSemiBold: 'Cinzel-SemiBold',
    body: 'Inter-Regular',
    bodyBold: 'Inter-SemiBold',
    mono: 'RobotoMono-Regular',
  },

  // Font families (new structure)
  fontFamily: {
    serif: 'Cinzel-Regular',
    serifBold: 'Cinzel-Bold',
    serifSemiBold: 'Cinzel-SemiBold',
    sans: 'Inter-Regular',
    sansBold: 'Inter-SemiBold',
    mono: 'RobotoMono-Regular',
  },

  // Font sizes (new structure)
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // Legacy sizes (keeping for backward compatibility)
  sizes: {
    h1: 32,
    h2: 24,
    h3: 20,
    h4: 18,
    body1: 16,
    body2: 14,
    caption: 12,
    button: 16,
  },

  lineHeights: {
    h1: 40,
    h2: 32,
    h3: 28,
    h4: 24,
    body1: 24,
    body2: 20,
    caption: 16,
  },

  // Shorthand styles for spreading
  h1: { fontFamily: 'Cinzel-Regular', fontSize: 32, lineHeight: 40 },
  h2: { fontFamily: 'Cinzel-Regular', fontSize: 24, lineHeight: 32 },
  h3: { fontFamily: 'Cinzel-Regular', fontSize: 20, lineHeight: 28 },
  h4: { fontFamily: 'Cinzel-Regular', fontSize: 18, lineHeight: 24 },
  body: { fontFamily: 'Inter-Regular', fontSize: 16, lineHeight: 24 },
  bodyBold: { fontFamily: 'Inter-SemiBold', fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16 },

  // Compatibility objects for components accessing .fontFamily
  heading: { fontFamily: 'Cinzel-Regular' },
  headingBold: { fontFamily: 'Cinzel-Bold' },
  headingSemiBold: { fontFamily: 'Cinzel-SemiBold' },
} as const;

export type FontFamily = keyof typeof typography.fonts;
export type FontSize = keyof typeof typography.sizes;
