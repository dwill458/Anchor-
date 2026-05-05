import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockUpdateSetting = jest.fn(() => Promise.resolve());
const mockResetSettings = jest.fn(() => Promise.resolve());
const mockRequestPermissions = jest.fn(() => Promise.resolve(true));
const mockToggleNotifications = jest.fn(() => Promise.resolve());
const mockUpdateActiveHours = jest.fn(() => Promise.resolve());
const mockToggleWeaver = jest.fn(() => Promise.resolve());
const mockNotifState = {
  notification_enabled: true,
  active_hours_start: 8,
  active_hours_end: 21,
  sovereign_rank: false,
  weaver_enabled: true,
};
const mockSettings = {
  openDailyAnchorAutomatically: false,
  practiceGuidanceEnabled: true,
  reduceIntentionVisibility: false,
  weeklySummaryEnabled: false,
  hapticFeedback: 'strong' as const,
  soundEffectsEnabled: true,
};
const mockSettingsStoreState = {
  focusSessionMode: 'quick' as const,
  focusSessionDuration: 30,
  focusSessionAudio: 'silent' as const,
  primeSessionDuration: 120,
  primeSessionAudio: 'silent' as const,
  dailyPracticeGoal: 3,
  dailyPracticeGoalPreset: 'three' as const,
  threadStrengthSensitivity: 'balanced' as const,
  restDays: [] as number[],
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

jest.mock('@/components/settings/SettingsRow', () => ({
  SettingsRow: ({ title, type, onToggle, toggleValue, onPress }: any) => {
    const ReactNative = require('react-native');

    return (
      <ReactNative.Pressable
        testID={`settings-row-${title}`}
        onPress={() => {
          if (type === 'toggle' && typeof onToggle === 'function') {
            onToggle(!toggleValue);
            return;
          }

          if (typeof onPress === 'function') {
            onPress();
          }
        }}
      >
        <ReactNative.Text>{title}</ReactNative.Text>
      </ReactNative.Pressable>
    );
  },
}));

jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector?: (state: typeof mockSettingsStoreState) => unknown) =>
    selector ? selector(mockSettingsStoreState) : mockSettingsStoreState,
}));

jest.mock('../../../hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    notifState: mockNotifState,
    toggleNotifications: mockToggleNotifications,
    updateActiveHours: mockUpdateActiveHours,
    toggleWeaver: mockToggleWeaver,
  }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: {
    setHasCompletedOnboarding: jest.Mock;
    signOut: jest.Mock;
  }) => unknown) => {
    const state = {
      setHasCompletedOnboarding: jest.fn(),
      signOut: jest.fn(),
    };

    return selector ? selector(state) : state;
  },
}));

const NotificationService = require('@/services/NotificationService').default;
const { SettingsScreen } = require('../SettingsScreen');

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifState.notification_enabled = false;
    NotificationService.requestPermissions = mockRequestPermissions;
    NotificationService.getLastError = jest.fn(() => null);
  });

  it('requests permission before enabling notifications', async () => {
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-row-Notifications'));

    await waitFor(() => {
      expect(mockRequestPermissions).toHaveBeenCalled();
      expect(mockToggleNotifications).toHaveBeenCalledWith(true);
    });
  });

  it('does not enable notifications when permission is denied', async () => {
    mockRequestPermissions.mockResolvedValue(false);
    NotificationService.getLastError = jest.fn(() => ({
      message: 'Notification permissions were denied.',
    }));

    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-row-Notifications'));

    await waitFor(() => {
      expect(mockRequestPermissions).toHaveBeenCalled();
      expect(mockToggleNotifications).not.toHaveBeenCalled();
    });
  });
});
