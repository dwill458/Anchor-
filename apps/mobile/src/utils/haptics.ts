import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/stores/settingsStore';

const noop = (): void => {};

const getHapticStrength = () => {
  try {
    return useSettingsStore.getState().hapticStrength;
  } catch {
    return 'medium' as const;
  }
};

const resolveImpactStyle = (
  requested: Haptics.ImpactFeedbackStyle
): Haptics.ImpactFeedbackStyle | null => {
  const strength = getHapticStrength();

  if (strength === 'off') return null;
  if (strength === 'low') return Haptics.ImpactFeedbackStyle.Light;
  if (strength === 'high') return Haptics.ImpactFeedbackStyle.Heavy;

  return requested;
};

export const safeHaptics = {
  impact: (style: Haptics.ImpactFeedbackStyle): Promise<void> => {
    const resolvedStyle = resolveImpactStyle(style);
    if (!resolvedStyle) return Promise.resolve();
    return Haptics.impactAsync(resolvedStyle).catch(noop);
  },
  selection: (): Promise<void> => {
    if (getHapticStrength() === 'off') return Promise.resolve();
    return Haptics.selectionAsync().catch(noop);
  },
  notification: (type: Haptics.NotificationFeedbackType): Promise<void> => {
    if (getHapticStrength() === 'off') return Promise.resolve();
    return Haptics.notificationAsync(type).catch(noop);
  },
};
