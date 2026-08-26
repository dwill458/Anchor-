import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationController } from '../useNotificationController';
import { useSettingsStore } from '@/stores/settingsStore';

const mockScheduleSmartNotification = jest.fn();
const mockCancelSmartNotification = jest.fn();
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
    const savedState = JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
    expect(savedState).toMatchObject({
      notification_enabled: false,
      dailyPrimeEnabled: false,
      dailyPrimeTime: '21:00',
      threadStrengthAlertsEnabled: false,
      threadStrengthThreshold: 70,
      unfinishedAnchorRemindersEnabled: false,
      weeklyRecapEnabled: false,
      notificationTone: 'encouraging',
      notificationPermissionStatus: 'undetermined',
    });
  });

  it('schedules a daily prime notification when permission is granted, enabled, and practice is incomplete', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({ notification_enabled: true, dailyPrimeEnabled: true })
    );
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

  it('serializes scheduling transactions from concurrent controller mounts', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({ notification_enabled: true, dailyPrimeEnabled: true })
    );
    mockSessionStoreGetState.mockReturnValue(createSessionState({ threadStrength: 80 }));

    let releaseFirstSchedule: ((identifier: string) => void) | undefined;
    mockScheduleSmartNotification.mockImplementationOnce(
      () => new Promise<string>((resolve) => {
        releaseFirstSchedule = resolve;
      })
    );

    const first = renderHook(() => useNotificationController());
    await waitFor(() => expect(mockScheduleSmartNotification).toHaveBeenCalledTimes(1));

    const second = renderHook(() => useNotificationController());
    await Promise.resolve();

    // The second controller cannot enter its cancel-and-replace transaction
    // until the first has finished scheduling its notification.
    expect(mockScheduleSmartNotification).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseFirstSchedule?.('first-smart-id');
    });

    await waitFor(() => expect(first.result.current.isInitialized).toBe(true));
    await waitFor(() => expect(second.result.current.isInitialized).toBe(true));
    expect(mockScheduleSmartNotification.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('schedules the next-day daily prime after a Focus Session was completed today', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({ notification_enabled: true, dailyPrimeEnabled: true })
    );
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
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({ notification_enabled: true, dailyPrimeEnabled: true })
    );
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

    const savedState = JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
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

  it('schedules a daily reminder when the user chooses a time', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    let status: 'granted' | 'denied' = 'denied';
    await act(async () => {
      status = await result.current.setDailyPrimeReminder('08:00', 'first_anchor');
    });

    expect(status).toBe('granted');
    expect(mockRequestPermissions).toHaveBeenCalled();

    const savedState = JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
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
    const savedState = JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
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

    const savedState = JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
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

  it('offers practice reminder on completion when reminders are not active', async () => {
    mockGetPermissionStatus.mockResolvedValue('undetermined');
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    let canOffer = false;
    await act(async () => {
      canOffer = await result.current.canOfferPracticeReminder();
    });

    expect(canOffer).toBe(true);
  });

  it('does not offer practice reminder when reminders are already active and granted', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({ notification_enabled: true, dailyPrimeEnabled: true })
    );
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    let canOffer = true;
    await act(async () => {
      canOffer = await result.current.canOfferPracticeReminder();
    });

    expect(canOffer).toBe(false);
  });

  it('schedules daily_prime concurrently with situational thread_strength nudges', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        notification_enabled: true,
        dailyPrimeEnabled: true,
        threadStrengthAlertsEnabled: true,
      })
    );
    mockSessionStoreGetState.mockReturnValue(createSessionState({ threadStrength: 40 }));

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(mockScheduleSmartNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'daily_prime',
        repeatsDaily: true,
      })
    );
    expect(mockScheduleSmartNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'thread_strength',
      })
    );
  });

  it('does not mutate lastNotificationSentAt at schedule time to prevent rate-limit self-cancellation', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        notification_enabled: true,
        dailyPrimeEnabled: true,
        threadStrengthAlertsEnabled: true,
      })
    );
    mockSessionStoreGetState.mockReturnValue(createSessionState({ threadStrength: 40 }));

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    const savedState = JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
    expect(savedState.lastNotificationSentAt?.thread_strength).toBeUndefined();
    expect(savedState.lastNotificationSentAt?.daily_prime).toBeUndefined();
  });
});
