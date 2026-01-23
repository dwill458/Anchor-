/**
 * Anchor App - Color Palette
 * Zen Architect Theme
 *
 * All colors for the Anchor app following the design system.
 * Never use hard-coded color values - always import from this file.
 */

export const colors = {
  // Primary Colors
  charcoal: '#1A1A1D',
  navy: '#0F1419',
  gold: '#D4AF37',
  bone: '#F5F5DC',

  // Accent Colors
  deepPurple: '#3E2C5B',
  bronze: '#CD7F32',
  silver: '#C0C0C0',

  // Status Colors
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#F44336',

  // Drawing Palette Colors (for ManualForge screen)
  white: '#FFFFFF',
  cyan: '#00CED1',
  coral: '#FF7F50',
  mint: '#98D8C8',
  rose: '#FF69B4',
  amber: '#FFBF00',
  turquoise: '#40E0D0',

  // Background Shades
  background: {
    primary: '#0F1419',
    secondary: '#1A1A1D',
    card: '#252529',
  },

  // Text Shades
  text: {
    primary: '#F5F5DC',
    secondary: '#C0C0C0',
    tertiary: '#9E9E9E',
    disabled: '#757575',
  },
} as const;

export type ColorKey = keyof typeof colors;
