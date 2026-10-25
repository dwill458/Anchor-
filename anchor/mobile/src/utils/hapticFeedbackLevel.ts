import type { AnchorSettings } from '@/types/settings';

export type HapticFeedbackLevel = AnchorSettings['hapticFeedback'];

/** The settings UI speaks in named levels; the store keeps a 0-100 intensity. */
export const mapHapticIntensityToFeedback = (intensity: number): HapticFeedbackLevel => {
  if (intensity <= 0) {
    return 'none';
  }
  if (intensity <= 33) {
    return 'light';
  }
  if (intensity <= 66) {
    return 'medium';
  }
  return 'strong';
};

export const mapFeedbackToHapticIntensity = (feedback: HapticFeedbackLevel): number => {
  switch (feedback) {
    case 'none':
      return 0;
    case 'light':
      return 25;
    case 'medium':
      return 55;
    case 'strong':
    default:
      return 80;
  }
};
