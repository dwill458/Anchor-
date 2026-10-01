import { typography } from '@/theme/v2';

// Local roles avoid changing other V2 screens during this upgrade.
export const releaseTypography = {
  title: { ...typography.headingXL, fontFamily: 'BricolageGrotesque-SemiBold' },
  display: { ...typography.displayMedium, fontFamily: 'BricolageGrotesque-SemiBold' },
  body: { ...typography.bodyMD, fontFamily: 'Figtree-Regular' },
  small: { ...typography.bodySM, fontFamily: 'Figtree-Regular' },
  label: { ...typography.labelMD, fontFamily: 'Figtree-SemiBold', letterSpacing: 0 },
} as const;
