/**
 * Chart map design tokens (CHART_REDESIGN_PLAN.md section 2).
 * The paper colour is the shared canvas token; the rest are chart-map local.
 */
import { colors } from '@/theme/v2/colors';

export const CHART_MAP_TOKENS = {
  /** Map paper: theme canvas (#F4F1E9), not the prototype's #F4F1EA. */
  paper: colors.canvas,
  ink: '#111820',
  panel: '#1A232E',
  muted: '#9AA3AF',
  light: '#EFEADF',
  void: '#0A0F14',
  line: 'rgba(239,234,223,.13)',
  /**
   * Serif for waypoint numerals and headings: the fontFamily key App.tsx
   * registers for EB Garamond Medium (the 500 weight is the only one bundled,
   * so the prototype's 700 numerals render at 500).
   */
  serif: 'EBGaramond-Medium',
  /** Sans follows chartTypography (Figtree). */
  sans: 'Figtree-Regular',
  sansStrong: 'Figtree-SemiBold',
} as const;

/** RESERVED: flag pennant + summit centre dot only. */
export const CHART_MAP_GOLD = '#E0A038';
