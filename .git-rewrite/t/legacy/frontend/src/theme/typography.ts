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
  fonts: {
    heading: 'Cinzel-Regular',
    headingBold: 'Cinzel-Bold',
    headingSemiBold: 'Cinzel-SemiBold',
    body: 'Inter-Regular',
    bodyBold: 'Inter-SemiBold',
    mono: 'RobotoMono-Regular',
  },
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
} as const;

export type FontFamily = keyof typeof typography.fonts;
export type FontSize = keyof typeof typography.sizes;
