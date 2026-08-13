/**
 * Chart — design tokens.
 *
 * Decoded from the standalone Chart prototype (`design/chart`) so every Chart
 * surface draws from one source instead of hand-rolled hex literals. Values
 * here are the prototype's, unchanged.
 *
 * CSS features React Native lacks are kept as raw data and applied by the
 * component that needs them: gradients ship as colour stop tuples for
 * `expo-linear-gradient`, and `em` letter-spacing is resolved through `ls()`.
 */

export const C = {
  bg: '#0F1419',
  deep: '#0A0E13',
  gold: '#D4AF37',
  goldBright: '#F0CB6A',
  goldDim: 'rgba(212,175,55,0.14)',
  goldLine: 'rgba(212,175,55,0.24)',
  goldFaint: 'rgba(212,175,55,0.10)',
  bone: '#F5F0E8',
  boneSoft: 'rgba(245,240,232,0.62)',
  boneFaint: 'rgba(245,240,232,0.32)',
  /** Placeholder / disabled-copy tint. */
  boneGhost: 'rgba(245,240,232,0.26)',
  purple: '#3E2C5B',
  lav: '#9B82D4',
  lavSoft: 'rgba(186,172,214,0.55)',
  cardBorder: 'rgba(255,255,255,0.065)',
  danger: 'rgba(230,140,120,0.9)',
  /** Ink used on gold fills. */
  ink: '#14100A',
} as const;

/** `linear-gradient(165deg, …)` — the Panel/card wash. */
export const CARD_GRADIENT = [
  'rgba(255,255,255,0.032)',
  'rgba(255,255,255,0.008)',
] as const;

/** `linear-gradient(180deg, #F0CB6A, #D4AF37)` — the primary button fill. */
export const GOLD_GRADIENT = [C.goldBright, C.gold] as const;

/** The Sheet body wash. */
export const SHEET_GRADIENT = ['#141A21', '#0D1218'] as const;

/**
 * Prototype font stacks mapped to the families registered in `App.tsx`.
 * `q` (Cormorant Garamond) is the quote/reflection face.
 */
export const F = {
  h: 'Cinzel-Regular',
  hSemi: 'Cinzel-SemiBold',
  hBold: 'Cinzel-Bold',
  b: 'Inter-Regular',
  bSemi: 'Inter-SemiBold',
  q: 'CormorantGaramond-Italic',
} as const;

/**
 * CSS `letter-spacing` is authored in `em`; React Native takes points.
 * `ls(12, 0.16)` reproduces `font-size:12px; letter-spacing:0.16em`.
 */
export const ls = (fontSize: number, em: number): number => fontSize * em;

/** Practice-mode accents. `tint`/`border` pre-resolve the prototype's `color-mix()`. */
export const MODE_ACCENTS = {
  focus: { c: C.gold, tint: 'rgba(212,175,55,0.11)', border: 'rgba(212,175,55,0.26)' },
  // oklch(74% 0.075 230) resolved to sRGB.
  visualize: { c: '#7BB4CE', tint: 'rgba(123,180,206,0.11)', border: 'rgba(123,180,206,0.26)' },
  deep_prime: { c: C.lav, tint: 'rgba(155,130,212,0.11)', border: 'rgba(155,130,212,0.26)' },
} as const;

/**
 * Prototype animation timings, in milliseconds. The CSS keyframes these come
 * from live in the prototype's `<style>` block.
 */
export const MOTION = {
  /** `breathe` 5.5s ease-in-out — one direction is half the cycle. */
  breatheHalf: 2750,
  /** `.plot-seg` drawSeg 1s cubic-bezier(.4,0,.2,1), staggered 1.10 + i*0.55s. */
  segDraw: 1000,
  segDelay: 1100,
  segStagger: 550,
  /** `.plot-node` fadeIn .7s, staggered 1.20 + i*0.55s. */
  nodeFade: 700,
  nodeDelay: 1200,
  /** `.plot-star` fadeIn 1.4s, staggered 0.60 + i*0.16s. */
  starFade: 1400,
  starDelay: 600,
  starStagger: 160,
  /** `.plot-grid path` fadeIn 1.8s. */
  gridFade: 1800,
  /** `.plot-compass` slowSpin 14s linear infinite. */
  compassSpin: 14000,
  /** How long the plotting ceremony runs before it advances itself. */
  plottingCeremony: 5200,
} as const;
