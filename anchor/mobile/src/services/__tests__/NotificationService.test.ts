import type { Notification } from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import NotificationService, { NOTIFICATION_CHANNELS, NOTIFICATION_IDS } from '../NotificationService';

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: 'project-id-123',
      },
    },
  },
  easConfig: {
    projectId: 'project-id-123',
  },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  deleteNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  AndroidImportance: {
    HIGH: 'high',
    DEFAULT: 'default',
    LOW: 'low',
  },
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    DATE: 'date',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    TIME_INTERVAL: 'timeInterval',
  },
}));

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when permissions are already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
      ios: { status: Notifications.IosAuthorizationStatus.AUTHORIZED },
    });

    const result = await NotificationService.requestPermissions();

    expect(result).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('reports notification permission status without prompting', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
      granted: false,
    });

    await expect(NotificationService.getPermissionStatus()).resolves.toBe('denied');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns expo and native push tokens when remote registration succeeds', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
      ios: { status: Notifications.IosAuthorizationStatus.AUTHORIZED },
    });
    (Notifications.getDevicePushTokenAsync as jest.Mock).mockResolvedValue({
      type: 'android',
      data: 'fcm-token-1',
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[abc123]',
    });

    const result = await NotificationService.getRemotePushRegistration();

    expect(result).toEqual({
      permissionGranted: true,
      expoPushToken: 'ExponentPushToken[abc123]',
      fcmToken: 'fcm-token-1',
      apnsToken: null,
    });
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-id-123',
      })
    );
  });

  it('schedules ritual reminders with a deterministic identifier', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('ritual-123');

    const id = await NotificationService.scheduleRitualReminder('anchor-1', '09:30');

    expect(id).toBe('ritual-123');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      `${NOTIFICATION_IDS.RITUAL_REMINDER_PREFIX}:anchor-1`
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Prime Reminder',
        }),
      })
    );
  });

  // expo-notifications rejects `calendar` triggers on Android with
  // "Trigger of type: calendar is not supported on Android", so every repeating
  // reminder has to use a daily/weekly trigger instead.
  it.each([
    ['daily reminder', () => NotificationService.scheduleDailyReminder('09:30'), 'daily'],
    ['ritual reminder', () => NotificationService.scheduleRitualReminder('anchor-1', '09:30'), 'daily'],
    ['streak protection alert', () => NotificationService.scheduleStreakProtectionAlert(), 'daily'],
    ['weekly summary', () => NotificationService.scheduleWeeklySummary(0, '19:00'), 'weekly'],
  ])('schedules the %s with an Android-supported trigger', async (_label, schedule, triggerType) => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('scheduled-id');

    await schedule();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ type: triggerType }),
      })
    );
  });

  it('schedules repeat occurrences of a category under distinct identifiers', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('smart-id');

    await NotificationService.scheduleSmartNotification({
      category: 'daily_prime',
      templateId: 'daily_prime_encouraging_1',
      tone: 'encouraging',
      title: 'Your anchor is ready',
      body: 'A moment to return.',
      fireDate: new Date('2026-06-25T21:00:00.000Z'),
      occurrence: 3,
    });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'smart-notification:daily_prime#3' })
    );
  });

  it('cancels every occurrence of a smart notification series', async () => {
    await NotificationService.cancelSmartNotificationSeries('daily_prime', 3);

    const cancelMock = Notifications.cancelScheduledNotificationAsync as jest.Mock;
    expect(cancelMock.mock.calls.flat()).toEqual([
      'smart-notification:daily_prime',
      'smart-notification:daily_prime#1',
      'smart-notification:daily_prime#2',
    ]);
  });

  it('schedules developer test notifications as one-time local notifications', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('dev-test-id');

    const id = await NotificationService.scheduleDeveloperTestNotification('daily_reminder', 5);

    expect(id).toBe('dev-test-id');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: expect.stringMatching(/^dev-test:daily_reminder:/),
        content: expect.objectContaining({
          title: 'Test: Return to Your Anchor',
          data: expect.objectContaining({
            type: 'daily_reminder',
            environment: expect.any(String),
          }),
        }),
        trigger: expect.objectContaining({
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 5,
          channelId: NOTIFICATION_CHANNELS.DAILY_REMINDERS,
        }),
      })
    );
  });

  it('schedules smart category notifications with template metadata', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('smart-id');

    const fireDate = new Date('2026-06-24T21:00:00.000Z');
    const id = await NotificationService.scheduleSmartNotification({
      category: 'daily_prime',
      templateId: 'daily_prime_encouraging_1',
      tone: 'encouraging',
      title: 'Your anchor is ready',
      body: "One Focus Session can reinforce today's thread.",
      fireDate,
    });

    expect(id).toBe('smart-id');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'smart-notification:daily_prime',
        content: expect.objectContaining({
          title: 'Your anchor is ready',
          data: expect.objectContaining({
            type: 'daily_reminder',
            category: 'daily_prime',
            templateId: 'daily_prime_encouraging_1',
            tone: 'encouraging',
          }),
        }),
      })
    );
  });

  it('filters and clears only developer test notifications', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      {
        identifier: 'dev-test:daily_reminder:1',
        content: {},
        trigger: { type: 'date' },
      },
      {
        identifier: `${NOTIFICATION_IDS.DAILY_REMINDER}`,
        content: {},
        trigger: { type: 'calendar' },
      },
      {
        identifier: 'dev-test:weekly_summary:2',
        content: {},
        trigger: { type: 'date' },
      },
    ]);

    const scheduled = await NotificationService.getDeveloperTestNotifications();
    const clearedCount = await NotificationService.cancelDeveloperTestNotifications();

    expect(scheduled.map((notification) => notification.identifier)).toEqual([
      'dev-test:daily_reminder:1',
      'dev-test:weekly_summary:2',
    ]);
    expect(clearedCount).toBe(2);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenNthCalledWith(
      1,
      'dev-test:daily_reminder:1'
    );
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenNthCalledWith(
      2,
      'dev-test:weekly_summary:2'
    );
  });

  it('maps notification taps to routing actions', () => {
    const notification: Notification = {
      date: Date.now(),
      request: {
        identifier: 'test-notification',
        content: {
          title: null,
          subtitle: null,
          body: null,
          data: {
            type: 'ritual_reminder',
            anchorId: 'anchor-1',
          },
          sound: null,
          launchImageName: null,
          badge: null,
          attachments: [],
          categoryIdentifier: null,
          threadIdentifier: null,
        },
        trigger: {
          type: 'unknown',
        },
      },
    };

    const response = NotificationService.handleNotificationClick(notification);

    expect(response).toEqual({ action: 'open_ritual_reminder', anchorId: 'anchor-1' });
  });

  it('maps smart notification taps to category actions', () => {
    const notification: Notification = {
      date: Date.now(),
      request: {
        identifier: 'smart-notification:daily_prime',
        content: {
          title: null,
          subtitle: null,
          body: null,
          data: {
            type: 'daily_reminder',
            category: 'daily_prime',
            templateId: 'daily_prime_direct_1',
            tone: 'direct',
          },
          sound: null,
          launchImageName: null,
          badge: null,
          attachments: [],
          categoryIdentifier: null,
          threadIdentifier: null,
        },
        trigger: {
          type: 'unknown',
        },
      },
    };

    expect(NotificationService.handleNotificationClick(notification)).toEqual({
      action: 'open_notification_category',
      category: 'daily_prime',
      anchorId: undefined,
    });
  });

  it('uses the updated Prime copy for streak protection alerts', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('streak-123');

    await NotificationService.scheduleStreakProtectionAlert();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Thread Strength',
        }),
      })
    );
  });
});
