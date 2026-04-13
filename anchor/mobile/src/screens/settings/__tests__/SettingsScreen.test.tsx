import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockUpdateSetting = jest.fn(() => Promise.resolve());
const mockResetSettings = jest.fn(() => Promise.resolve());
const mockRequestPermissions = jest.fn(() => Promise.resolve(true));
const mockCancelDailyReminder = jest.fn(() => Promise.resolve());
const mockSyncDailyReminderFromStores = jest.fn(() => Promise.resolve());
const mockSyncDailyGoalNudgesFromStores = jest.fn(() => Promise.resolve([]));
const mockSettings = {
  primingMode: 'quick' as const,
  primingDuration: 30 as const,
  openDailyAnchorAutomatically: false,
  practiceGuidanceEnabled: true,
  focusDuration: 10,
  focusDefaultMode: 'silent' as const,
  focusBurstGoal: 3,
  reduceIntentionVisibility: false,
  dailyReminderEnabled: false,
  dailyReminderTime: '09:00',
  streakProtectionAlertsEnabled: false,
  weeklySummaryEnabled: false,
  hapticFeedback: 'strong' as const,
  soundEffectsEnabled: true,
  dev_developerModeEnabled: false,
  dev_overridesEnabled: false,
  dev_simulatedTier: 'pro' as const,
  dev_skipOnboarding: false,
  dev_allowDirectAnchorDelete: false,
  dev_debugLogging: false,
  dev_forceStreakBreak: false,
};

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('@/hooks/useSettings', () => ({
  useSettingsState: () => ({
    settings: mockSettings,
    updateSetting: mockUpdateSetting,
    resetSettings: mockResetSettings,
    isLoading: false,
  }),
}));

jest.mock('@/components/transitions/SettingsRevealProvider', () => ({
  useSettingsReveal: () => ({
    markSettingsReady: jest.fn(),
  }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { setHasCompletedOnboarding: jest.Mock }) => unknown) =>
    selector({ setHasCompletedOnboarding: jest.fn() }),
}));

jest.mock('@/services/DailyGoalNudgeService', () => ({
  syncDailyReminderFromStores: () => mockSyncDailyReminderFromStores(),
  syncDailyGoalNudgesFromStores: (...args: unknown[]) =>
    mockSyncDailyGoalNudgesFromStores(...(args as [])),
}));

const NotificationService = require('@/services/NotificationService').default;
const { SettingsScreen } = require('../SettingsScreen');

const pressDailyReminderRow = (screen: ReturnType<typeof render>) => {
  const dailyReminderLabel = screen.getByText('Daily Reminder');
  const row = dailyReminderLabel.parent?.parent?.parent?.parent;

  if (!row) {
    throw new Error('Daily Reminder row was not found');
  }

  fireEvent.press(row);
};

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings.dailyReminderEnabled = false;
    NotificationService.requestPermissions = mockRequestPermissions;
    NotificationService.cancelDailyReminder = mockCancelDailyReminder;
  });

  it('requests permission and syncs notifications when enabling daily reminders', async () => {
    const screen = render(<SettingsScreen />);

    pressDailyReminderRow(screen);

    await waitFor(() => {
      expect(mockRequestPermissions).toHaveBeenCalled();
      expect(mockUpdateSetting).toHaveBeenCalledWith('dailyReminderEnabled', true);
      expect(mockSyncDailyReminderFromStores).toHaveBeenCalled();
      expect(mockSyncDailyGoalNudgesFromStores).toHaveBeenCalled();
    });
  });

  it('shows reminder time and cancels notifications when disabling daily reminders', async () => {
    mockSettings.dailyReminderEnabled = true;

    const screen = render(<SettingsScreen />);

    expect(screen.getByText('Reminder Time')).toBeTruthy();

    pressDailyReminderRow(screen);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith('dailyReminderEnabled', false);
      expect(mockCancelDailyReminder).toHaveBeenCalled();
      expect(mockSyncDailyGoalNudgesFromStores).toHaveBeenCalled();
    });
  });
});
