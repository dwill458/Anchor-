/**
 * Anchor App - Practice Completion Presets
 *
 * Mode-specific copy and accent color for SessionCompletionScreen.
 * Keeps Focus, Deep Prime, and Visualize on one shared screen with three personalities.
 */

import { colors } from '@/theme';
import type { PracticeMode } from '@/types/practice';

export interface PracticeCompletionPreset {
  eyebrow: string;
  headline: string;
  repeatLabel: string;
  accentColor: string;
}

export const PRACTICE_COMPLETION_PRESETS: Record<
  Extract<PracticeMode, 'focus' | 'deep_prime' | 'visualize'>,
  PracticeCompletionPreset
> = {
  focus: {
    eyebrow: 'FOCUS COMPLETE',
    headline: 'Focus complete.',
    repeatLabel: 'Focus Again',
    accentColor: colors.practiceMode.focus.primary,
  },
  deep_prime: {
    eyebrow: 'DEEP PRIME COMPLETE',
    headline: 'Priming complete.',
    repeatLabel: 'Prime Again',
    accentColor: colors.practiceMode.deepPrime.primary,
  },
  visualize: {
    eyebrow: 'VISUALIZE COMPLETE',
    headline: 'Rehearsal complete.',
    repeatLabel: 'Visualize Again',
    accentColor: colors.practiceMode.visualize.primary,
  },
};
