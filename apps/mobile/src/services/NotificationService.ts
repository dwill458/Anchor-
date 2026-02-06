import * as Notifications from 'expo-notifications';
import type {
  Notification,
  NotificationContentInput,
  NotificationResponse,
  NotificationTrigger,
  NotificationTriggerInput,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { ServiceError } from './ServiceErrors';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const IS_ANDROID = Platform.OS === 'android';
const DEFAULT_LIGHT_COLOR = '#D4AF37';

export const NOTIFICATION_CHANNELS = {
  DAILY_REMINDERS: 'daily-reminders',
  RITUAL_REMINDERS: 'ritual-reminders',
  STREAK_PROTECTION: 'streak-protection',
  WEEKLY_SUMMARY: 'weekly-summary',
};

export const NOTIFICATION_IDS = {
  DAILY_REMINDER: 'daily-reminder-id',
  STREAK_PROTECTION: 'streak-protection-id',
  WEEKLY_SUMMARY: 'weekly-summary-id',
  RITUAL_REMINDER_PREFIX: 'ritual-reminder',
};

export type NotificationType =
  | 'daily_reminder'
  | 'ritual_reminder'
  | 'streak_protection'
  | 'weekly_summary';

export interface NotificationPayload {
  type: NotificationType;
  anchorId?: string;
  reminderId?: string;
  environment?: string;
}

export type NotificationClickAction =
  | { action: 'open_daily_reminder' }
  | { action: 'open_ritual_reminder'; anchorId: string }
  | { action: 'open_streak_protection' }
  | { action: 'open_weekly_summary' }
  | { action: 'unknown' };

type NotificationEvent = Notification | NotificationResponse;

type MockScheduledNotification = {
  identifier: string;
  content: NotificationContentInput;
  trigger: NotificationTrigger;
};

/**
 * Notification Service
 *
 * Usage:
 * ```typescript
 * import NotificationService from '@/services/NotificationService';
 *
 * await NotificationService.requestPermissions();
 * await NotificationService.scheduleRitualReminder('anchor-123', '09:30');
 * ```
 */
class NotificationService {
  private lastError: ServiceError | null = null;
  private mockEnabled = false;
  private mockScheduled = new Map<string, MockScheduledNotification>();
  private mockCounter = 0;

  /**
   * Enable in-memory mock scheduling for tests and previews.
   */
  setMockEnabled(enabled: boolean): void {
    this.mockEnabled = enabled;
    if (!enabled) {
      this.mockScheduled.clear();
      this.mockCounter = 0;
    }
  }

  /**
   * Access the last service error (if any).
   */
  getLastError(): ServiceError | null {
    return this.lastError;
  }

  /**
   * Request notification permissions.
   */
  async requestPermissions(): Promise<boolean> {
    this.lastError = null;
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (IS_ANDROID) {
        await this.ensureAndroidChannels();
      }

      if (finalStatus !== 'granted') {
        this.lastError = new ServiceError(
          'notifications/permission-denied',
          'Notification permissions were denied.'
        );
      }

      return finalStatus === 'granted';
    } catch (error) {
      this.recordError(
        new ServiceError(
          'notifications/permission-request-failed',
          'Failed to request notification permissions.',
          error
        )
      );
      return false;
    }
  }

  /**
   * Schedule the main daily reminder.
   */
  async scheduleDailyReminder(time: string): Promise<string | null> {
    await this.cancelDailyReminder();

    const parsed = this.parseTime(time);
    if (!parsed) {
      this.recordError(
        new ServiceError(
          'notifications/invalid-time',
          `Invalid reminder time "${time}". Expected HH:MM.`
        )
      );
      return null;
    }

    return this.scheduleNotification({
      identifier: NOTIFICATION_IDS.DAILY_REMINDER,
      content: {
        title: 'Return to Your Anchor',
        body: 'A moment to return to your anchor.',
        sound: true,
        data: this.buildPayload('daily_reminder'),
        channelId: NOTIFICATION_CHANNELS.DAILY_REMINDERS,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: parsed.hour,
        minute: parsed.minute,
        repeats: true,
      },
    });
  }

  /**
   * Cancel the daily reminder.
   */
  async cancelDailyReminder(): Promise<void> {
    await this.cancelReminder(NOTIFICATION_IDS.DAILY_REMINDER);
  }

  /**
   * Schedule a ritual reminder for a specific anchor.
   */
  async scheduleRitualReminder(anchorId: string, time: string | Date): Promise<string | null> {
    const reminderId = this.buildRitualReminderId(anchorId);
    await this.cancelReminder(reminderId);

    const trigger = this.buildRitualTrigger(time);
    if (!trigger) {
      this.recordError(
        new ServiceError(
          'notifications/invalid-time',
          'Invalid ritual reminder time. Expected HH:MM or Date.'
        )
      );
      return null;
    }

    return this.scheduleNotification({
      identifier: reminderId,
      content: {
        title: 'Ritual Reminder',
        body: 'Your anchor ritual is ready when you are.',
        sound: true,
        data: this.buildPayload('ritual_reminder', {
          anchorId,
          reminderId,
        }),
        channelId: NOTIFICATION_CHANNELS.RITUAL_REMINDERS,
      },
      trigger,
    });
  }

  /**
   * Cancel a reminder by notification identifier.
   */
  async cancelReminder(reminderId: string): Promise<void> {
    if (!reminderId) {
      this.recordError(
        new ServiceError(
          'notifications/cancel-failed',
          'Reminder id is required to cancel a notification.'
        )
      );
      return;
    }

    await this.cancelScheduledNotification(reminderId);
  }

  /**
   * Schedule streak protection alert.
   * Typically set for evening, e.g., 20:00 (8 PM).
   */
  async scheduleStreakProtectionAlert(): Promise<string | null> {
    await this.cancelStreakProtectionAlert();

    return this.scheduleNotification({
      identifier: NOTIFICATION_IDS.STREAK_PROTECTION,
      content: {
        title: 'Streak Protection',
        body: 'You haven’t met your ritual goal today. A quick activation will keep your momentum.',
        sound: true,
        data: this.buildPayload('streak_protection'),
        channelId: NOTIFICATION_CHANNELS.STREAK_PROTECTION,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 20,
        minute: 0,
        repeats: true,
      },
    });
  }

  /**
   * Cancel streak protection alert.
   */
  async cancelStreakProtectionAlert(): Promise<void> {
    await this.cancelReminder(NOTIFICATION_IDS.STREAK_PROTECTION);
  }

  /**
   * Schedule weekly summary.
   * Default: Sunday evening at 19:00 (7 PM).
   */
  async scheduleWeeklySummary(): Promise<string | null> {
    await this.cancelWeeklySummary();

    return this.scheduleNotification({
      identifier: NOTIFICATION_IDS.WEEKLY_SUMMARY,
      content: {
        title: 'Your Weekly Reflection',
        body: 'A short overview of your practice this week is ready.',
        sound: true,
        data: this.buildPayload('weekly_summary'),
        channelId: NOTIFICATION_CHANNELS.WEEKLY_SUMMARY,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        weekday: 1,
        hour: 19,
        minute: 0,
        repeats: true,
      },
    });
  }

  /**
   * Cancel weekly summary.
   */
  async cancelWeeklySummary(): Promise<void> {
    await this.cancelReminder(NOTIFICATION_IDS.WEEKLY_SUMMARY);
  }

  /**
   * Handle a notification click and return a routing action.
   */
  handleNotificationClick(notification: NotificationEvent): NotificationClickAction {
    this.lastError = null;
    try {
      const payload = this.extractPayload(notification);
      if (!payload || typeof payload.type !== 'string') {
        return { action: 'unknown' };
      }

      switch (payload.type) {
        case 'daily_reminder':
          return { action: 'open_daily_reminder' };
        case 'ritual_reminder':
          if (payload.anchorId) {
            return { action: 'open_ritual_reminder', anchorId: payload.anchorId };
          }
          return { action: 'unknown' };
        case 'streak_protection':
          return { action: 'open_streak_protection' };
        case 'weekly_summary':
          return { action: 'open_weekly_summary' };
        default:
          return { action: 'unknown' };
      }
    } catch (error) {
      this.recordError(
        new ServiceError(
          'notifications/handler-failed',
          'Failed to handle notification click.',
          error
        )
      );
      return { action: 'unknown' };
    }
  }

  /**
   * Get all scheduled notifications (for debugging).
   */
  async getScheduledNotifications(): Promise<MockScheduledNotification[]> {
    if (this.mockEnabled) {
      return Array.from(this.mockScheduled.values());
    }

    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      this.recordError(
        new ServiceError(
          'notifications/schedule-failed',
          'Failed to fetch scheduled notifications.',
          error
        )
      );
      return [];
    }
  }

  /**
   * Cancel all notifications.
   */
  async cancelAllNotifications(): Promise<void> {
    if (this.mockEnabled) {
      this.mockScheduled.clear();
      return;
    }

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      this.recordError(
        new ServiceError(
          'notifications/cancel-failed',
          'Failed to cancel all notifications.',
          error
        )
      );
    }
  }

  private async ensureAndroidChannels(): Promise<void> {
    try {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.DAILY_REMINDERS, {
        name: 'Daily Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: DEFAULT_LIGHT_COLOR,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.RITUAL_REMINDERS, {
        name: 'Ritual Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: DEFAULT_LIGHT_COLOR,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.STREAK_PROTECTION, {
        name: 'Streak Protection',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: DEFAULT_LIGHT_COLOR,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.WEEKLY_SUMMARY, {
        name: 'Weekly Summary',
        importance: Notifications.AndroidImportance.LOW,
        lightColor: DEFAULT_LIGHT_COLOR,
      });
    } catch (error) {
      throw new ServiceError(
        'notifications/permission-request-failed',
        'Failed to configure Android notification channels.',
        error
      );
    }
  }

  private recordError(error: ServiceError): void {
    this.lastError = error;
    if (__DEV__) {
      console.error('[NotificationService]', error.message, error);
    }
  }

  private parseTime(time: string): { hour: number; minute: number } | null {
    const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return { hour, minute };
  }

  private buildPayload(type: NotificationType, overrides?: Partial<NotificationPayload>): NotificationPayload {
    return {
      type,
      environment: __DEV__ ? 'development' : 'production',
      ...overrides,
    };
  }

  private buildRitualReminderId(anchorId: string): string {
    return `${NOTIFICATION_IDS.RITUAL_REMINDER_PREFIX}:${anchorId}`;
  }

  private buildRitualTrigger(time: string | Date): NotificationTriggerInput | null {
    if (time instanceof Date) {
      return time;
    }

    const parsed = this.parseTime(time);
    if (!parsed) return null;
    return {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: parsed.hour,
      minute: parsed.minute,
      repeats: true,
    };
  }

  private async scheduleNotification(request: {
    identifier?: string;
    content: NotificationContentInput;
    trigger: NotificationTriggerInput;
  }): Promise<string | null> {
    if (this.mockEnabled) {
      const identifier =
        request.identifier || `${NOTIFICATION_IDS.RITUAL_REMINDER_PREFIX}-${this.mockCounter++}`;
      this.mockScheduled.set(identifier, {
        identifier,
        content: request.content,
        trigger: request.trigger,
      });
      return identifier;
    }

    try {
      return await Notifications.scheduleNotificationAsync(request);
    } catch (error) {
      this.recordError(
        new ServiceError(
          'notifications/schedule-failed',
          'Failed to schedule notification.',
          error
        )
      );
      return null;
    }
  }

  private async cancelScheduledNotification(reminderId: string): Promise<void> {
    if (this.mockEnabled) {
      this.mockScheduled.delete(reminderId);
      return;
    }

    try {
      await Notifications.cancelScheduledNotificationAsync(reminderId);
    } catch (error) {
      this.recordError(
        new ServiceError(
          'notifications/cancel-failed',
          `Failed to cancel notification "${reminderId}".`,
          error
        )
      );
    }
  }

  private extractPayload(notification: NotificationEvent): NotificationPayload | null {
    const contentData =
      'notification' in notification
        ? notification.notification.request.content.data
        : notification.request.content.data;

    if (!contentData || typeof contentData !== 'object') {
      return null;
    }

    return contentData as NotificationPayload;
  }
}

export default new NotificationService();
