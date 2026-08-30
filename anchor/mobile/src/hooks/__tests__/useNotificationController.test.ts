import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationController } from '../useNotificationController';
import { useSettingsStore } from '@/stores/settingsStore';
import { NOTIFICATION_STATE_STORAGE_KEY } from '@/services/NotificationState';
import { PENDING_SMART_NOTIFICATION_STORAGE_KEY } from '@/services/notifications/pendingNotificationStore';

const mockScheduleSmartNotification = jest.fn();
const mockCancelSmartNotification = jest.fn();
const mockCancelSmartNotificationSeries = jest.fn();
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

// Several stores share the AsyncStorage mock, so the notification state has to
// be looked up by key rather than by taking the most recent write.
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

    expect(mockScheduleSmartNotification).not.toHaveBeenCalled();
    const savedState = readSavedNotificationState();
    expect(savedState).toMatchObject({
      dailyPrimeEnabled: true,
      dailyPrimeTime: '21:00',
      threadStrengthAlertsEnabled: true,
      threadStrengthThreshold: 70,
      unfinishedAnchorRemindersEnabled: true,
      weeklyRecapEnabled: false,
      notificationTone: 'encouraging',
      notificationPermissionStatus: 'undetermined',
    });
  });

  it('schedules a daily prime notification when permission is granted and practice is incomplete', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    mockSessionStoreGetState.mockReturnValue(createSessionState({ threadStrength: 80 }));

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(mockScheduleSmartNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'daily_prime',
        templateId: expect.any(String),
        tone: 'encouraging',
        title: expect.any(String),
        body: expect.any(String),
        fireDate: expect.any(Date),
      })
    );
    expect(mockTrack).toHaveBeenCalledWith(
      'notification_scheduled',
      expect.objectContaining({
        category: 'daily_prime',
      })
    );
  });

  it('queues a horizon of daily prime reminders so they survive the app not being opened', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    mockSessionStoreGetState.mockReturnValue(createSessionState({ threadStrength: 80 }));

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    // Only the first scheduling pass is asserted: the AsyncStorage mock is
    // stateless, so a later pass does not see the pending record it wrote.
    const dailyPrimeCalls = mockScheduleSmartNotification.mock.calls
      .map(([options]) => options as { category: string; occurrence?: number; fireDate: Date })
      .filter((options) => options.category === 'daily_prime')
      .slice(0, 7);

    expect(dailyPrimeCalls.map((options) => options.occurrence)).toEqual([
      undefined,
      1,
      2,
      3,
      4,
      5,
      6,
    ]);

    const [first, second] = dailyPrimeCalls;
    expect(second.fireDate.getTime() - first.fireDate.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('records the queued reminder so a re-run does not cancel it', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    mockSessionStoreGetState.mockReturnValue(createSessionState({ threadStrength: 80 }));

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    const pending = readPendingNotification();
    expect(pending).toMatchObject({
      identifier: 'smart-id',
      category: 'daily_prime',
    });

    // A second controller instance (another screen mounting) must leave the
    // queued reminder in place rather than cancelling and re-evaluating it.
    asyncStorage.getItem.mockImplementation((key: string) =>
      Promise.resolve(
        key === PENDING_SMART_NOTIFICATION_STORAGE_KEY ? JSON.stringify(pending) : null
      )
    );
    mockScheduleSmartNotification.mockClear();
    mockCancelSmartNotificationSeries.mockClear();

    const second = renderHook(() => useNotificationController());
    await waitFor(() => expect(second.result.current.isInitialized).toBe(true));

    expect(mockCancelSmartNotificationSeries).not.toHaveBeenCalled();
    expect(mockScheduleSmartNotification).not.toHaveBeenCalled();
  });

  it('re-arms the next reminder once the queued one has fired', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    mockSessionStoreGetState.mockReturnValue(createSessionState({ threadStrength: 80 }));
    asyncStorage.getItem.mockImplementation((key: string) =>
      Promise.resolve(
        key === PENDING_SMART_NOTIFICATION_STORAGE_KEY
          ? JSON.stringify({
              identifier: 'smart-id',
              category: 'daily_prime',
              // Fired two hours ago, so it is outside the one-per-hour cap.
              fireDate: '2026-06-24T13:00:00.000Z',
            })
          : null
      )
    );

    const { result } = renderHook(() => useNotificationController());
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(mockScheduleSmartNotification).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'daily_prime' })
    );
    expect(readSavedNotificationState()).toMatchObject({
      lastNotificationSentAt: { daily_prime: '2026-06-24T13:00:00.000Z' },
    });
  });

  it('schedules the next-day daily prime after a Focus Session was completed today', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    mockSessionStoreGetState.mockReturnValue(createSessionState({
      sessionLog: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'activate',
          durationSeconds: 30,
          mode: 'silent',
          completedAt: '2026-06-24T14:00:00.000Z',
        },
      ],
      totalSessionsCount: 1,
      lastPrimedAt: '2026-06-24',
      primingHistory: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-06-24T14:00:00.000Z',
          localDate: '2026-06-24',
          weekKey: '2026-W26',
          weekStart: '2026-06-22',
          weekdayIndex: 2,
          hourOfDay: 14,
          timeOfDay: 'afternoon',
        },
      ],
    }));

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(mockScheduleSmartNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'daily_prime',
        fireDate: new Date(2026, 5, 25, 21, 0, 0, 0),
      })
    );
  });

  it('persists preference changes and reschedules through the smart scheduler', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    mockScheduleSmartNotification.mockClear();

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
    expect(mockScheduleSmartNotification).toHaveBeenCalled();
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
});
