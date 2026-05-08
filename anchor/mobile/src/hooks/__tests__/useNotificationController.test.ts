import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationController } from '../useNotificationController';

const mockScheduleLocalNotification = jest.fn();
const mockCancelNotification = jest.fn();
const mockAnchorStoreGetState = jest.fn();
const mockSessionStoreGetState = jest.fn();
const mockAuthStoreGetState = jest.fn();
const mockSyncNotificationStateToServer = jest.fn();

jest.mock('@/services/NotificationService', () => ({
  __esModule: true,
  default: {
    scheduleLocalNotification: (...args: unknown[]) => mockScheduleLocalNotification(...args),
    cancelNotification: (...args: unknown[]) => mockCancelNotification(...args),
  },
}));

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
  syncNotificationStateToServer: (...args: unknown[]) =>
    mockSyncNotificationStateToServer(...args),
}));

type AsyncStorageMock = {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

const asyncStorage = AsyncStorage as unknown as AsyncStorageMock;

const createSessionState = (overrides: Record<string, unknown> = {}) => ({
  sessionLog: [],
  totalSessionsCount: 0,
  lastPrimedAt: null,
  lastSession: null,
  primingHistory: [],
  ...overrides,
});

const createAnchorState = (overrides: Record<string, unknown> = {}) => ({
  totalPrimes: 0,
  ...overrides,
});

describe('useNotificationController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-23T15:00:00.000Z'));
    jest.clearAllMocks();

    mockAnchorStoreGetState.mockReturnValue(createAnchorState());
    mockSessionStoreGetState.mockReturnValue(createSessionState());
    mockAuthStoreGetState.mockReturnValue({ user: null });
    asyncStorage.getItem.mockResolvedValue(null);
    asyncStorage.setItem.mockResolvedValue(undefined);
    mockCancelNotification.mockResolvedValue(undefined);
    mockScheduleLocalNotification.mockResolvedValue('micro-prime');
    mockSyncNotificationStateToServer.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes notification state on first launch and schedules micro-prime for tomorrow at active_hours_end', async () => {
    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(mockCancelNotification).toHaveBeenCalledWith('micro-prime');
    expect(mockScheduleLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'micro-prime',
        title: 'The Sanctuary is open.',
        body: '10 seconds to hold the thread?',
        deepLink: '/sanctuary',
      })
    );

    const scheduledAt = mockScheduleLocalNotification.mock.calls[0][0].fireDate as Date;
    expect(scheduledAt.getDate()).toBe(24);
    expect(scheduledAt.getHours()).toBe(21);
    expect(scheduledAt.getMinutes()).toBe(0);

    const savedState = JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
    expect(savedState).toMatchObject({
      primed_today: false,
      active_hours_end: 21,
      notification_enabled: true,
      sovereign_rank: false,
      goal_primes: 3,
    });
  });

  it('resets primed_today on a new day and increments miss streak across missed days', async () => {
    asyncStorage.getItem.mockResolvedValue(JSON.stringify({
      primed_today: true,
      last_prime_at: '2026-04-20T09:00:00.000Z',
      missed_yesterday: false,
      miss_streak: 0,
      app_opened_in_last_5_days: true,
      last_app_open_at: '2026-04-20T10:00:00.000Z',
      total_primes_this_week: 3,
      week_started_at: '2026-04-20T00:00:00.000Z',
      current_primes: 3,
      goal_primes: 22,
      has_reached_goal_today: true,
      has_entered_burn_flow: false,
      sigil_in_vault: false,
      active_hours_start: 8,
      active_hours_end: 21,
      timezone: 'UTC',
      notification_enabled: true,
      total_primes_all_time: 3,
      alchemist_milestones_count: 0,
      sovereign_rank: false,
      active_session: false,
    }));

    renderHook(() => useNotificationController());

    await waitFor(() => expect(asyncStorage.setItem).toHaveBeenCalled());

    const savedState = JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
    expect(savedState.primed_today).toBe(false);
    expect(savedState.has_reached_goal_today).toBe(false);
    expect(savedState.goal_primes).toBe(3);
    expect(savedState.missed_yesterday).toBe(true);
    expect(savedState.miss_streak).toBe(2);
  });

  it('increments all-time prime totals after a completed prime', async () => {
    asyncStorage.getItem.mockResolvedValue(JSON.stringify({
      primed_today: false,
      last_prime_at: null,
      missed_yesterday: false,
      miss_streak: 0,
      app_opened_in_last_5_days: true,
      last_app_open_at: '2026-04-22T10:00:00.000Z',
      total_primes_this_week: 0,
      week_started_at: '2026-04-20T00:00:00.000Z',
      current_primes: 0,
      goal_primes: 22,
      has_reached_goal_today: false,
      has_entered_burn_flow: false,
      sigil_in_vault: false,
      active_hours_start: 8,
      active_hours_end: 21,
      timezone: 'UTC',
      notification_enabled: true,
      total_primes_all_time: 49,
      alchemist_milestones_count: 0,
      sovereign_rank: false,
      active_session: false,
    }));

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    mockSessionStoreGetState.mockReturnValue(createSessionState({
      totalSessionsCount: 50,
      lastPrimedAt: '2026-04-23',
      sessionLog: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'activate',
          durationSeconds: 30,
          mode: 'silent',
          completedAt: '2026-04-23T15:05:00.000Z',
        },
      ],
      primingHistory: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-04-23T15:05:00.000Z',
          localDate: '2026-04-23',
          weekKey: '2026-W17',
          weekStart: '2026-04-20T00:00:00.000Z',
          weekdayIndex: 2,
          hourOfDay: 15,
          timeOfDay: 'afternoon',
        },
      ],
    }));

    await act(async () => {
      await result.current.handlePrimeComplete();
    });

    const savedState = JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
    expect(savedState.total_primes_all_time).toBe(50);
    expect(savedState.primed_today).toBe(true);
    expect(savedState.goal_primes).toBe(3);
  });

  it('reconciles store-derived progress after a prime was already recorded locally', async () => {
    asyncStorage.getItem.mockResolvedValue(JSON.stringify({
      primed_today: false,
      last_prime_at: null,
      missed_yesterday: false,
      miss_streak: 0,
      app_opened_in_last_5_days: true,
      last_app_open_at: '2026-04-22T10:00:00.000Z',
      total_primes_this_week: 0,
      week_started_at: '2026-04-20T00:00:00.000Z',
      current_primes: 0,
      goal_primes: 3,
      has_reached_goal_today: false,
      has_entered_burn_flow: false,
      sigil_in_vault: false,
      active_hours_start: 8,
      active_hours_end: 21,
      timezone: 'UTC',
      notification_enabled: true,
      total_primes_all_time: 0,
      alchemist_milestones_count: 0,
      sovereign_rank: false,
      active_session: false,
      weaver_enabled: true,
    }));
    mockSessionStoreGetState.mockReturnValue(createSessionState({
      sessionLog: [
        {
          id: 'activate-1',
          anchorId: 'anchor-1',
          type: 'activate',
          durationSeconds: 30,
          mode: 'silent',
          completedAt: '2026-04-23T09:00:00.000Z',
        },
        {
          id: 'reinforce-1',
          anchorId: 'anchor-1',
          type: 'reinforce',
          durationSeconds: 120,
          mode: 'silent',
          completedAt: '2026-04-23T11:00:00.000Z',
        },
      ],
      totalSessionsCount: 2,
      lastPrimedAt: '2026-04-23',
      primingHistory: [
        {
          id: 'reinforce-1',
          anchorId: 'anchor-1',
          type: 'reinforce',
          completedAt: '2026-04-23T11:00:00.000Z',
          localDate: '2026-04-23',
          weekKey: '2026-W17',
          weekStart: '2026-04-20T00:00:00.000Z',
          weekdayIndex: 2,
          hourOfDay: 11,
          timeOfDay: 'morning',
        },
        {
          id: 'activate-1',
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-04-23T09:00:00.000Z',
          localDate: '2026-04-23',
          weekKey: '2026-W17',
          weekStart: '2026-04-20T00:00:00.000Z',
          weekdayIndex: 2,
          hourOfDay: 9,
          timeOfDay: 'morning',
        },
      ],
    }));
    mockAnchorStoreGetState.mockReturnValue(createAnchorState({ totalPrimes: 2 }));

    renderHook(() => useNotificationController());

    await waitFor(() => expect(asyncStorage.setItem).toHaveBeenCalled());

    const savedState = JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
    expect(savedState.current_primes).toBe(2);
    expect(savedState.total_primes_this_week).toBe(2);
    expect(savedState.total_primes_all_time).toBe(2);
    expect(savedState.primed_today).toBe(true);
    expect(savedState.last_prime_at).toBe('2026-04-23T11:00:00.000Z');
  });

  it('schedules sovereign micro-prime copy when sovereign rank is already active', async () => {
    asyncStorage.getItem.mockResolvedValue(JSON.stringify({
      primed_today: false,
      last_prime_at: null,
      missed_yesterday: false,
      miss_streak: 0,
      app_opened_in_last_5_days: true,
      last_app_open_at: '2026-04-22T10:00:00.000Z',
      total_primes_this_week: 0,
      week_started_at: '2026-04-20T00:00:00.000Z',
      current_primes: 0,
      goal_primes: 22,
      has_reached_goal_today: false,
      has_entered_burn_flow: false,
      sigil_in_vault: false,
      active_hours_start: 8,
      active_hours_end: 20,
      timezone: 'UTC',
      notification_enabled: true,
      total_primes_all_time: 50,
      alchemist_milestones_count: 0,
      sovereign_rank: true,
      active_session: false,
    }));

    renderHook(() => useNotificationController());

    await waitFor(() => expect(mockScheduleLocalNotification).toHaveBeenCalled());

    expect(mockScheduleLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'The thread awaits.',
        body: 'Your touch is needed.',
      })
    );
    const scheduledAt = mockScheduleLocalNotification.mock.calls[0][0].fireDate as Date;
    expect(scheduledAt.getDate()).toBe(24);
    expect(scheduledAt.getHours()).toBe(20);
    expect(scheduledAt.getMinutes()).toBe(0);
  });

  it('cancels the existing micro-prime after a prime completes and does not reschedule the same day', async () => {
    const storedState = {
      primed_today: false,
      last_prime_at: null,
      missed_yesterday: false,
      miss_streak: 0,
      app_opened_in_last_5_days: true,
      last_app_open_at: '2026-04-22T10:00:00.000Z',
      total_primes_this_week: 0,
      week_started_at: '2026-04-20T00:00:00.000Z',
      current_primes: 0,
      goal_primes: 22,
      has_reached_goal_today: false,
      has_entered_burn_flow: false,
      sigil_in_vault: false,
      active_hours_start: 8,
      active_hours_end: 21,
      timezone: 'UTC',
      notification_enabled: true,
      total_primes_all_time: 0,
      alchemist_milestones_count: 0,
      sovereign_rank: false,
      active_session: false,
    };
    asyncStorage.getItem.mockResolvedValue(JSON.stringify(storedState));

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    mockScheduleLocalNotification.mockClear();
    mockCancelNotification.mockClear();

    mockSessionStoreGetState.mockReturnValue(createSessionState({
      totalSessionsCount: 1,
      lastPrimedAt: '2026-04-23',
      sessionLog: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'activate',
          durationSeconds: 30,
          mode: 'silent',
          completedAt: '2026-04-23T15:05:00.000Z',
        },
      ],
      primingHistory: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-04-23T15:05:00.000Z',
          localDate: '2026-04-23',
          weekKey: '2026-W17',
          weekStart: '2026-04-20T00:00:00.000Z',
          weekdayIndex: 2,
          hourOfDay: 15,
          timeOfDay: 'afternoon',
        },
      ],
    }));

    await act(async () => {
      await result.current.handlePrimeComplete();
    });

    expect(mockCancelNotification).toHaveBeenCalledWith('micro-prime');
    expect(mockScheduleLocalNotification).not.toHaveBeenCalled();

    const savedState = JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
    expect(savedState.primed_today).toBe(true);
    expect(savedState.current_primes).toBe(1);
    expect(savedState.total_primes_this_week).toBe(1);
    expect(savedState.total_primes_all_time).toBe(1);
  });

  it('unlocks sovereign rank after the third vaulted milestone', async () => {
    const storedState = {
      primed_today: false,
      last_prime_at: '2026-04-22T12:00:00.000Z',
      missed_yesterday: false,
      miss_streak: 0,
      app_opened_in_last_5_days: true,
      last_app_open_at: '2026-04-22T10:00:00.000Z',
      total_primes_this_week: 5,
      week_started_at: '2026-04-20T00:00:00.000Z',
      current_primes: 22,
      goal_primes: 22,
      has_reached_goal_today: true,
      has_entered_burn_flow: true,
      sigil_in_vault: false,
      active_hours_start: 8,
      active_hours_end: 21,
      timezone: 'UTC',
      notification_enabled: true,
      total_primes_all_time: 12,
      alchemist_milestones_count: 2,
      sovereign_rank: false,
      active_session: false,
    };
    asyncStorage.getItem.mockResolvedValue(JSON.stringify(storedState));

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    await act(async () => {
      await result.current.handleSigilVaulted();
    });

    const savedState = JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');
    expect(savedState.alchemist_milestones_count).toBe(3);
    expect(savedState.current_primes).toBe(0);
    expect(savedState.has_reached_goal_today).toBe(false);
    expect(savedState.has_entered_burn_flow).toBe(false);
    expect(savedState.sovereign_rank).toBe(true);
  });

  it('syncs completed-prime state only when the user is authenticated', async () => {
    asyncStorage.getItem.mockResolvedValue(JSON.stringify({
      primed_today: false,
      last_prime_at: null,
      missed_yesterday: false,
      miss_streak: 0,
      app_opened_in_last_5_days: true,
      last_app_open_at: '2026-04-22T10:00:00.000Z',
      total_primes_this_week: 0,
      week_started_at: '2026-04-20T00:00:00.000Z',
      current_primes: 1,
      goal_primes: 3,
      has_reached_goal_today: false,
      has_entered_burn_flow: false,
      sigil_in_vault: false,
      active_hours_start: 8,
      active_hours_end: 21,
      timezone: 'UTC',
      notification_enabled: true,
      total_primes_all_time: 1,
      alchemist_milestones_count: 0,
      sovereign_rank: false,
      active_session: false,
      weaver_enabled: true,
    }));

    mockAuthStoreGetState.mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const { result } = renderHook(() => useNotificationController());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    await act(async () => {
      await result.current.handlePrimeComplete();
    });

    expect(mockSyncNotificationStateToServer).toHaveBeenCalledWith(
      expect.objectContaining({
        primed_today: true,
        current_primes: 1,
      })
    );

    jest.clearAllMocks();
    mockScheduleLocalNotification.mockResolvedValue('micro-prime');
    mockCancelNotification.mockResolvedValue(undefined);
    mockSyncNotificationStateToServer.mockResolvedValue(undefined);
    asyncStorage.getItem.mockResolvedValue(JSON.stringify({
      primed_today: false,
      last_prime_at: null,
      missed_yesterday: false,
      miss_streak: 0,
      app_opened_in_last_5_days: true,
      last_app_open_at: '2026-04-22T10:00:00.000Z',
      total_primes_this_week: 0,
      week_started_at: '2026-04-20T00:00:00.000Z',
      current_primes: 1,
      goal_primes: 3,
      has_reached_goal_today: false,
      has_entered_burn_flow: false,
      sigil_in_vault: false,
      active_hours_start: 8,
      active_hours_end: 21,
      timezone: 'UTC',
      notification_enabled: true,
      total_primes_all_time: 1,
      alchemist_milestones_count: 0,
      sovereign_rank: false,
      active_session: false,
      weaver_enabled: true,
    }));
    mockAuthStoreGetState.mockReturnValue({ user: null, isAuthenticated: false });

    const second = renderHook(() => useNotificationController());

    await waitFor(() => expect(second.result.current.isInitialized).toBe(true));

    await act(async () => {
      await second.result.current.handlePrimeComplete();
    });

    expect(mockSyncNotificationStateToServer).not.toHaveBeenCalled();
  });
});
