import type { NotificationState } from '@/services/NotificationState';
import { apiClient } from '@/services/ApiClient';
import { logger } from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_NOTIFICATION_SYNC_KEY = '@anchor_notification_state_pending_sync';

export type SyncedNotificationState = NotificationState & {
  last_sent_at?: string;
  last_sent_type?: 'ALCHEMIST' | 'WEAVER' | 'MIRROR' | 'MICRO_PRIME' | null;
  last_sent_utc_date?: string;
  updated_at?: string;
};

export interface PushTokenSyncPayload {
  expoPushToken?: string | null;
  fcmToken?: string | null;
  apnsToken?: string | null;
}

const sanitizeNotificationState = (
  state: NotificationState | SyncedNotificationState
): NotificationState => {
  const {
    last_sent_at: _lastSentAt,
    last_sent_type: _lastSentType,
    last_sent_utc_date: _lastSentUtcDate,
    updated_at: _updatedAt,
    ...sanitized
  } = state as SyncedNotificationState;

  return sanitized;
};

async function persistPendingNotificationState(
  state: NotificationState | SyncedNotificationState
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PENDING_NOTIFICATION_SYNC_KEY,
      JSON.stringify(sanitizeNotificationState(state))
    );
  } catch (error) {
    logger.error('[NotificationSyncService] persistPendingNotificationState error', error);
  }
}

async function clearPendingNotificationState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_NOTIFICATION_SYNC_KEY);
  } catch (error) {
    logger.error('[NotificationSyncService] clearPendingNotificationState error', error);
  }
}

export async function getPendingNotificationStateSync(): Promise<NotificationState | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_NOTIFICATION_SYNC_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as NotificationState;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    logger.error('[NotificationSyncService] getPendingNotificationStateSync error', error);
    return null;
  }
}

export async function syncNotificationStateToServer(
  state: NotificationState | SyncedNotificationState
): Promise<SyncedNotificationState | null> {
  const notificationState = sanitizeNotificationState(state);

  try {
    const response = await apiClient.put('/api/auth/notification-state', {
      notificationState,
    });

    await clearPendingNotificationState();
    return (response?.data?.notificationState ?? notificationState) as SyncedNotificationState;
  } catch (error) {
    logger.error('[NotificationSyncService] syncNotificationStateToServer error', error);
    await persistPendingNotificationState(notificationState);
    return null;
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
