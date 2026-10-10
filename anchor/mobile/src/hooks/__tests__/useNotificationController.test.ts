import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationController } from '../useNotificationController';
import { useSettingsStore } from '@/stores/settingsStore';
import { NOTIFICATION_STATE_STORAGE_KEY } from '@/services/NotificationState';
import { PENDING_SMART_NOTIFICATION_STORAGE_KEY } from '@/services/notifications/pendingNotificationStore';
import NotificationService from '@/services/NotificationService';
import { syncPushTokensToServer } from '@/services/NotificationSyncService';

const mockScheduleSmartNotification = jest.fn();
const mockCancelSmartNotification = jest.fn();
const mockCancelSmartNotificationSeries = jest.fn();
const mockSchedulePersonalDailyReminder = jest.fn();
const mockCancelPersonalDailyReminder = jest.fn();
const mockCancelNotification = jest.fn();
const mockCancelWeeklySummary = jest.fn();
const mockGetPermissionStatus = jest.fn();
const mockRequestPermissions = jest.fn();
const mockAnchorStoreGetState = jest.fn();
const mockSessionStoreGetState = jest.fn();
const mockAuthStoreGetState = jest.fn();
const mockSyncNotificationStateToServer = jest.fn();
const mockGetPendingNotificationStateSync = jest.fn();
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

jest.mock('@/services/AnalyticsService', () => {
  const events = {
    NOTIFICATION_PERMISSION_PROMPT_SHOWN: 'notification_permission_prompt_shown',
    NOTIFICATION_PERMISSION_GRANTED: 'notification_permission_granted',
    NOTIFICATION_PERMISSION_DENIED: 'notification_permission_denied',
    NOTIFICATION_SCHEDULED: 'notification_scheduled',
    DAILY_PRIME_REMINDER_SCHEDULED: 'daily_prime_reminder_scheduled',
    DAILY_PRIME_REMINDER_DISABLED: 'daily_prime_reminder_disabled',
    DAILY_PRIME_REMINDER_TIME_CHANGED: 'daily_prime_reminder_time_changed',
  };

  return {
    AnalyticsEvents: events,
    AnalyticsService: {
      track: (...args: unknown[]) => mockTrack(...args),
    },
  };
});

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: {
    getState: () => mockAnchorStoreGetState(),
  },
}));

jest.mock('@/stores/sessionStore', () => ({
  useSessionStore: {
    getState: () => mockSessionStoreGetState(),
  },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: () => mockAuthStoreGetState(),
  },
}));

jest.mock('@/services/NotificationSyncService', () => ({
  clearPushTokensFromServer: jest.fn(() => Promise.resolve()),
  syncPushTokensToServer: jest.fn(() => Promise.resolve()),
  syncNotificationStateToServer: (...args: unknown[]) =>
    mockSyncNotificationStateToServer(...args),
  getPendingNotificationStateSync: (...args: unknown[]) =>
    mockGetPendingNotificationStateSync(...args),
}));

type AsyncStorageMock = {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

const asyncStorage = AsyncStorage as unknown as AsyncStorageMock;

const readSavedNotificationState = (): Record<string, unknown> => {
  const call = asyncStorage.setItem.mock.calls
    .filter(([key]) => key === NOTIFICATION_STATE_STORAGE_KEY)
    .at(-1);

  return JSON.parse(call?.[1] ?? '{}');
};

const readPendingNotification = (): Record<string, unknown> | null => {
  const call = asyncStorage.setItem.mock.calls
    .filter(([key]) => key === PENDING_SMART_NOTIFICATION_STORAGE_KEY)
    .at(-1);

  return call ? JSON.parse(call[1]) : null;
};

const createSessionState = (overrides: Record<string, unknown> = {}) => ({
  sessionLog: [],
  totalSessionsCount: 0,
  threadStrength: 50,
  lastPrimedAt: null,
  lastSession: null,
  primingHistory: [],
  ...overrides,
});

const createAnchorState = (overrides: Record<string, unknown> = {}) => ({
  anchors: [],
  totalPrimes: 0,
  ...overrides,
});

describe('useNotificationController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-24T15:00:00.000Z'));
    jest.clearAllMocks();

    mockAnchorStoreGetState.mockReturnValue(createAnchorState());
    mockSessionStoreGetState.mockReturnValue(createSessionState());
    mockAuthStoreGetState.mockReturnValue({ user: null, isAuthenticated: false });
    mockGetPermissionStatus.mockResolvedValue('undetermined');
    mockRequestPermissions.mockResolvedValue(true);
    mockScheduleSmartNotification.mockResolvedValue('smart-id');
    mockCancelSmartNotification.mockResolvedValue(undefined);
    mockCancelSmartNotificationSeries.mockResolvedValue(undefined);
    mockSchedulePersonalDailyReminder.mockResolvedValue('anchor:personal-daily');
    mockCancelPersonalDailyReminder.mockResolvedValue(undefined);
    mockCancelNotification.mockResolvedValue(undefined);
    mockCancelWeeklySummary.mockResolvedValue(undefined);
    mockSyncNotificationStateToServer.mockResolvedValue(null);
    mockGetPendingNotificationStateSync.mockResolvedValue(null);
    asyncStorage.getItem.mockResolvedValue(null);
    asyncStorage.setItem.mockResolvedValue(undefined);
    useSettingsStore.setState({ dailyPracticeGoal: 3 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes Phase 1 defaults without scheduling before permission is granted', async () => {
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(mockSchedulePersonalDailyReminder).not.toHaveBeenCalled();
    expect(mockScheduleSmartNotification).not.toHaveBeenCalled();
    const savedState = readSavedNotificationState();
    expect(savedState).toMatchObject({
      dailyPrimeEnabled: false,
      personalDailyReminderOptedIn: false,
      dailyPrimeTime: '21:00',
      threadStrengthAlertsEnabled: false,
      threadStrengthThreshold: 70,
      unfinishedAnchorRemindersEnabled: false,
      weeklyRecapEnabled: false,
      notificationTone: 'encouraging',
      notificationPermissionStatus: 'undetermined',
    });
  });

  it('marks the first practice completed once, without scheduling or opting in', async () => {
    const { result } = renderHook(() => useNotificationController());
    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    mockSchedulePersonalDailyReminder.mockClear();
    mockScheduleSmartNotification.mockClear();

    await act(async () => {
      await result.current.markFirstPracticeCompleted();
    });
    const first = readSavedNotificationState();
    expect(typeof first.firstPracticeCompletedAt).toBe('string');
    expect(first.personalDailyReminderOptedIn).toBe(false);

    asyncStorage.getItem.mockImplementation(async (key: string) =>
      key === NOTIFICATION_STATE_STORAGE_KEY ? JSON.stringify(first) : null
    );
    jest.setSystemTime(new Date('2026-06-25T15:00:00.000Z'));
    await act(async () => {
      await result.current.markFirstPracticeCompleted();
    });
    expect(readSavedNotificationState().firstPracticeCompletedAt).toBe(first.firstPracticeCompletedAt);
    expect(mockSchedulePersonalDailyReminder).not.toHaveBeenCalled();
    expect(mockScheduleSmartNotification).not.toHaveBeenCalled();
  });

  it('records the invitation outcome without ever recording consent', async () => {
    const { result } = renderHook(() => useNotificationController());
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    await act(async () => {
      await result.current.recordInvitationOutcome('dismissed');
    });
    const saved = readSavedNotificationState();
    expect(saved.reminderInvitationOutcome).toBe('dismissed');
    expect(typeof saved.reminderInvitationShownAt).toBe('string');
    expect(saved.personalDailyReminderOptedIn).toBe(false);
    expect(saved.dailyPrimeEnabled).toBe(false);
  });

  it('schedules a personal daily reminder via native repeating DAILY trigger when permission is granted and opted in', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    mockSessionStoreGetState.mockReturnValue(createSessionState({ threadStrength: 80 }));
    asyncStorage.getItem.mockImplementation(async (key: string) =>
      key === NOTIFICATION_STATE_STORAGE_KEY
        ? JSON.stringify({
            notification_enabled: true,
            personalDailyReminderOptedIn: true,
            dailyPrimeEnabled: true,
            dailyPrimeTime: '21:00',
            notificationPermissionStatus: 'granted',
          })
        : null
    );

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledWith(
      '21:00',
      expect.objectContaining({
        title: 'Your moment of focus',
        body: 'Take a moment to reconnect with what matters. Your Anchor is ready.',
      })
    );
  });

  it('suppresses competing discretionary engagement notifications on days when a personal reminder is scheduled', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    // Thread strength below threshold would normally trigger thread_strength alert
    mockSessionStoreGetState.mockReturnValue(createSessionState({ threadStrength: 50 }));
    asyncStorage.getItem.mockImplementation(async (key: string) =>
      key === NOTIFICATION_STATE_STORAGE_KEY
        ? JSON.stringify({
            notification_enabled: true,
            personalDailyReminderOptedIn: true,
            dailyPrimeEnabled: true,
            dailyPrimeTime: '21:00',
            notificationPermissionStatus: 'granted',
          })
        : null
    );

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    // Personal reminder is active for 21:00, so competing discretionary thread_strength alert is suppressed
    expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledWith('21:00', expect.any(Object));
    expect(mockScheduleSmartNotification).not.toHaveBeenCalled();
  });

  it('does not cancel the personal daily reminder when Focus practice is completed today', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    mockSessionStoreGetState.mockReturnValue(createSessionState({ threadStrength: 80 }));
    asyncStorage.getItem.mockImplementation(async (key: string) =>
      key === NOTIFICATION_STATE_STORAGE_KEY
        ? JSON.stringify({
            notification_enabled: true,
            personalDailyReminderOptedIn: true,
            dailyPrimeEnabled: true,
            dailyPrimeTime: '21:00',
            notificationPermissionStatus: 'granted',
          })
        : null
    );

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    mockCancelPersonalDailyReminder.mockClear();

    await act(async () => {
      await result.current.handlePrimeComplete();
    });

    // Personal daily reminder is a personal appointment and must NEVER be cancelled by earlier activity
    expect(mockCancelPersonalDailyReminder).not.toHaveBeenCalled();
    expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledWith('21:00', expect.any(Object));
  });

  it('cancels the personal daily reminder when notifications are explicitly disabled', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    mockCancelPersonalDailyReminder.mockClear();

    await act(async () => {
      await result.current.toggleNotifications(false);
    });

    expect(mockCancelPersonalDailyReminder).toHaveBeenCalled();
  });

  it('keeps local notification scheduled when remote token registration fails (Phase A decoupling)', async () => {
    mockRequestPermissions.mockResolvedValue(true);
    mockGetPermissionStatus.mockResolvedValue('granted');
    mockAuthStoreGetState.mockReturnValue({
      user: { id: 'test-user-1' },
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useNotificationController());
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    await act(async () => {
      await result.current.setDailyPrimeReminder('21:00', 'first_anchor');
    });

    const savedState = readSavedNotificationState();
    expect(savedState.notificationPermissionStatus).toBe('granted');
    expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledWith('21:00', expect.any(Object));
  });

  it('persists preference changes and reschedules through the smart scheduler', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    asyncStorage.getItem.mockImplementation(async (key: string) =>
      key === NOTIFICATION_STATE_STORAGE_KEY
        ? JSON.stringify({
            notification_enabled: true,
            personalDailyReminderOptedIn: true,
            dailyPrimeEnabled: true,
            dailyPrimeTime: '21:00',
            notificationPermissionStatus: 'granted',
          })
        : null
    );
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    mockSchedulePersonalDailyReminder.mockClear();

    await act(async () => {
      await result.current.updateNotificationPreferences({
        dailyPrimeTime: '08:00',
        notificationTone: 'direct',
        threadStrengthThreshold: 85,
      });
    });

    const savedState = readSavedNotificationState();
    expect(savedState).toMatchObject({
      dailyPrimeTime: '08:00',
      notificationTone: 'direct',
      threadStrengthThreshold: 85,
    });
    expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledWith('08:00', expect.any(Object));
  });

  it('does not show a blocking alert when an anchor is saved (the reminder card owns the ask)', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    await act(async () => {
      await result.current.handleAnchorSaved();
    });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(asyncStorage.setItem).toHaveBeenCalled();
  });

  it('schedules the daily prime reminder after permission is granted', async () => {
    mockRequestPermissions.mockResolvedValue(true);
    mockGetPermissionStatus.mockResolvedValue('granted');
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    let status: 'granted' | 'denied' = 'denied';
    await act(async () => {
      status = await result.current.setDailyPrimeReminder('08:00', 'first_anchor');
    });

    expect(status).toBe('granted');
    expect(mockRequestPermissions).toHaveBeenCalled();

    const savedState = readSavedNotificationState();
    expect(savedState).toMatchObject({
      notificationPermissionStatus: 'granted',
      notification_enabled: true,
      dailyPrimeEnabled: true,
      dailyPrimeTime: '08:00',
    });
  });

  it('records a denied permission without scheduling when the user declines', async () => {
    mockRequestPermissions.mockResolvedValue(false);
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    let status: 'granted' | 'denied' = 'granted';
    await act(async () => {
      status = await result.current.setDailyPrimeReminder('20:00', 'fallback');
    });

    expect(status).toBe('denied');
    const savedState = readSavedNotificationState();
    expect(savedState).toMatchObject({
      notificationPermissionStatus: 'denied',
      notification_enabled: false,
    });
  });

  it('marks a reminder prompt moment as completed so it is not shown again', async () => {
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    await act(async () => {
      await result.current.completeReminderPrompt('first_anchor');
    });

    const savedState = readSavedNotificationState();
    expect(savedState.firstAnchorReminderPromptCompleted).toBe(true);
  });

  it('offers the first-anchor reminder after permission was already granted', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    let canOffer = false;
    await act(async () => {
      canOffer = await result.current.canOfferFirstAnchorReminder();
    });

    expect(canOffer).toBe(true);
  });

  it('does not offer the first-anchor reminder when reminders are disabled', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    asyncStorage.getItem.mockImplementation(async (key: string) =>
      key === NOTIFICATION_STATE_STORAGE_KEY
        ? JSON.stringify({ notification_enabled: false })
        : null
    );
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    let canOffer = true;
    await act(async () => {
      canOffer = await result.current.canOfferFirstAnchorReminder();
    });

    expect(canOffer).toBe(false);
  });

  it('does not offer the first-anchor reminder after permission was denied', async () => {
    mockGetPermissionStatus.mockResolvedValue('denied');
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    let canOffer = true;
    await act(async () => {
      canOffer = await result.current.canOfferFirstAnchorReminder();
    });

    expect(canOffer).toBe(false);
  });

  describe('enableDailyReminderOnly (enrollment path)', () => {
    it('enables only the personal daily reminder and leaves other categories untouched', async () => {
      mockGetPermissionStatus.mockResolvedValue('granted');
      mockAuthStoreGetState.mockReturnValue({ user: { id: 'u1' }, isAuthenticated: true });
      useSettingsStore.setState({ weeklySummaryEnabled: true });
      const { result } = renderHook(() => useNotificationController());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));
      // Discard mount-time reconcile calls so only the enrollment write is asserted.
      mockSchedulePersonalDailyReminder.mockClear();
      mockScheduleSmartNotification.mockClear();
      mockCancelSmartNotification.mockClear();
      (syncPushTokensToServer as unknown as jest.Mock).mockClear();
      (NotificationService.getRemotePushRegistration as unknown as jest.Mock).mockClear();

      let saved = false;
      await act(async () => {
        saved = await result.current.enableDailyReminderOnly('07:17');
      });

      expect(saved).toBe(true);
      expect(useSettingsStore.getState().weeklySummaryEnabled).toBe(true);
      expect(NotificationService.getRemotePushRegistration).not.toHaveBeenCalled();
      expect(syncPushTokensToServer).not.toHaveBeenCalled();
      expect(mockScheduleSmartNotification).not.toHaveBeenCalled();
      expect(mockCancelSmartNotification).not.toHaveBeenCalled();
      expect(mockSchedulePersonalDailyReminder).toHaveBeenCalledWith('07:17', expect.any(Object));

      expect(readSavedNotificationState()).toMatchObject({
        notification_enabled: true,
        notificationPermissionStatus: 'granted',
        personalDailyReminderOptedIn: true,
        dailyPrimeEnabled: true,
        dailyPrimeTime: '07:17',
      });
      expect(mockTrack).toHaveBeenCalledWith('daily_prime_reminder_scheduled', {
        source: 'enrollment',
        time: '07:17',
      });
    });

    it('returns false and writes nothing when OS permission is not granted', async () => {
      mockGetPermissionStatus.mockResolvedValue('denied');
      const { result } = renderHook(() => useNotificationController());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));
      asyncStorage.setItem.mockClear();
      mockSchedulePersonalDailyReminder.mockClear();

      let saved = true;
      await act(async () => {
        saved = await result.current.enableDailyReminderOnly('07:17');
      });

      expect(saved).toBe(false);
      expect(asyncStorage.setItem).not.toHaveBeenCalledWith(
        NOTIFICATION_STATE_STORAGE_KEY,
        expect.anything()
      );
      expect(mockSchedulePersonalDailyReminder).not.toHaveBeenCalled();
      expect(mockTrack).not.toHaveBeenCalledWith('daily_prime_reminder_scheduled', expect.anything());
    });
  });
});
