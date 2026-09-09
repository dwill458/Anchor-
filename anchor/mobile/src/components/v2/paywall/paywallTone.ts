import { colors, getPracticeColor, getPracticeSoftTint } from '@/theme/v2';
import type { V2PaywallTone } from '@/constants/v2/paywall';

export type PaywallToneColors = {
  /** Accent hue for check chips, timeline dots, selected offer edge. */
  accent: string;
  /** Text/border-safe deep derivative. */
  deep: string;
  /** Subtle selected-surface / wash tint. */
  wash: string;
  /** Faint atmosphere wash for the sheet's top gradient. */
  mist: string;
};

const PRACTICE_KEY: Record<Exclude<V2PaywallTone, 'neutral'>, string> = {
  focus: 'Focus',
  deepPrime: 'DeepPrime',
  visualize: 'Visualize',
};

/**
 * Contextual atmosphere is deliberately shallow: it only touches the top wash,
 * the benefit check chips, the trial timeline and the selected-offer edge.
 * Layout, the CTA colour and all pricing stay identical across every context.
 */
export function paywallTone(tone: V2PaywallTone): PaywallToneColors {
  if (tone === 'neutral') {
    return {
      accent: colors.text.primary,
      deep: colors.text.primary,
      wash: colors.grouped,
      mist: 'transparent',
    };
  }
  const accent = getPracticeColor(PRACTICE_KEY[tone]);
  return {
    accent,
    deep: accent,
    wash: getPracticeSoftTint(PRACTICE_KEY[tone]),
    mist: `${accent}1A`,
  };
}
