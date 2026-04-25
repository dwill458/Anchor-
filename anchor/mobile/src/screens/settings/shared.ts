import type { AnchorSettings } from '@/types/settings';

export const SETTINGS_SCREEN_BACKGROUND = '#080C10';
export const SETTINGS_MUTED_TEXT = '#8896a8';
export const SETTINGS_GOLD_DIM = '#a8892a';

export const formatPrimingDurationLabel = (duration: AnchorSettings['primingDuration']): string => {
  if (duration === 30) {
    return '30s';
  }
  if (duration === 120) {
    return '2 min';
  }
  return '5 min';
};

export const formatPrimingSummary = (settings: AnchorSettings): string =>
  `${settings.primingMode === 'deep' ? 'Deep Prime' : 'Quick Prime'} · ${formatPrimingDurationLabel(
    settings.primingDuration
  ).replace(' min', 'm')}`;

const formatFocusModeLabel = (mode: AnchorSettings['focusDefaultMode']): string =>
  mode === 'ambient' ? 'Ambient' : 'Silent';

export const formatFocusSummary = (settings: AnchorSettings): string =>
  `Visual Focus · ${Math.round(settings.focusDuration)}s · ${formatFocusModeLabel(
    settings.focusDefaultMode
  )}`;

export const formatGoalSummary = (goal: number): string =>
  `${goal} session${goal === 1 ? '' : 's'} / day`;

export const formatHapticFeedbackLabel = (
  feedback: AnchorSettings['hapticFeedback']
): string => {
  if (feedback === 'light') return 'Soft';
  return feedback.charAt(0).toUpperCase() + feedback.slice(1);
};
