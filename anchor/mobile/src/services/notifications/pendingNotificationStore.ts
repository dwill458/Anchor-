import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';
import type { NotificationCategory } from './notificationTypes';

/**
 * The reminder that is currently queued with the OS.
 *
 * This is deliberately kept out of `NotificationState`: notification state is
 * synced to the server and shared across a user's devices, whereas a queued
 * local notification only exists on the device that scheduled it.
 */
export interface PendingSmartNotification {
  identifier: string;
  category: NotificationCategory;
  /** ISO timestamp of the earliest occurrence that is still queued. */
  fireDate: string;
  anchorId?: string;
}

export const PENDING_SMART_NOTIFICATION_STORAGE_KEY = '@anchor_pending_smart_notification';

const isPendingSmartNotification = (value: unknown): value is PendingSmartNotification => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PendingSmartNotification>;
  return (
    typeof candidate.identifier === 'string' &&
    typeof candidate.category === 'string' &&
    typeof candidate.fireDate === 'string' &&
    !Number.isNaN(new Date(candidate.fireDate).getTime())
  );
};

export async function readPendingSmartNotification(): Promise<PendingSmartNotification | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_SMART_NOTIFICATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isPendingSmartNotification(parsed) ? parsed : null;
  } catch (error) {
    logger.warn('[PendingNotificationStore] Failed to read pending notification', error);
    return null;
  }
}

export async function writePendingSmartNotification(
  pending: PendingSmartNotification | null
): Promise<void> {
  try {
    if (!pending) {
      await AsyncStorage.removeItem(PENDING_SMART_NOTIFICATION_STORAGE_KEY);
      return;
    }

    await AsyncStorage.setItem(
      PENDING_SMART_NOTIFICATION_STORAGE_KEY,
      JSON.stringify(pending)
    );
  } catch (error) {
    logger.warn('[PendingNotificationStore] Failed to persist pending notification', error);
  }
}
