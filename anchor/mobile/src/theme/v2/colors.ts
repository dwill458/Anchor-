/**
 * Ink: the dark half of Anchor 2.0's paper + ink system. A deep blue-charcoal,
 * never #000 - it must read as ink against the cream paper, not as a void.
 * Practice identity hues sit on top of it; ink itself carries no hue accent.
 */
const ink = {
  /** Primary dark surface: Home lower zone, Progress, session screens. */
  base: '#121A22',
  /** Elevated dark surface: cards, sheets and rows that sit on `base`. */
  raised: '#18212A',
  /** Slightly deeper under-layer for full-bleed immersive fields and navigator fills. */
  deep: '#0E151C',
  text: { primary: '#F4F6FA', secondary: 'rgba(244, 246, 250, 0.65)', tertiary: 'rgba(244, 246, 250, 0.38)' },
  hairline: 'rgba(255, 255, 255, 0.08)',
  hairlineStrong: 'rgba(255, 255, 255, 0.14)',
} as const;

/** Locked Anchor 2.0 neutral and semantic palette. Keep raw hex values here. */
export const colors = {
  background: '#F4F1E9',
  canvas: '#F4F1E9',
  surface: '#FBF9F4',
  grouped: '#ECE8DF',
  text: { primary: '#171717', secondary: '#6C6861', disabled: '#858B93', tertiary: '#858B93', inverse: '#FBF9F4' },
  border: { default: '#D8D2C8', subtle: '#E5E0D7', strong: '#BDB6AB' },
  semantic: { success: '#287D57', warning: '#9A6818', error: '#B63B38', info: '#3157D8' },
  textPrimary: '#0B203E',
  textSecondary: '#647188',
  navy: '#0B203E',
  cream: '#F4F1E9',
  paper: '#FBF9F4',
  line: '#D8D2C8',
  ink,
  /**
   * Home lower zone below the cream splice. Kept under the name Home already
   * uses; it resolves to the shared ink tokens so there is one dark system.
   */
  graphite: {
    base: ink.base,
    surface: ink.raised,
    text: ink.text,
    hairline: ink.hairline,
    hairlineStrong: ink.hairlineStrong,
  },
} as const;
