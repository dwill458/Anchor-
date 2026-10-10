import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '@/services/NotificationService';
import { NOTIFICATION_STATE_STORAGE_KEY } from '@/services/NotificationState';
import { PENDING_SMART_NOTIFICATION_STORAGE_KEY } from '@/services/notifications/pendingNotificationStore';
import { clearPushTokensFromServer, PENDING_NOTIFICATION_SYNC_KEY } from '@/services/NotificationSyncService';
import { useReminderInvitationStore } from '@/stores/v2/reminderInvitationStore';
import { logger } from '@/utils/logger';

export async function clearNotificationSession(): Promise<void> {
  try {
    await clearPushTokensFromServer();
  } catch (error) {
    logger.warn('[NotificationSessionService] Failed to clear push tokens from server during sign-out:', error);
  }
  await NotificationService.cancelAllNotifications();
  await AsyncStorage.removeItem(NOTIFICATION_STATE_STORAGE_KEY);
  await AsyncStorage.removeItem(PENDING_SMART_NOTIFICATION_STORAGE_KEY);
  await AsyncStorage.removeItem(PENDING_NOTIFICATION_SYNC_KEY);
  // Session-only flag: without this the next account would never see the reminder invitation this launch.
  useReminderInvitationStore.getState().reset();
}
