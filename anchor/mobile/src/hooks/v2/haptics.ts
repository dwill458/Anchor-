import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';

/** Meaningful feedback only; individual controls opt in rather than vibrating on every tap. */
export const v2Haptics = {
  selection: () => safeHaptics.selection(),
  confirmation: () => safeHaptics.notification(Haptics.NotificationFeedbackType.Success),
  completion: () => safeHaptics.notification(Haptics.NotificationFeedbackType.Success),
  warning: () => safeHaptics.notification(Haptics.NotificationFeedbackType.Warning),
  destructiveCommit: () => safeHaptics.notification(Haptics.NotificationFeedbackType.Error),
};
