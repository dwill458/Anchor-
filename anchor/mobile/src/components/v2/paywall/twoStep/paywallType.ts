import type { TextStyle } from 'react-native';
import { colors } from '@/theme/v2';

/**
 * Paywall type roles, sized as fractions of the design width W so the
 * composition matches the prototype at any phone width. System font scaling
 * still applies on top; containers grow rather than clip.
 */
const SERIF = 'EBGaramond-Regular';
const SERIF_MEDIUM = 'EBGaramond-Medium';
const SERIF_SEMIBOLD = 'EBGaramond-SemiBold';
const SANS = 'Figtree-Regular';
const SANS_SEMIBOLD = 'Figtree-SemiBold';

const p = colors.paywall;

function role(fontFamily: string, size: number, lineHeight: number, color: string, extra?: TextStyle): TextStyle {
  return { fontFamily, fontSize: size, lineHeight: size * lineHeight, color, ...extra };
}

export const paywallType = {
  headline: (W: number, ratio: number) =>
    role(SERIF_SEMIBOLD, ratio * W, 1.08, p.inkText, { textAlign: 'center', letterSpacing: -0.012 * ratio * W }),
  sub: (W: number) => role(SANS, 0.037 * W, 1.45, p.inkTextSoft, { textAlign: 'center' }),
  wordmark: (W: number) => role(SERIF, 0.04 * W, 1.2, p.inkText, { letterSpacing: 0.018 * W, textAlign: 'center' }),
  eyebrow: (W: number) => role(SANS_SEMIBOLD, 0.026 * W, 1.3, p.textDim, { letterSpacing: 0.004 * W }),
  tileTitle: (W: number) => role(SERIF, 0.048 * W, 1.2, p.text),
  tileBody: (W: number) => role(SANS, 0.036 * W, 1.35, p.text),
  tileMeta: (W: number) => role(SANS, 0.03 * W, 1.35, p.textDim),
  rowTitle: (W: number) => role(SERIF, 0.06 * W, 1.15, p.text),
  rowBody: (W: number) => role(SANS, 0.037 * W, 1.4, p.textDim),
  planTitle: (W: number) => role(SERIF_MEDIUM, 0.062 * W, 1.15, p.text),
  planPrice: (W: number) => role(SERIF, 0.052 * W, 1.2, p.text),
  planTrial: (W: number) => role(SANS_SEMIBOLD, 0.037 * W, 1.35, p.gold),
  planDetail: (W: number) => role(SANS, 0.035 * W, 1.4, p.textDim),
  badge: (W: number) => role(SANS_SEMIBOLD, 0.027 * W, 1.3, p.inkText, { letterSpacing: 0.004 * W }),
  link: (W: number) => role(SERIF, 0.044 * W, 1.3, p.text, { textDecorationLine: 'underline' }),
  ctaLabel: (W: number) => role(SERIF_MEDIUM, 0.062 * W, 1.2, p.inkText),
  ctaSub: (W: number) => role(SANS, 0.037 * W, 1.4, p.textDim, { textAlign: 'center' }),
  note: (W: number) => role(SANS, 0.035 * W, 1.45, p.textDim, { textAlign: 'center' }),
  timelineTitle: (W: number) => role(SERIF, 0.044 * W, 1.2, p.text, { textAlign: 'center' }),
  timelineSub: (W: number) => role(SANS, 0.031 * W, 1.35, p.textDim, { textAlign: 'center' }),
  quiet: (W: number) => role(SANS, 0.04 * W, 1.35, p.textDim, { textAlign: 'center' }),
  legal: (W: number) => role(SANS, 0.032 * W, 1.35, p.textDim),
  error: (W: number) => role(SANS, 0.034 * W, 1.4, '#F0A39A', { textAlign: 'center' }),
};
