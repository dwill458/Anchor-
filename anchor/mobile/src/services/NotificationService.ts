import * as Notifications from 'expo-notifications';
import { logger } from '@/utils/logger';
import type {
  Notification,
  NotificationRequest,
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
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const IS_ANDROID = Platform.OS === 'android';
const DEFAULT_LIGHT_COLOR = '#D4AF37';
const CUSTOM_NOTIFICATION_SOUND = 'notification.wav';

export const NOTIFICATION_CHANNELS = {
  DAILY_REMINDERS: 'daily-reminders',
  DAILY_GOAL_CHECKPOINTS: 'daily-goal-checkpoints',
  RITUAL_REMINDERS: 'ritual-reminders',
  STREAK_PROTECTION: 'streak-protection',
  WEEKLY_SUMMARY: 'weekly-summary',
};

export const NOTIFICATION_IDS = {
  DAILY_REMINDER: 'daily-reminder-id',
  DAILY_GOAL_CHECKPOINT_PREFIX: 'daily-goal-checkpoint',
  STREAK_PROTECTION: 'streak-protection-id',
  WEEKLY_SUMMARY: 'weekly-summary-id',
  RITUAL_REMINDER_PREFIX: 'ritual-reminder',
};

const DEV_TEST_NOTIFICATION_ID_PREFIX = 'dev-test';
const MAX_DAILY_GOAL_CHECKPOINTS = 20;

export type NotificationType =
  | 'daily_reminder'
  | 'daily_goal_checkpoint'
  | 'ritual_reminder'
  | 'streak_protection'
  | 'weekly_summary';

export interface NotificationPayload {
  type: NotificationType;
  anchorId?: string;
  goal?: number;
  milestone?: number;
  reminderId?: string;
  environment?: string;
  [key: string]: unknown;
}

export type NotificationClickAction =
  | { action: 'open_daily_reminder' }
  | { action: 'open_ritual_reminder'; anchorId: string }
  | { action: 'open_streak_protection' }
  | { action: 'open_weekly_summary' }
  | { action: 'unknown' };

type NotificationEvent = Notification | NotificationResponse;

type MockScheduledNotification = NotificationRequest;

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
        sound: CUSTOM_NOTIFICATION_SOUND,
        data: this.buildPayload('daily_reminder'),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: parsed.hour,
        minute: parsed.minute,
        repeats: true,
        channelId: NOTIFICATION_CHANNELS.DAILY_REMINDERS,
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
   * Schedule a one-time daily goal checkpoint reminder.
   */
  async scheduleDailyGoalCheckpoint(
    milestone: number,
    goal: number,
    date: Date
  ): Promise<string | null> {
    const reminderId = this.buildDailyGoalCheckpointId(milestone);
    await this.cancelReminder(reminderId);

    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      this.recordError(
        new ServiceError(
          'notifications/invalid-time',
          'Invalid daily goal checkpoint time. Expected a valid Date.'
        )
      );
      return null;
    }

    const isFinalCheckpoint = milestone >= goal;
    return this.scheduleNotification({
      identifier: reminderId,
      content: {
        title: isFinalCheckpoint ? "Finish Today's Goal" : "Stay with Today's Goal",
        body: isFinalCheckpoint
          ? "One more focus or reinforce session completes today's goal."
          : "A quick focus or reinforce session keeps today's goal on track.",
        sound: CUSTOM_NOTIFICATION_SOUND,
        data: this.buildPayload('daily_goal_checkpoint', {
          goal,
          milestone,
          reminderId,
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: NOTIFICATION_CHANNELS.DAILY_GOAL_CHECKPOINTS,
      },
    });
  }

  /**
   * Cancel all deterministic daily goal checkpoint reminders.
   */
  async cancelAllDailyGoalCheckpoints(): Promise<void> {
    const cancellations: Promise<void>[] = [];
    for (let milestone = 2; milestone <= MAX_DAILY_GOAL_CHECKPOINTS; milestone += 1) {
      cancellations.push(this.cancelReminder(this.buildDailyGoalCheckpointId(milestone)));
    }
    await Promise.all(cancellations);
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
        body: 'Your anchor is waiting when you are ready.',
        sound: CUSTOM_NOTIFICATION_SOUND,
        data: this.buildPayload('ritual_reminder', {
          anchorId,
          reminderId,
        }),
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
        body: 'Your anchor is waiting. A moment now keeps the thread alive.',
        sound: CUSTOM_NOTIFICATION_SOUND,
        data: this.buildPayload('streak_protection'),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 20,
        minute: 0,
        repeats: true,
        channelId: NOTIFICATION_CHANNELS.STREAK_PROTECTION,
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
        sound: CUSTOM_NOTIFICATION_SOUND,
        data: this.buildPayload('weekly_summary'),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        weekday: 1,
        hour: 19,
        minute: 0,
        repeats: true,
        channelId: NOTIFICATION_CHANNELS.WEEKLY_SUMMARY,
      },
    });
  }

  /**
   * Cancel weekly summary.
   */
  async cancelWeeklySummary(): Promise<void> {
    await this.cancelReminder(NOTIFICATION_IDS.WEEKLY_SUMMARY);
  }

  async scheduleDeveloperTestNotification(
    type: NotificationType,
    delaySeconds = 5
  ): Promise<string | null> {
    this.lastError = null;

    const request = this.buildDeveloperTestRequest(type, delaySeconds);
    return this.scheduleNotification(request);
  }

  async scheduleLocalNotification(options: {
    id: string;
    title: string;
    body: string;
    fireDate: Date;
    deepLink?: string;
  }): Promise<string | null> {
    if (!(options.fireDate instanceof Date) || Number.isNaN(options.fireDate.getTime())) {
      this.recordError(
        new ServiceError(
          'notifications/invalid-time',
          'Invalid local notification fire date. Expected a valid Date.'
        )
      );
      return null;
    }

    return this.scheduleNotification({
      identifier: options.id,
      content: {
        title: options.title,
        body: options.body,
        sound: CUSTOM_NOTIFICATION_SOUND,
        data: {
          deepLink: options.deepLink || '/',
        },
      },
      trigger: this.buildDateTrigger(options.fireDate, NOTIFICATION_CHANNELS.DAILY_REMINDERS),
    });
  }

  async cancelNotification(id: string): Promise<void> {
    await this.cancelReminder(id);
  }

  async getDeveloperTestNotifications(): Promise<MockScheduledNotification[]> {
    this.lastError = null;

    const scheduled = await this.getScheduledNotifications();
    return scheduled.filter((notification) =>
      notification.identifier.startsWith(`${DEV_TEST_NOTIFICATION_ID_PREFIX}:`)
    );
  }

  async cancelDeveloperTestNotifications(): Promise<number> {
    this.lastError = null;

    const scheduled = await this.getDeveloperTestNotifications();
    await Promise.all(
      scheduled.map((notification) => this.cancelReminder(notification.identifier))
    );

    return scheduled.length;
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
        case 'daily_goal_checkpoint':
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
    this.lastError = null;

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
    this.lastError = null;

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
        sound: CUSTOM_NOTIFICATION_SOUND,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.DAILY_GOAL_CHECKPOINTS, {
        name: 'Daily Goal Checkpoints',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: DEFAULT_LIGHT_COLOR,
        sound: CUSTOM_NOTIFICATION_SOUND,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.RITUAL_REMINDERS, {
        name: 'Ritual Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: DEFAULT_LIGHT_COLOR,
        sound: CUSTOM_NOTIFICATION_SOUND,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.STREAK_PROTECTION, {
        name: 'Streak Protection',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: DEFAULT_LIGHT_COLOR,
        sound: CUSTOM_NOTIFICATION_SOUND,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.WEEKLY_SUMMARY, {
        name: 'Weekly Summary',
        importance: Notifications.AndroidImportance.LOW,
        lightColor: DEFAULT_LIGHT_COLOR,
        sound: CUSTOM_NOTIFICATION_SOUND,
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
      logger.error('[NotificationService]', error);
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

  private buildDailyGoalCheckpointId(milestone: number): string {
    return `${NOTIFICATION_IDS.DAILY_GOAL_CHECKPOINT_PREFIX}:${milestone}`;
  }

  private buildDeveloperTestRequest(
    type: NotificationType,
    delaySeconds: number
  ): {
    identifier: string;
    content: NotificationContentInput;
    trigger: NotificationTriggerInput;
  } {
    const identifier = `${DEV_TEST_NOTIFICATION_ID_PREFIX}:${type}:${Date.now()}`;

    switch (type) {
      case 'daily_reminder':
        return {
          identifier,
          content: {
            title: 'Test: Return to Your Anchor',
            body: 'Developer test for the daily reminder notification.',
            sound: CUSTOM_NOTIFICATION_SOUND,
            data: this.buildPayload('daily_reminder'),
          },
          trigger: this.buildTimeIntervalTrigger(
            delaySeconds,
            NOTIFICATION_CHANNELS.DAILY_REMINDERS
          ),
        };
      case 'daily_goal_checkpoint':
        return {
          identifier,
          content: {
            title: "Test: Stay with Today's Goal",
            body: 'Developer test for the daily goal checkpoint notification.',
            sound: CUSTOM_NOTIFICATION_SOUND,
            data: this.buildPayload('daily_goal_checkpoint', {
              goal: 3,
              milestone: 2,
              reminderId: identifier,
            }),
          },
          trigger: this.buildTimeIntervalTrigger(
            delaySeconds,
            NOTIFICATION_CHANNELS.DAILY_GOAL_CHECKPOINTS
          ),
        };
      case 'ritual_reminder':
        return {
          identifier,
          content: {
            title: 'Test: Ritual Reminder',
            body: 'Developer test for the ritual reminder notification.',
            sound: CUSTOM_NOTIFICATION_SOUND,
            data: this.buildPayload('ritual_reminder', {
              anchorId: 'dev-anchor',
              reminderId: identifier,
            }),
          },
          trigger: this.buildTimeIntervalTrigger(
            delaySeconds,
            NOTIFICATION_CHANNELS.RITUAL_REMINDERS
          ),
        };
      case 'streak_protection':
        return {
          identifier,
          content: {
            title: 'Test: Streak Protection',
            body: 'Developer test for the streak protection notification.',
            sound: CUSTOM_NOTIFICATION_SOUND,
            data: this.buildPayload('streak_protection'),
          },
          trigger: this.buildTimeIntervalTrigger(
            delaySeconds,
            NOTIFICATION_CHANNELS.STREAK_PROTECTION
          ),
        };
      case 'weekly_summary':
        return {
          identifier,
          content: {
            title: 'Test: Your Weekly Reflection',
            body: 'Developer test for the weekly summary notification.',
            sound: CUSTOM_NOTIFICATION_SOUND,
            data: this.buildPayload('weekly_summary'),
          },
          trigger: this.buildTimeIntervalTrigger(
            delaySeconds,
            NOTIFICATION_CHANNELS.WEEKLY_SUMMARY
          ),
        };
    }

    const exhaustiveType: never = type;
    throw new Error(`Unsupported notification type: ${exhaustiveType}`);
  }

  private buildRitualTrigger(time: string | Date): NotificationTriggerInput | null {
    if (time instanceof Date) {
      return {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: time,
        channelId: NOTIFICATION_CHANNELS.RITUAL_REMINDERS,
      };
    }

    const parsed = this.parseTime(time);
    if (!parsed) return null;
    return {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: parsed.hour,
      minute: parsed.minute,
      repeats: true,
      channelId: NOTIFICATION_CHANNELS.RITUAL_REMINDERS,
    };
  }

  private buildDateTrigger(date: Date, channelId: string): NotificationTriggerInput {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId,
    };
  }

  private buildTimeIntervalTrigger(
    delaySeconds: number,
    channelId: string
  ): NotificationTriggerInput {
    return {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.floor(delaySeconds)),
      channelId,
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
      const mockTrigger: NotificationTrigger =
        request.trigger === null ? { type: 'unknown' } : (request.trigger as NotificationTrigger);

      this.mockScheduled.set(identifier, {
        identifier,
        content: {
          title: request.content.title ?? null,
          subtitle: request.content.subtitle ?? null,
          body: request.content.body ?? null,
          data: request.content.data ?? {},
          sound: this.normalizeMockSound(request.content.sound),
          launchImageName: request.content.launchImageName ?? null,
          badge: request.content.badge ?? null,
          attachments: request.content.attachments ?? [],
          categoryIdentifier: request.content.categoryIdentifier ?? null,
          threadIdentifier: null,
        },
        trigger: mockTrigger,
      });
      return identifier;
    }

    try {
      return await Notifications.scheduleNotificationAsync(request);
    } catch (error: any) {
      const errorMessage = error?.message ? ` ${error.message}` : '';
      this.recordError(
        new ServiceError(
          'notifications/schedule-failed',
          `Failed to schedule notification.${errorMessage}`,
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

    return contentData as unknown as NotificationPayload;
  }

  private normalizeMockSound(
    sound: NotificationContentInput['sound']
  ): MockScheduledNotification['content']['sound'] {
    if (sound === true || sound === 'default') return 'default';
    if (sound === 'defaultCritical') return 'defaultCritical';
    if (typeof sound === 'string') return 'custom';
    return null;
  }
}

export default new NotificationService();
