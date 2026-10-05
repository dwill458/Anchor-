import { typography } from '@/theme/v2';

// Local roles avoid changing other V2 screens during this upgrade.
export const releaseTypography = {
  serifDisplay: { fontFamily: 'CrimsonPro-Regular', fontSize: 44, lineHeight: 48, letterSpacing: -0.4 },
  serifIntention: { fontFamily: 'CrimsonPro-Regular', fontSize: 30, lineHeight: 36 },
  serifQuote: { fontFamily: 'CrimsonPro-Italic', fontSize: 22, lineHeight: 28 },
  kicker: { fontFamily: 'Figtree-SemiBold', fontSize: 11.5, lineHeight: 16, textTransform: 'uppercase', letterSpacing: 1.1 },
  title: { ...typography.headingXL, fontFamily: 'BricolageGrotesque-SemiBold' },
  display: { ...typography.displayMedium, fontFamily: 'BricolageGrotesque-SemiBold' },
  body: { ...typography.bodyMD, fontFamily: 'Figtree-Regular' },
  small: { ...typography.bodySM, fontFamily: 'Figtree-Regular' },
  label: { ...typography.labelMD, fontFamily: 'Figtree-SemiBold', letterSpacing: 0 },
} as const;
