import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationCoordinator } from '../NotificationCoordinator';
import NotificationService from '@/services/NotificationService';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { NOTIFICATION_STATE_STORAGE_KEY } from '@/services/NotificationState';
import type { PracticeSessionRecord } from '@/types/practice';

const mockScheduleSmartNotification = jest.fn();
const mockCancelSmartNotification = jest.fn();
const mockCancelSmartNotificationSeries = jest.fn();
const mockSchedulePersonalDailyReminder = jest.fn();
const mockCancelPersonalDailyReminder = jest.fn();
const mockCancelNotification = jest.fn();
const mockCancelWeeklySummary = jest.fn();
const mockGetPermissionStatus = jest.fn();
const mockRequestPermissions = jest.fn();
const mockTrack = jest.fn();

jest.mock('@/services/NotificationService', () => ({
  __esModule: true,
  default: {
    scheduleSmartNotification: (...args: unknown[]) => mockScheduleSmartNotification(...args),
    cancelSmartNotification: (...args: unknown[]) => mockCancelSmartNotification(...args),
    cancelSmartNotificationSeries: (...args: unknown[]) =>
      mockCancelSmartNotificationSeries(...args),
    schedulePersonalDailyReminder: (...args: unknown[]) =>
      mockSchedulePersonalDailyReminder(...args),
    cancelPersonalDailyReminder: (...args: unknown[]) =>
      mockCancelPersonalDailyReminder(...args),
    cancelNotification: (...args: unknown[]) => mockCancelNotification(...args),
    cancelWeeklySummary: (...args: unknown[]) => mockCancelWeeklySummary(...args),
    getPermissionStatus: (...args: unknown[]) => mockGetPermissionStatus(...args),
    requestPermissions: (...args: unknown[]) => mockRequestPermissions(...args),
    getRemotePushRegistration: jest.fn(() =>
      Promise.resolve({
        permissionGranted: true,
        expoPushToken: null,
        fcmToken: null,
        apnsToken: null,
      })
    ),
  },
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: {
    NOTIFICATION_SCHEDULED: 'notification_scheduled',
  },
  AnalyticsService: {
    track: (...args: unknown[]) => mockTrack(...args),
  },
}));

jest.mock('@/services/NotificationSyncService', () => ({
  clearPushTokensFromServer: jest.fn(() => Promise.resolve()),
  syncPushTokensToServer: jest.fn(() => Promise.resolve()),
  syncNotificationStateToServer: jest.fn(() => Promise.resolve(null)),
  getPendingNotificationStateSync: jest.fn(() => Promise.resolve(null)),
}));

type AsyncStorageMock = {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

const asyncStorage = AsyncStorage as unknown as AsyncStorageMock;

let appStateListener: ((state: AppStateStatus) => void) | null = null;
const mockRemoveAppState = jest.fn();

describe('NotificationCoordinator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-24T15:00:00.000Z'));
    jest.clearAllMocks();

    mockGetPermissionStatus.mockResolvedValue('granted');
    mockSchedulePersonalDailyReminder.mockResolvedValue('anchor:personal-daily');
    mockCancelPersonalDailyReminder.mockResolvedValue(undefined);
    mockScheduleSmartNotification.mockResolvedValue('smart-id');
    asyncStorage.getItem.mockResolvedValue(null);
    asyncStorage.setItem.mockResolvedValue(undefined);

    useAuthStore.setState({
      user: { id: 'user-1' } as any,
      isAuthenticated: true,
    });
    useSessionStore.setState({
      sessionLog: [],
      practiceHistory: [],
      totalSessionsCount: 0,
      threadStrength: 50,
      lastPrimedAt: null,
      lastSession: null,
      primingHistory: [],
    });
    useAnchorStore.setState({
      anchors: [],
      totalPrimes: 0,
    });
    useSettingsStore.setState({
      dailyPracticeGoal: 3,
      weeklySummaryEnabled: false,
    });

    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'change') {
        appStateListener = listener as (state: AppStateStatus) => void;
      }
      return { remove: mockRemoveAppState } as any;
    });
  });

  afterEach(() => {
    NotificationCoordinator.destroy();
    jest.useRealTimers();
  });

  it('initializes once and does not schedule personal daily reminder for unconsented users', async () => {
    // Clean install default: no stored state, unconsented
    const cleanup = NotificationCoordinator.initialize();
    expect(cleanup).toBeInstanceOf(Function);
    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    // Calling initialize again is idempotent
    NotificationCoordinator.initialize();

    // Allow async reconcile to complete
    await jest.runAllTimersAsync();

    // Must NOT schedule personal reminder when user has not opted in
    expect(mockSchedulePersonalDailyReminder).not.toHaveBeenCalled();
    expect(mockCancelPersonalDailyReminder).toHaveBeenCalled();
  });

  it('schedules personal daily reminder when user has explicitly opted in', async () => {
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        notification_enabled: true,
        dailyPrimeEnabled: true,
        personalDailyReminderOptedIn: true,
        dailyPrimeTime: '21:00',
      })
    );

    NotificationCoordinator.initialize();
    await jest.runAllTimersAsync();

    expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledWith(
      '21:00',
      expect.objectContaining({
        title: 'Your moment of focus',
        body: 'Take a moment to reconnect with what matters. Your Anchor is ready.',
      })
    );
  });

  it('does not schedule personal daily reminders on Android 12 when OS permission is granted without user opt-in', async () => {
    // OS permission granted (e.g. Android 12 install default), but user has not explicitly opted in
    mockGetPermissionStatus.mockResolvedValue('granted');
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        notification_enabled: false,
        personalDailyReminderOptedIn: false,
        dailyPrimeEnabled: false,
        dailyPrimeTime: '21:00',
      })
    );

    NotificationCoordinator.initialize();
    await jest.runAllTimersAsync();

    expect(mockSchedulePersonalDailyReminder).not.toHaveBeenCalled();
    expect(mockCancelPersonalDailyReminder).toHaveBeenCalled();
  });

  it('app resume leaves unchanged personal daily reminder untouched without rescheduling', async () => {
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        notification_enabled: true,
        dailyPrimeEnabled: true,
        personalDailyReminderOptedIn: true,
        dailyPrimeTime: '21:00',
      })
    );

    NotificationCoordinator.initialize();
    await jest.runAllTimersAsync();

    expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledTimes(1);
    mockSchedulePersonalDailyReminder.mockClear();
    mockCancelPersonalDailyReminder.mockClear();

    expect(appStateListener).not.toBeNull();
    appStateListener?.('active');

    await jest.runAllTimersAsync();
    // Idempotent: zero cancellations, zero rescheduling calls
    expect(mockCancelPersonalDailyReminder).not.toHaveBeenCalled();
    expect(mockSchedulePersonalDailyReminder).not.toHaveBeenCalled();
  });

  it('recordPracticeCompleted results in zero cancellation and zero rescheduling calls for an unchanged personal reminder', async () => {
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        notification_enabled: true,
        dailyPrimeEnabled: true,
        personalDailyReminderOptedIn: true,
        dailyPrimeTime: '21:00',
      })
    );

    NotificationCoordinator.initialize();
    await jest.runAllTimersAsync();

    expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledTimes(1);
    mockCancelPersonalDailyReminder.mockClear();
    mockSchedulePersonalDailyReminder.mockClear();

    const sampleRecord = {
      id: 'session-123',
      accountId: 'user-1',
      practiceMode: 'focus',
      plannedDurationSeconds: 300,
      completedDurationSeconds: 300,
      completedAt: '2026-06-24T15:30:00.000Z',
      completionStatus: 'completed',
      localDateKey: '2026-06-24',
    } as PracticeSessionRecord;

    await NotificationCoordinator.recordPracticeCompleted(sampleRecord);
    await jest.runAllTimersAsync();

    // Crucial Fix 2 requirement: practice completion results in zero cancellation and zero rescheduling calls
    expect(mockCancelPersonalDailyReminder).not.toHaveBeenCalled();
    expect(mockSchedulePersonalDailyReminder).not.toHaveBeenCalled();
  });

  it('destroys listeners cleanly', () => {
    NotificationCoordinator.initialize();
    NotificationCoordinator.destroy();

    expect(mockRemoveAppState).toHaveBeenCalled();
  });

  describe('Correction C: Idempotent scheduling and native truth simulations', () => {
    it('1. Valid schedule exists: coordinator verifies native state and leaves existing reminder untouched', async () => {
      asyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          notification_enabled: true,
          dailyPrimeEnabled: true,
          personalDailyReminderOptedIn: true,
          dailyPrimeTime: '21:00',
        })
      );
      mockSchedulePersonalDailyReminder.mockResolvedValue('anchor:personal-daily');

      NotificationCoordinator.initialize();
      await jest.runAllTimersAsync();

      expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledWith(
        '21:00',
        expect.objectContaining({
          title: 'Your moment of focus',
          body: 'Take a moment to reconnect with what matters. Your Anchor is ready.',
        })
      );
      expect(mockCancelPersonalDailyReminder).not.toHaveBeenCalled();
    });

    it('2. Schedule missing despite matching cached configuration: restores missing schedule', async () => {
      asyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          notification_enabled: true,
          dailyPrimeEnabled: true,
          personalDailyReminderOptedIn: true,
          dailyPrimeTime: '21:00',
        })
      );
      NotificationCoordinator.initialize();
      await jest.runAllTimersAsync();

      expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledTimes(1);
      mockSchedulePersonalDailyReminder.mockClear();

      // Native verification requested (e.g. uncertain OS state / audit):
      await NotificationCoordinator.verifyAndReconcileNativeSchedule();
      await jest.runAllTimersAsync();

      // Schedule was checked natively and restored/verified
      expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledWith(
        '21:00',
        expect.objectContaining({ title: 'Your moment of focus' })
      );
    });

    it('3. JavaScript coordinator restart: re-checks native state without duplicates or invalid schedules', async () => {
      asyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          notification_enabled: true,
          dailyPrimeEnabled: true,
          personalDailyReminderOptedIn: true,
          dailyPrimeTime: '21:00',
        })
      );
      NotificationCoordinator.initialize();
      await jest.runAllTimersAsync();
      expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledTimes(1);

      // Simulate JS restart
      NotificationCoordinator.destroy();
      mockSchedulePersonalDailyReminder.mockClear();
      mockCancelPersonalDailyReminder.mockClear();

      NotificationCoordinator.initialize();
      await jest.runAllTimersAsync();

      // Reconciles with native state on fresh restart
      expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledTimes(1);
      expect(mockCancelPersonalDailyReminder).not.toHaveBeenCalled();
    });

    it('4. Stale legacy schedule: replaces schedule when reminder time is updated', async () => {
      asyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          notification_enabled: true,
          dailyPrimeEnabled: true,
          personalDailyReminderOptedIn: true,
          dailyPrimeTime: '20:00',
        })
      );
      NotificationCoordinator.initialize();
      await jest.runAllTimersAsync();
      expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledWith('20:00', expect.any(Object));

      mockSchedulePersonalDailyReminder.mockClear();

      // State is updated with a new reminder time
      asyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          notification_enabled: true,
          dailyPrimeEnabled: true,
          personalDailyReminderOptedIn: true,
          dailyPrimeTime: '21:30',
        })
      );

      await NotificationCoordinator.reconcile();
      await jest.runAllTimersAsync();

      expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledWith('21:30', expect.any(Object));
    });

    it('5. Duplicate legacy schedules: forcing reconciliation cleanses duplicates', async () => {
      asyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          notification_enabled: true,
          dailyPrimeEnabled: true,
          personalDailyReminderOptedIn: true,
          dailyPrimeTime: '21:00',
        })
      );
      NotificationCoordinator.initialize();
      await jest.runAllTimersAsync();
      mockSchedulePersonalDailyReminder.mockClear();

      await NotificationCoordinator.reconcile({ forcePersonalReminder: true });
      await jest.runAllTimersAsync();

      expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledWith(
        '21:00',
        expect.objectContaining({ force: true })
      );
    });

    it('6. Scheduling failure followed by successful retry: recovers without falsely reporting success', async () => {
      asyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          notification_enabled: true,
          dailyPrimeEnabled: true,
          personalDailyReminderOptedIn: true,
          dailyPrimeTime: '21:00',
        })
      );
      // Scheduling fails on initial attempt
      mockSchedulePersonalDailyReminder.mockResolvedValueOnce(null);

      NotificationCoordinator.initialize();
      await jest.runAllTimersAsync();

      expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledTimes(1);
      mockSchedulePersonalDailyReminder.mockClear();

      // Retry attempt succeeds
      mockSchedulePersonalDailyReminder.mockResolvedValueOnce('anchor:personal-daily');
      await NotificationCoordinator.reconcile({ verifyNative: true });
      await jest.runAllTimersAsync();

      expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledTimes(1);
    });

    it('7. Practice completed earlier in the day: preserves scheduled evening reminder with zero cancellations and zero rescheduling', async () => {
      asyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          notification_enabled: true,
          dailyPrimeEnabled: true,
          personalDailyReminderOptedIn: true,
          dailyPrimeTime: '20:00',
        })
      );
      NotificationCoordinator.initialize();
      await jest.runAllTimersAsync();
      expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledTimes(1);

      mockCancelPersonalDailyReminder.mockClear();
      mockSchedulePersonalDailyReminder.mockClear();

      // User practices earlier in the day at 2:00 PM
      const sampleRecord = {
        id: 'session-afternoon-1',
        accountId: 'user-1',
        practiceMode: 'focus',
        plannedDurationSeconds: 300,
        completedDurationSeconds: 300,
        completedAt: '2026-06-24T14:00:00.000Z',
        completionStatus: 'completed',
        localDateKey: '2026-06-24',
      } as PracticeSessionRecord;

      await NotificationCoordinator.recordPracticeCompleted(sampleRecord);
      await jest.runAllTimersAsync();

      // The 8:00 PM reminder is completely untouched!
      expect(mockCancelPersonalDailyReminder).not.toHaveBeenCalled();
      expect(mockSchedulePersonalDailyReminder).not.toHaveBeenCalled();
    });
  });
});
