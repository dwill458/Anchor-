import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NOTIFICATION_STATE_STORAGE_KEY,
  initializeNotificationState,
  normalizeNotificationState,
} from '@/services/NotificationState';
import { logger } from '@/utils/logger';
import type {
  NotificationCategory,
  NotificationMilestone,
} from './notificationTypes';

const NOTIFICATION_CATEGORIES: ReadonlySet<NotificationCategory> = new Set([
  'daily_prime',
  'thread_strength',
  'unfinished_anchor',
  'weekly_recap',
  'milestone',
]);

const isNotificationCategory = (value: unknown): value is NotificationCategory =>
  typeof value === 'string' && NOTIFICATION_CATEGORIES.has(value as NotificationCategory);

/**
 * Persist the fact that a smart notification was actually delivered.
 *
 * This is the source of truth for the rate-limiting and de-duplication rules in
 * `notificationRules`. Recording "sent" state here — when the OS delivers the
 * notification — rather than when it is scheduled prevents the scheduler from
 * cancelling a pending notification and then refusing to reschedule it because
 * it believes the category was already sent. See `useNotificationController`.
 */
export async function recordNotificationDelivery(
  data: Record<string, unknown> | null | undefined
): Promise<void> {
  const category = data?.category;
  if (!isNotificationCategory(category)) {
    return;
  }

  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
    const state = normalizeNotificationState(
      stored ? JSON.parse(stored) : initializeNotificationState()
    );
    const now = new Date().toISOString();

    // `daily_prime` is a recurring reminder and is intentionally excluded from
    // the global send caps so it never blocks the other categories.
    if (category !== 'daily_prime') {
      state.lastNotificationSentAt = {
        ...state.lastNotificationSentAt,
        [category]: now,
      };
    }

    if (category === 'milestone' && typeof data?.milestone === 'string') {
      state.sentMilestones = Array.from(
        new Set([...state.sentMilestones, data.milestone as NotificationMilestone])
      );
    }

    if (category === 'unfinished_anchor' && typeof data?.anchorId === 'string') {
      const anchorId = data.anchorId;
      state.unfinishedAnchorReminders = {
        ...state.unfinishedAnchorReminders,
        [anchorId]: {
          startedAt: state.unfinishedAnchorReminders[anchorId]?.startedAt ?? now,
          sentAt: now,
        },
      };
    }

    await AsyncStorage.setItem(NOTIFICATION_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    logger.error('[notificationDelivery] Failed to record delivery', error);
  }
}
