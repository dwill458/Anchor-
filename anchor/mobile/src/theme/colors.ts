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

  // Ritual Surface Tokens
  ritual: {
    overlay: 'rgba(8, 10, 14, 0.72)',
    glass: 'rgba(15, 20, 25, 0.62)',
    glassStrong: 'rgba(12, 17, 24, 0.82)',
    border: 'rgba(212, 175, 55, 0.24)',
    softGlow: 'rgba(212, 175, 55, 0.14)',
    pin: 'rgba(212, 175, 55, 0.55)',  // gold accent dot for UndertoneLine
  },

  // Text Shades
  text: {
    primary: '#F5F5DC',
    secondary: '#C0C0C0',
    tertiary: '#9E9E9E',
    undertone: '#AAAAAA',  // warm silver — guidance text with full contrast, no opacity reduction
    disabled: '#757575',
  },

  // Sanctuary screen-specific palette
  sanctuary: {
    gold: '#c9a84c',
    goldBright: '#f0cb6a',
    goldDim: '#6a5428',
    goldBorder: 'rgba(201,168,76,0.28)',
    purpleBg: '#09060f',
    purpleCard: 'rgba(18,12,32,0.92)',
    purpleBorder: 'rgba(120,80,200,0.15)',
    tabBg: 'rgba(12,8,22,0.92)',
    tabBorder: 'rgba(120,80,200,0.12)',
    textSecondary: 'rgba(200,185,155,0.55)',
    textDim: 'rgba(180,165,135,0.3)',
  },

  // Choose Structure / Structure Forge screen palette
  forgeScreen: {
    gradientTop: '#1A1028',
    gradientBottom: '#1B1A2E',
    orbPurple: '#6B3FA0',
    glassBg: 'rgba(255, 255, 255, 0.05)',
    glassBorder: 'rgba(212, 175, 55, 0.2)',
    forgeBadgeBg: 'rgba(212, 175, 55, 0.12)',
    forgeBadgeBorder: 'rgba(212, 175, 55, 0.35)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    intentionText: 'rgba(255, 255, 255, 0.8)',
    previewSurface: 'rgba(10, 8, 20, 0.6)',
    previewBorder: 'rgba(212, 175, 55, 0.25)',
    previewWatermark: 'rgba(212, 175, 55, 0.4)',
    cardSurface: 'rgba(15, 20, 25, 0.8)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    cardSelected: 'rgba(212, 175, 55, 0.08)',
    ctaMid: '#F0D060',
    ctaEnd: '#C49A20',
    ctaText: '#1A1000',
  },

  // Mantra Creation screen palette
  mantra: {
    backgroundTop: '#141820',
    backgroundMid: '#0D1117',
    backgroundBottom: '#13101E',
    orbPurple: '#3E2C5B',
    orbGold: '#D4AF37',
    card: '#111820',
    redAccent: '#E05454',
    redSoft: '#E08484',
    recordSaved: '#7FBA7A',
    ctaMid: '#F0D060',
    ctaEnd: '#C49A20',
    text: 'rgba(255,255,255,0.88)',
    muted: 'rgba(255,255,255,0.42)',
    glass: 'rgba(255,255,255,0.04)',
    subtleBorder: 'rgba(255,255,255,0.06)',
    softBorder: 'rgba(255,255,255,0.05)',
    playBg: 'rgba(255,255,255,0.07)',
    playBorder: 'rgba(255,255,255,0.1)',
    darkOverlay: 'rgba(0,0,0,0.4)',
    stripBackground: 'rgba(0,0,0,0.35)',
    goldDim: 'rgba(212,175,55,0.15)',
    goldBorder: 'rgba(212,175,55,0.22)',
    goldTint: 'rgba(212,175,55,0.04)',
    goldSoft: 'rgba(212,175,55,0.08)',
    goldSofter: 'rgba(212,175,55,0.2)',
    goldTextShadow: 'rgba(212,175,55,0.35)',
    redDim: 'rgba(224,84,84,0.12)',
    redBorder: 'rgba(224,84,84,0.35)',
    redBorderSoft: 'rgba(224,84,84,0.25)',
    redBorderSofter: 'rgba(224,84,84,0.1)',
    redMuted: 'rgba(224,84,84,0.7)',
    redMutedSoft: 'rgba(224,84,84,0.4)',
    redWave: 'rgba(224,84,84,0.55)',
    savedWave: 'rgba(127,186,122,0.3)',
    ctaFadeTop: 'rgba(13,17,23,0)',
    ctaFadeBottom: '#0D1117',
  },

  // Refine Expression / Style Selection screen palette
  refineExpression: {
    cardBg: 'rgba(16,21,28,1)',
    muted: 'rgba(255,255,255,0.38)',
    text: 'rgba(255,255,255,0.88)',
    description: 'rgba(255,255,255,0.48)',
    glass: 'rgba(255,255,255,0.04)',
    subtle: 'rgba(255,255,255,0.06)',
    goldDim: 'rgba(212,175,55,0.14)',
    goldBorder: 'rgba(212,175,55,0.22)',
    goldTint: 'rgba(212,175,55,0.04)',
    goldTextDim: 'rgba(212,175,55,0.65)',
    goldTextShadow: 'rgba(212,175,55,0.32)',
    transparent: 'rgba(255,255,255,0)',
    ctaMid: '#F0D060',
    ctaEnd: '#C49A20',
    ctaText: '#1A1000',
  },
} as const;

export type ColorKey = keyof typeof colors;
