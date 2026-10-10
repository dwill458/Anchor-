import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { useReminderEnrollment } from '../useReminderEnrollment';

const mockGetPermissionStatus = jest.fn();
const mockRequestPermissions = jest.fn();
const mockHasMatching = jest.fn();
const mockVerify = jest.fn();
const mockToggle = jest.fn();
const mockUpdatePrefs = jest.fn();
const mockEnableDaily = jest.fn();
const mockTrack = jest.fn();

jest.mock('@/services/NotificationService', () => ({
  __esModule: true,
  default: {
    getPermissionStatus: (...a: unknown[]) => mockGetPermissionStatus(...a),
    requestPermissions: (...a: unknown[]) => mockRequestPermissions(...a),
    hasMatchingPersonalDailyReminder: (...a: unknown[]) => mockHasMatching(...a),
  },
}));
jest.mock('@/services/notifications/NotificationCoordinator', () => ({
  NotificationCoordinator: { verifyAndReconcileNativeSchedule: (...a: unknown[]) => mockVerify(...a) },
}));
jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    toggleNotifications: (...a: unknown[]) => mockToggle(...a),
    updateNotificationPreferences: (...a: unknown[]) => mockUpdatePrefs(...a),
    enableDailyReminderOnly: (...a: unknown[]) => mockEnableDaily(...a),
  }),
}));
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: (...a: unknown[]) => mockTrack(...a) },
  AnalyticsEvents: jest.requireActual('@/services/AnalyticsService').AnalyticsEvents,
}));

// Enablement goes through the daily-only path; each call is one enable attempt.
const enableCalls = () => mockEnableDaily.mock.calls;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPermissionStatus.mockResolvedValue('undetermined');
  mockRequestPermissions.mockResolvedValue(true);
  mockHasMatching.mockResolvedValue(true);
  mockVerify.mockResolvedValue({});
  mockToggle.mockResolvedValue(undefined);
  mockUpdatePrefs.mockResolvedValue(undefined);
  mockEnableDaily.mockResolvedValue(true);
});

describe('useReminderEnrollment', () => {
  it('already granted: no prompt, success', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    const { result } = renderHook(() => useReminderEnrollment());
    await act(async () => { await result.current.enroll('20:30'); });
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockToggle).not.toHaveBeenCalled();
    expect(result.current.status).toBe('success');
    expect(mockHasMatching).toHaveBeenCalledWith('20:30');
  });

  it('prompt granted: success only after native confirmation, in order', async () => {
    const { result } = renderHook(() => useReminderEnrollment());
    await act(async () => { await result.current.enroll('08:05'); });
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(enableCalls()).toEqual([['08:05']]);
    expect(mockToggle).not.toHaveBeenCalled();
    expect(mockUpdatePrefs).not.toHaveBeenCalled();
    expect(mockVerify).toHaveBeenCalled();
    expect(result.current.status).toBe('success');
    expect(mockTrack).toHaveBeenCalledWith('reminder_time_selected', { hour: 8, minute: 5 });
    expect(mockTrack).toHaveBeenCalledWith('personal_reminder_enabled', { hour: 8, minute: 5 });
  });

  it('denied after prompt: denied, never enabled, no success', async () => {
    mockRequestPermissions.mockResolvedValue(false);
    const { result } = renderHook(() => useReminderEnrollment());
    await act(async () => { await result.current.enroll('20:00'); });
    expect(result.current.status).toBe('denied');
    expect(enableCalls()).toHaveLength(0);
    expect(mockToggle).not.toHaveBeenCalled();
    // The picked time is held by the UI until a grant; a denied attempt writes no time.
    expect(mockUpdatePrefs).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith('notification_permission_denied');
  });

  it('never calls updateNotificationPreferences or toggleNotifications on any enroll path', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    const granted = renderHook(() => useReminderEnrollment());
    await act(async () => { await granted.result.current.enroll('09:30'); });
    expect(granted.result.current.status).toBe('success');

    mockGetPermissionStatus.mockResolvedValue('undetermined');
    mockRequestPermissions.mockResolvedValue(false);
    const denied = renderHook(() => useReminderEnrollment());
    await act(async () => { await denied.result.current.enroll('10:45'); });
    expect(denied.result.current.status).toBe('denied');

    expect(mockUpdatePrefs).not.toHaveBeenCalled();
    expect(mockToggle).not.toHaveBeenCalled();
    expect(enableCalls()).toEqual([['09:30']]);
  });

  it('enable-only write returns false: failed, never success, no toggle', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    mockEnableDaily.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useReminderEnrollment());
    await act(async () => { await result.current.enroll('20:00'); });
    expect(result.current.status).toBe('failed');
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('previously denied (cannot ask again): blocked without prompting', async () => {
    mockGetPermissionStatus.mockResolvedValue('denied');
    const { result } = renderHook(() => useReminderEnrollment());
    await act(async () => { await result.current.enroll('20:00'); });
    expect(result.current.status).toBe('blocked');
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(enableCalls()).toHaveLength(0);
  });

  it('native confirm false: failed, and a retry succeeds', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    mockHasMatching.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useReminderEnrollment());
    await act(async () => { await result.current.enroll('20:00'); });
    expect(result.current.status).toBe('failed');
    await act(async () => { await result.current.enroll('20:00'); });
    expect(result.current.status).toBe('success');
  });

  it('thrown errors map to failed', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    mockVerify.mockRejectedValueOnce(new Error('x'));
    const { result } = renderHook(() => useReminderEnrollment());
    await act(async () => { await result.current.enroll('20:00'); });
    expect(result.current.status).toBe('failed');
  });

  it('concurrent enroll calls prompt once and share one flight', async () => {
    let release!: (v: boolean) => void;
    mockRequestPermissions.mockReturnValue(new Promise<boolean>((r) => { release = r; }));
    const { result } = renderHook(() => useReminderEnrollment());
    let p1!: Promise<void>;
    let p2!: Promise<void>;
    await act(async () => {
      p1 = result.current.enroll('20:00');
      p2 = result.current.enroll('20:00');
      await Promise.resolve();
    });
    expect(p1).toBe(p2);
    await act(async () => { release(true); await Promise.all([p1, p2]); });
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(enableCalls()).toHaveLength(1);
    expect(result.current.status).toBe('success');
  });

  it('different-time enroll while in flight queues and reflects its own time', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    let release!: () => void;
    mockVerify.mockImplementationOnce(() => new Promise<void>((r) => { release = r; }));
    const { result } = renderHook(() => useReminderEnrollment());
    let p1!: Promise<void>;
    let p2!: Promise<void>;
    await act(async () => {
      p1 = result.current.enroll('20:00');
      p2 = result.current.enroll('21:15');
      await Promise.resolve();
    });
    expect(p1).not.toBe(p2);
    expect(mockHasMatching).not.toHaveBeenCalled();
    await act(async () => { release(); await Promise.all([p1, p2]); });
    expect(mockHasMatching.mock.calls.map((c) => c[0])).toEqual(['20:00', '21:15']);
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(result.current.status).toBe('success');
  });

  it('reset during requesting is not overwritten by the stale run', async () => {
    let release!: (v: boolean) => void;
    mockRequestPermissions.mockReturnValue(new Promise<boolean>((r) => { release = r; }));
    const { result } = renderHook(() => useReminderEnrollment());
    let p!: Promise<void>;
    await act(async () => { p = result.current.enroll('20:00'); await Promise.resolve(); });
    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    await act(async () => { release(true); await p; });
    expect(result.current.status).toBe('idle');
  });

  it('reset cancels a queued enroll: no prompt, no persistence, stays idle', async () => {
    let release!: (v: boolean) => void;
    mockRequestPermissions.mockReturnValueOnce(new Promise<boolean>((r) => { release = r; }));
    const { result } = renderHook(() => useReminderEnrollment());
    let p1!: Promise<void>;
    let p2!: Promise<void>;
    await act(async () => {
      p1 = result.current.enroll('20:00');
      p2 = result.current.enroll('21:15');
      await Promise.resolve();
    });
    act(() => result.current.reset());
    await act(async () => { release(true); await Promise.all([p1, p2]); });
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(mockUpdatePrefs).not.toHaveBeenCalled();
    expect(mockHasMatching).not.toHaveBeenCalledWith('21:15');
    expect(result.current.status).toBe('idle');
  });

  it('does not emit reminder_time_selected twice on retry of the same time', async () => {
    mockGetPermissionStatus.mockResolvedValue('granted');
    mockHasMatching.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useReminderEnrollment());
    await act(async () => { await result.current.enroll('20:00'); });
    await act(async () => { await result.current.enroll('20:00'); });
    const selected = mockTrack.mock.calls.filter(([e]) => e === 'reminder_time_selected');
    expect(selected).toHaveLength(1);
  });

  it('unmount mid-enroll does not throw', async () => {
    let release!: (v: boolean) => void;
    mockRequestPermissions.mockReturnValue(new Promise<boolean>((r) => { release = r; }));
    const { result, unmount } = renderHook(() => useReminderEnrollment());
    let p!: Promise<void>;
    await act(async () => { p = result.current.enroll('20:00'); await Promise.resolve(); });
    unmount();
    release(true);
    await expect(p).resolves.toBeUndefined();
  });

  it('reset returns to idle; openSystemSettings opens settings', async () => {
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as never);
    mockRequestPermissions.mockResolvedValue(false);
    const { result } = renderHook(() => useReminderEnrollment());
    await act(async () => { await result.current.enroll('20:00'); });
    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    act(() => result.current.openSystemSettings());
    expect(spy).toHaveBeenCalled();
  });

  it('late OS grant after reset does not enable or persist the reminder', async () => {
    let grant!: (v: boolean) => void;
    mockRequestPermissions.mockReturnValueOnce(new Promise<boolean>((r) => { grant = r; }));
    const { result } = renderHook(() => useReminderEnrollment());
    let p!: Promise<void>;
    await act(async () => { p = result.current.enroll('20:00'); await Promise.resolve(); });
    act(() => result.current.reset());
    await act(async () => { grant(true); await p; });
    expect(mockToggle).not.toHaveBeenCalled();
    expect(enableCalls()).toHaveLength(0);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('reset clears a hung attempt so the same time enrolls again', async () => {
    mockRequestPermissions.mockReturnValueOnce(new Promise<boolean>(() => {}));
    const { result } = renderHook(() => useReminderEnrollment());
    await act(async () => { void result.current.enroll('20:00'); await Promise.resolve(); });
    act(() => result.current.reset());
    await act(async () => { await result.current.enroll('20:00'); });
    expect(mockRequestPermissions).toHaveBeenCalledTimes(2);
    expect(enableCalls()).toHaveLength(1);
    expect(result.current.status).toBe('success');
  });
});
