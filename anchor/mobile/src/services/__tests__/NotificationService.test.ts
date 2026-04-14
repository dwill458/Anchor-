import type { Notification } from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import NotificationService, { NOTIFICATION_IDS } from '../NotificationService';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  AndroidImportance: {
    HIGH: 'high',
    DEFAULT: 'default',
    LOW: 'low',
  },
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
  },
}));

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when permissions are already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    const result = await NotificationService.requestPermissions();

    expect(result).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('schedules ritual reminders with a deterministic identifier', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('ritual-123');

    const id = await NotificationService.scheduleRitualReminder('anchor-1', '09:30');

    expect(id).toBe('ritual-123');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      `${NOTIFICATION_IDS.RITUAL_REMINDER_PREFIX}:anchor-1`
    );
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
          channelId: 'daily-reminders',
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
});
