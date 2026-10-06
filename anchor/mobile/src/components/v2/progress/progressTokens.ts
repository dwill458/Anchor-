import { colors } from '@/theme/v2';
import { detailsPalette } from '@/components/v2/anchors/anchorDetailsTokens';

/** "#RRGGBB" + 0-1 alpha -> "rgba(r, g, b, a)". Derives translucent tints from the real tokens. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Progress screen palette. Everything resolves to the V2 theme; the two values
 * the theme has no token for (gold, route teal) are named here once.
 */
export const progressTokens = {
  /** Display serif used for Anchor identity and numerals (as Anchor Details). */
  serif: 'EBGaramond-Medium',

  // Ink hero
  heroBg: colors.ink.base,
  heroText: colors.cream,
  heroMuted: withAlpha(colors.cream, 0.62),
  heroFaint: withAlpha(colors.cream, 0.4),
  heroHairline: withAlpha(colors.cream, 0.18),
  heroTrack: withAlpha(colors.cream, 0.12),

  // Cream body
  bodyBg: colors.cream,
  card: colors.paper,
  cardBorder: colors.border.subtle,
  text: colors.text.primary,
  muted: colors.text.secondary,
  chip: colors.grouped,
  hairline: colors.border.subtle,
  /** Ink at a given opacity: the heatmap ramp. No hue. */
  inkWash: (alpha: number) => withAlpha(colors.ink.base, alpha),

  /**
   * Gold is a reserved active-state signal: today's outline, the current stage
   * pip and the sparkline's end dot. It never fills a large area.
   */
  gold: detailsPalette.gold,
  /** Reached waypoint. The theme has no teal token. */
  reached: '#227385',
  /** Current waypoint. */
  current: colors.semantic.info,
} as const;

/** User-facing practice labels for this screen (Deep Prime, as the mode is named in the app's own vocabulary). */
export const PROGRESS_MODE_LABELS = {
  focus: 'Focus',
  deepPrime: 'Deep Prime',
  visualize: 'Visualize',
  release: 'Release',
} as const;
