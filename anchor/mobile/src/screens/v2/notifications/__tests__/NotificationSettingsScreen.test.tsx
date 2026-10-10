import React from 'react';
import { AppState, StyleSheet } from 'react-native';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockReduced = { current: false };
jest.mock('@/hooks/useCelebrationReduceMotion', () => ({
  useCelebrationReduceMotion: () => mockReduced.current,
}));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { selection: jest.fn(), impact: jest.fn(), notification: jest.fn() } }));

// Count Reveal mounts: a replayed entrance would show up as a remount.
const mockRevealMounts = { count: 0 };
jest.mock('@/components/v2/notifications/Reveal', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Reveal = ({ children }: { children: React.ReactNode }) => {
    React.useEffect(() => {
      mockRevealMounts.count += 1;
    }, []);
    return <View>{children}</View>;
  };
  return { Reveal, default: Reveal };
});

// The sheet has its own suite; here it only needs to expose confirm/close.
jest.mock('@/components/v2/notifications/ReminderTimeSheet', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    ReminderTimeSheet: ({ open, onConfirm }: { open: boolean; onConfirm: (t: string) => void }) =>
      open ? (
        <Pressable testID="mock-sheet-done" onPress={() => onConfirm('07:17')}>
          <Text>mock sheet</Text>
        </Pressable>
      ) : null,
  };
});

const mockUpdatePrefs = jest.fn((_u: Record<string, unknown>) => Promise.resolve());
const mockToggleNotifications = jest.fn(() => Promise.resolve());
const mockState: Record<string, any> = {};
const resetState = () => {
  Object.keys(mockState).forEach((k) => delete mockState[k]);
  Object.assign(mockState, {
    notification_enabled: true,
    notificationPermissionStatus: 'granted',
    dailyPrimeEnabled: true,
    personalDailyReminderOptedIn: true,
    dailyPrimeTime: '20:30',
    threadStrengthAlertsEnabled: false,
    unfinishedAnchorRemindersEnabled: false,
    momentumCheckinsEnabled: false,
    visionRemindersEnabled: false,
    chartRemindersEnabled: false,
    weeklyRecapEnabled: false,
    notificationTone: 'encouraging',
  });
};
jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    notifState: mockState,
    toggleNotifications: mockToggleNotifications,
    updateNotificationPreferences: mockUpdatePrefs,
  }),
}));

const mockEnroll = jest.fn((_t: string) => Promise.resolve());
const mockOpenSettings = jest.fn();
const mockReset = jest.fn();
const mockEnrollStatus = { current: 'idle' };
jest.mock('@/hooks/v2/notifications/useReminderEnrollment', () => ({
  useReminderEnrollment: () => ({
    status: mockEnrollStatus.current,
    enroll: mockEnroll,
    openSystemSettings: mockOpenSettings,
    reset: mockReset,
  }),
}));

const mockGetPermission = jest.fn();
const mockHasMatching = jest.fn();
jest.mock('@/services/NotificationService', () => ({
  __esModule: true,
  default: {
    getPermissionStatus: (...a: unknown[]) => mockGetPermission(...a),
    hasMatchingPersonalDailyReminder: (...a: unknown[]) => mockHasMatching(...a),
  },
}));
const mockVerify = jest.fn();
jest.mock('@/services/notifications/NotificationCoordinator', () => ({
  NotificationCoordinator: { verifyAndReconcileNativeSchedule: (...a: unknown[]) => mockVerify(...a) },
}));
const mockTrack = jest.fn();
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: (...a: unknown[]) => mockTrack(...a) },
  AnalyticsEvents: jest.requireActual('@/services/AnalyticsService').AnalyticsEvents,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) },
}));
const mockSetWeekly = jest.fn();
jest.mock('@/stores/settingsStore', () => {
  const hook = () => ({});
  (hook as any).getState = () => ({ setWeeklySummaryEnabled: mockSetWeekly });
  return { useSettingsStore: hook };
});

import { NotificationSettingsScreen } from '../NotificationSettingsScreen';

const g = global as unknown as { __DEV__: boolean };
const originalDev = g.__DEV__;

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const renderScreen = async () => {
  const utils = render(<NotificationSettingsScreen onBack={jest.fn()} />);
  await flush();
  return utils;
};

const toggle = (name: string) => screen.getByRole('switch', { name });

beforeEach(() => {
  jest.clearAllMocks();
  resetState();
  g.__DEV__ = true;
  mockReduced.current = false;
  mockRevealMounts.count = 0;
  mockEnrollStatus.current = 'idle';
  mockGetPermission.mockResolvedValue('granted');
  mockHasMatching.mockResolvedValue(true);
  mockVerify.mockResolvedValue({});
});
afterEach(() => {
  g.__DEV__ = originalDev;
});

describe('NotificationSettingsScreen', () => {
  it('renders the sections and locked copy', async () => {
    await renderScreen();
    for (const text of [
      'YOUR DAILY MOMENT',
      'OPTIONAL REMINDERS',
      'Gentle encouragement based on your goals.',
      'YOUR PROGRESS',
      'DELIVERY',
      'Reconnect at a time you choose.',
      "Reconnect with the future you're building.",
      'Stay connected to your next move.',
      'Gentle encouragement after time away.',
      "A look at what you've accomplished.",
      'Remind me at',
      "Every day, even if you've already practiced earlier.",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByText('8:30 PM')).toBeTruthy();
    expect(screen.getByText('Encouraging')).toBeTruthy();
  });

  it('turning Daily ON enrolls with the current time and never calls toggleNotifications', async () => {
    mockState.dailyPrimeEnabled = false;
    mockState.personalDailyReminderOptedIn = false;
    mockHasMatching.mockResolvedValue(false);
    await renderScreen();
    expect(toggle('Daily reminder').props.accessibilityState.checked).toBe(false);

    fireEvent.press(toggle('Daily reminder'));
    await flush();

    expect(mockEnroll).toHaveBeenCalledTimes(1);
    expect(mockEnroll).toHaveBeenCalledWith('20:30');
    expect(mockToggleNotifications).not.toHaveBeenCalled();
    expect(mockUpdatePrefs).not.toHaveBeenCalled();
  });

  it('turning Daily OFF disables only the personal reminder', async () => {
    mockState.visionRemindersEnabled = true;
    mockState.momentumCheckinsEnabled = true;
    await renderScreen();
    fireEvent.press(toggle('Daily reminder'));
    await flush();

    expect(mockUpdatePrefs).toHaveBeenCalledTimes(1);
    expect(mockUpdatePrefs).toHaveBeenCalledWith({ dailyPrimeEnabled: false, personalDailyReminderOptedIn: false });
    expect(mockToggleNotifications).not.toHaveBeenCalled();
    expect(mockEnroll).not.toHaveBeenCalled();
  });

  it('shows the toggle OFF when the native schedule is missing even though prefs say on', async () => {
    mockHasMatching.mockResolvedValue(false);
    await renderScreen();
    await waitFor(() => expect(toggle('Daily reminder').props.accessibilityState.checked).toBe(false));
  });

  it('Vision toggle (dev) writes only its own flag', async () => {
    await renderScreen();
    fireEvent.press(toggle('Vision reminders'));
    await flush();
    expect(mockUpdatePrefs).toHaveBeenCalledTimes(1);
    expect(mockUpdatePrefs).toHaveBeenCalledWith({ visionRemindersEnabled: true });
    expect(mockTrack).toHaveBeenCalledWith('notification_category_toggled', { category: 'vision', enabled: true });
  });

  it('hides Vision and Chart when the flag is off but always shows Momentum', async () => {
    g.__DEV__ = false;
    delete process.env.EXPO_PUBLIC_ENABLE_SMART_REMINDER_TOGGLES;
    await renderScreen();
    expect(screen.queryByText('Vision reminders')).toBeNull();
    expect(screen.queryByText('Chart reminders')).toBeNull();
    expect(screen.getByText('Momentum check-ins')).toBeTruthy();
  });

  it('Momentum OFF zeroes all three flags', async () => {
    mockState.threadStrengthAlertsEnabled = true;
    await renderScreen();
    expect(toggle('Momentum check-ins').props.accessibilityState.checked).toBe(true);
    fireEvent.press(toggle('Momentum check-ins'));
    await flush();
    expect(mockUpdatePrefs).toHaveBeenCalledWith({
      momentumCheckinsEnabled: false,
      threadStrengthAlertsEnabled: false,
      unfinishedAnchorRemindersEnabled: false,
    });
  });

  it('category toggles are idempotent: a double press persists one value once', async () => {
    await renderScreen();
    const row = toggle('Chart reminders');
    fireEvent.press(row);
    fireEvent.press(row);
    await flush();
    expect(mockUpdatePrefs).toHaveBeenCalledTimes(1);
    expect(mockUpdatePrefs).toHaveBeenCalledWith({ chartRemindersEnabled: true });
    expect(mockTrack.mock.calls.filter(([e]) => e === 'notification_category_toggled')).toHaveLength(1);
  });

  it('weekly recap writes the preference and keeps the settings-store bridge', async () => {
    await renderScreen();
    fireEvent.press(toggle('Weekly recap'));
    await flush();
    expect(mockUpdatePrefs).toHaveBeenCalledWith({ weeklyRecapEnabled: true });
    expect(mockSetWeekly).toHaveBeenCalledWith(true);
  });

  it('confirming 07:17 in the sheet persists dailyPrimeTime', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('settings-row-Remind me at'));
    fireEvent.press(screen.getByTestId('mock-sheet-done'));
    await flush();
    expect(mockUpdatePrefs).toHaveBeenCalledWith({ dailyPrimeTime: '07:17' });
  });

  it('confirming a new time never flips the Daily toggle off in between', async () => {
    let confirmed = false;
    const asked: string[] = [];
    mockHasMatching.mockImplementation(async (t: string) => {
      asked.push(t);
      return confirmed ? t === '07:17' : t === '20:30';
    });
    await renderScreen();
    fireEvent.press(screen.getByTestId('settings-row-Remind me at'));
    mockUpdatePrefs.mockImplementationOnce(async () => {
      confirmed = true;
    });
    asked.length = 0;
    fireEvent.press(screen.getByTestId('mock-sheet-done'));
    await flush();
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((t) => t === '07:17')).toBe(true);
    expect(toggle('Daily reminder').props.accessibilityState.checked).toBe(true);
  });

  it('drawer: open on first render is fully expanded, closed is collapsed and hidden from screen readers', async () => {
    await renderScreen();
    const open = StyleSheet.flatten(screen.getByTestId('notification-time-drawer').props.style);
    expect(open.maxHeight).toBe(240);
    expect(open.opacity).toBe(1);

    cleanup();
    mockState.dailyPrimeEnabled = false;
    mockState.personalDailyReminderOptedIn = false;
    mockHasMatching.mockResolvedValue(false);
    await renderScreen();
    const closed = screen.getByTestId('notification-time-drawer', { includeHiddenElements: true });
    const closedStyle = StyleSheet.flatten(closed.props.style);
    expect(closedStyle.maxHeight).toBe(0);
    expect(closedStyle.opacity).toBe(0);
    expect(closed.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(closed.props.accessibilityElementsHidden).toBe(true);
  });

  it('OS denied: banner with Open Settings and every toggle disabled', async () => {
    mockState.notificationPermissionStatus = 'denied';
    mockGetPermission.mockResolvedValue('denied');
    await renderScreen();
    expect(screen.getByText('Notifications are disabled in device settings.')).toBeTruthy();
    for (const name of ['Daily reminder', 'Vision reminders', 'Chart reminders', 'Momentum check-ins', 'Weekly recap']) {
      expect(toggle(name).props.accessibilityState.disabled).toBe(true);
    }
    fireEvent.press(screen.getByLabelText('Open Settings'));
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('shows enrollment feedback with Open Settings when enrollment is blocked', async () => {
    mockEnrollStatus.current = 'blocked';
    await renderScreen();
    expect(screen.getByTestId('notification-enroll-feedback')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open Settings'));
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('re-verifies and re-reads on foreground (OS toggled off while open)', async () => {
    let appStateCb: ((s: string) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, cb: (s: string) => void) => {
      appStateCb = cb;
      return { remove: jest.fn() };
    }) as never);
    await renderScreen();
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Notifications are disabled in device settings.')).toBeNull();

    mockGetPermission.mockResolvedValue('denied');
    mockHasMatching.mockResolvedValue(false);
    await act(async () => {
      appStateCb!('active');
    });
    await flush();

    expect(mockVerify).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByText('Notifications are disabled in device settings.')).toBeTruthy());
    expect(toggle('Daily reminder').props.accessibilityState.checked).toBe(false);
    (AppState.addEventListener as jest.Mock).mockRestore();
  });

  it('does not replay entrance animations when toggles change', async () => {
    const { rerender } = await renderScreen();
    const mounted = mockRevealMounts.count;
    expect(mounted).toBe(4);

    fireEvent.press(toggle('Momentum check-ins'));
    fireEvent.press(toggle('Weekly recap'));
    await flush();
    mockState.momentumCheckinsEnabled = true;
    mockState.weeklyRecapEnabled = true;
    rerender(<NotificationSettingsScreen onBack={jest.fn()} />);
    await flush();

    expect(mockRevealMounts.count).toBe(mounted);
  });
});
