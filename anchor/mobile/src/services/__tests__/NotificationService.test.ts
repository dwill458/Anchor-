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
