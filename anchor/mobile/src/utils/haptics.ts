import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/stores/settingsStore';
import { logger } from '@/utils/logger';

export type SafeHapticsOptions = { bypassScale?: boolean };

/** Maps a requested impact to the user's selected strength. */
export function scaleImpactStyle(
  style: Haptics.ImpactFeedbackStyle,
  intensity: number,
): Haptics.ImpactFeedbackStyle | null {
  if (intensity <= 0) return null;
  if (intensity >= 67) return style;
  if (intensity >= 34) {
    if (style === Haptics.ImpactFeedbackStyle.Heavy) return Haptics.ImpactFeedbackStyle.Medium;
    if (style === Haptics.ImpactFeedbackStyle.Medium) return Haptics.ImpactFeedbackStyle.Light;
    return Haptics.ImpactFeedbackStyle.Light;
  }
  return Haptics.ImpactFeedbackStyle.Light;
}

/** Safe haptics wrapper that honors settings and won't crash if haptics fail. */
export const safeHaptics = {
  impact: async (style: Haptics.ImpactFeedbackStyle, options?: SafeHapticsOptions) => {
    const intensity = useSettingsStore.getState().hapticIntensity;
    const scaled = options?.bypassScale ? style : scaleImpactStyle(style, intensity);
    if (scaled == null) return;
    try {
      await Haptics.impactAsync(scaled);
    } catch (error) {
      logger.warn('Haptics not supported:', error);
    }
  },

  selection: async (options?: SafeHapticsOptions) => {
    if (useSettingsStore.getState().hapticIntensity <= 0 && !options?.bypassScale) return;
    try {
      await Haptics.selectionAsync();
    } catch (error) {
      logger.warn('Haptics not supported:', error);
    }
  },

  notification: async (type: Haptics.NotificationFeedbackType, options?: SafeHapticsOptions) => {
    if (useSettingsStore.getState().hapticIntensity <= 0 && !options?.bypassScale) return;
    try {
      await Haptics.notificationAsync(type);
    } catch (error) {
      logger.warn('Haptics not supported:', error);
    }
  },
};
