import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collectNotificationDiagnostics,
  formatNotificationDiagnostics,
} from '../notificationDiagnostics';
import { NOTIFICATION_STATE_STORAGE_KEY } from '@/services/NotificationState';
import { PENDING_SMART_NOTIFICATION_STORAGE_KEY } from '../pendingNotificationStore';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  getNotificationChannelsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
}));

jest.mock('expo-updates', () => ({
  runtimeVersion: '1.1.2',
  channel: 'production',
  updateId: 'update-abc',
  createdAt: new Date('2026-07-30T02:00:00.000Z'),
  isEmbeddedLaunch: false,
}));

jest.mock('expo-constants', () => ({
  expoConfig: { version: '1.1.2' },
}));

const asyncStorage = AsyncStorage as unknown as { getItem: jest.Mock };

describe('notificationDiagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
      android: { importance: 4 },
    });
    (Notifications.getNotificationChannelsAsync as jest.Mock).mockResolvedValue([]);
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    asyncStorage.getItem.mockResolvedValue(null);
  });

  it('reports whether an OTA update is live or the build-in bundle is running', async () => {
    const report = await collectNotificationDiagnostics();

    expect(report.bundle).toMatchObject({
      runtimeVersion: '1.1.2',
      channel: 'production',
      updateId: 'update-abc',
      isEmbeddedLaunch: false,
    });
    expect(formatNotificationDiagnostics(report)).toContain('running:         OTA update');
  });

  it('calls out an empty OS queue, which is the failure everyone hits', async () => {
    const report = await collectNotificationDiagnostics();

    expect(report.scheduled).toEqual([]);
    expect(formatNotificationDiagnostics(report)).toContain(
      'NOTHING — the OS has no pending notifications for this app'
    );
  });

  it('summarises what the OS actually has queued', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      {
        identifier: 'smart-notification:daily_prime',
        content: {},
        trigger: {
          type: 'date',
          value: new Date('2026-07-30T21:00:00.000Z').getTime(),
          channelId: 'daily-reminders-v2',
        },
      },
    ]);

    const report = await collectNotificationDiagnostics();

    expect(report.scheduled).toEqual([
      {
        identifier: 'smart-notification:daily_prime',
        triggerType: 'date',
        nextFireAt: '2026-07-30T21:00:00.000Z',
        channelId: 'daily-reminders-v2',
      },
    ]);
  });

  it('surfaces the stored preferences and the queued reminder', async () => {
    asyncStorage.getItem.mockImplementation((key: string) => {
      if (key === NOTIFICATION_STATE_STORAGE_KEY) {
        return Promise.resolve(
          JSON.stringify({
            notification_enabled: false,
            dailyPrimeEnabled: true,
            dailyPrimeTime: '21:00',
            notificationPermissionStatus: 'denied',
          })
        );
      }
      if (key === PENDING_SMART_NOTIFICATION_STORAGE_KEY) {
        return Promise.resolve(
          JSON.stringify({
            identifier: 'smart-notification:daily_prime',
            category: 'daily_prime',
            fireDate: '2026-07-30T21:00:00.000Z',
          })
        );
      }
      return Promise.resolve(null);
    });

    const report = await collectNotificationDiagnostics();

    expect(report.appState).toMatchObject({
      notificationEnabled: false,
      permissionStatus: 'denied',
      dailyPrimeTime: '21:00',
    });
    expect(report.pending).toMatchObject({ category: 'daily_prime' });
  });

  it('collects a partial report instead of throwing when a probe fails', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockRejectedValue(
      new Error('boom')
    );

    const report = await collectNotificationDiagnostics();

    expect(report.errors).toContain('scheduled queue: boom');
    expect(report.permission.granted).toBe(true);
  });
});
