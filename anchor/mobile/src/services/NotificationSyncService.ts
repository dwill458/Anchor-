import type { NotificationState } from '@/services/NotificationState';
import { apiClient } from '@/services/ApiClient';
import { logger } from '@/utils/logger';

export interface PushTokenSyncPayload {
  expoPushToken?: string | null;
  fcmToken?: string | null;
  apnsToken?: string | null;
}

export async function syncNotificationStateToServer(
  state: NotificationState
): Promise<void> {
  try {
    await apiClient.put('/api/auth/notification-state', {
      notificationState: state,
    });
  } catch (error) {
    logger.error('[NotificationSyncService] syncNotificationStateToServer error', error);
  }
}

export async function syncPushTokensToServer(
  pushTokens: PushTokenSyncPayload,
  replacePushTokens = true
): Promise<void> {
  try {
    await apiClient.put('/api/auth/notification-state', {
      pushTokens,
      replacePushTokens,
    });
  } catch (error) {
    logger.error('[NotificationSyncService] syncPushTokensToServer error', error);
  }
}

export async function clearPushTokensFromServer(): Promise<void> {
  await syncPushTokensToServer(
    {
      expoPushToken: null,
      fcmToken: null,
      apnsToken: null,
    },
    true
  );
}
