import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockUpdateSetting = jest.fn(() => Promise.resolve());
const mockResetSettings = jest.fn(() => Promise.resolve());
const mockRequestPermissions = jest.fn(() => Promise.resolve(true));
const mockToggleNotifications = jest.fn(() => Promise.resolve());
const mockUpdateActiveHours = jest.fn(() => Promise.resolve());
const mockToggleWeaver = jest.fn(() => Promise.resolve());
const mockUpdateNotificationPreferences = jest.fn(() => Promise.resolve());
const mockNotifState = {
  notification_enabled: true,
  active_hours_start: 8,
  active_hours_end: 21,
  sovereign_rank: false,
  weaver_enabled: true,
  dailyPrimeEnabled: true,
  dailyPrimeTime: '21:00',
  threadStrengthAlertsEnabled: true,
  threadStrengthThreshold: 70,
  unfinishedAnchorRemindersEnabled: true,
  weeklyRecapEnabled: false,
  milestoneNotificationsEnabled: true,
  notificationTone: 'encouraging',
};
const mockFetchProfile = jest.fn(() => Promise.resolve());
const mockNavigate = jest.fn();
const mockSettings = {
  openDailyAnchorAutomatically: false,
  practiceGuidanceEnabled: true,
  reduceIntentionVisibility: false,
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
const mockAuthStoreState = {
  user: {
    id: 'user-1',
    email: 'member@anchor.test',
  },
  isAuthenticated: true,
  profileData: null,
  fetchProfile: mockFetchProfile,
  setUser: jest.fn(),
  setHasCompletedOnboarding: jest.fn(),
  signOut: jest.fn(),
};

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
  CommonActions: {
    reset: jest.fn(),
  },
}));

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
  SettingsRow: ({ title, subtitle, value, rightElement, type, onToggle, toggleValue, onPress }: any) => {
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
        {subtitle ? <ReactNative.Text>{subtitle}</ReactNative.Text> : null}
        {value ? <ReactNative.Text>{value}</ReactNative.Text> : null}
        {rightElement}
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
    updateNotificationPreferences: mockUpdateNotificationPreferences,
  }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: typeof mockAuthStoreState) => unknown) =>
    selector ? selector(mockAuthStoreState) : mockAuthStoreState,
}));

jest.mock('@/services/AuthService', () => ({
  AuthService: {
    getCurrentFirebaseUser: jest.fn(() => null),
    getLinkedProviders: jest.fn(() => []),
    signOut: jest.fn(() => Promise.resolve()),
  },
}));

const mockRestorePurchases = jest.fn();
jest.mock('@/services/RevenueCatService', () => ({
  __esModule: true,
  default: {
    restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args),
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
    mockAuthStoreState.user = {
      id: 'user-1',
      email: 'member@anchor.test',
    };
    mockAuthStoreState.isAuthenticated = true;
    mockAuthStoreState.profileData = null;
  });

  it('renders the synced account email instead of placeholder copy', () => {
    const screen = render(<SettingsScreen />);

    expect(screen.getByText('member@anchor.test')).toBeTruthy();
    expect(screen.getByText('Synced to this account')).toBeTruthy();
    expect(screen.queryByText('Account sync coming soon')).toBeNull();
    expect(screen.queryByText('v1.1')).toBeNull();
    expect(mockFetchProfile).not.toHaveBeenCalled();
  });

  it('shows a sign-in link for signed-out users', () => {
    mockAuthStoreState.user = null as any;
    mockAuthStoreState.isAuthenticated = false;

    const screen = render(<SettingsScreen />);

    expect(screen.getAllByText('Not signed in').length).toBeGreaterThan(0);
    expect(screen.getByText('Sign In')).toBeTruthy();
    expect(screen.getByText('Create or reconnect your account')).toBeTruthy();
    expect(screen.queryByText('Danger Zone')).toBeNull();
    expect(screen.queryByText('Delete Account')).toBeNull();

    fireEvent.press(screen.getByTestId('settings-row-Sign In'));

    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      initialTab: 'signin',
    });
  });

  it('renders the Danger Zone and Delete Account option for authenticated users', () => {
    mockAuthStoreState.user = {
      id: 'user-1',
      email: 'member@anchor.test',
    };
    mockAuthStoreState.isAuthenticated = true;

    const screen = render(<SettingsScreen />);

    expect(screen.getByText('Danger Zone')).toBeTruthy();
    expect(screen.getByText('Delete Account')).toBeTruthy();
  });

  it('shows the correct subscription warning when Delete Account is pressed', () => {
    const spyAlert = jest.spyOn(Alert, 'alert');
    mockAuthStoreState.user = {
      id: 'user-1',
      email: 'member@anchor.test',
    };
    mockAuthStoreState.isAuthenticated = true;

    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-row-Delete Account'));

    expect(spyAlert).toHaveBeenCalledWith(
      'Delete Account',
      expect.stringContaining('Deleting your account will not cancel active subscriptions. Please cancel any active subscriptions through your App Store or Google Play account to prevent future billing.'),
      expect.any(Array)
    );
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

  it('renders Phase 1 notification controls and updates preferences', async () => {
    mockNotifState.notification_enabled = true;
    const screen = render(<SettingsScreen />);

    expect(screen.getByText('Daily Prime Reminder')).toBeTruthy();
    expect(screen.getByText('Thread Strength Alerts')).toBeTruthy();
    expect(screen.getByText('Unfinished Anchor Reminders')).toBeTruthy();
    expect(screen.getByText('Weekly Progress Recap')).toBeTruthy();
    expect(screen.getByText('Milestone Celebrations')).toBeTruthy();
    expect(screen.getByText('Notification Tone')).toBeTruthy();

    fireEvent.press(screen.getByTestId('settings-row-Thread Threshold'));
    fireEvent.press(screen.getByTestId('settings-row-Notification Tone'));

    await waitFor(() => {
      expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith({
        threadStrengthThreshold: 85,
      });
      expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith({
        notificationTone: 'reflective',
      });
    });
  });

  describe('Restore Purchase', () => {
    const trialStatus = (hasActiveEntitlement: boolean) => ({
      isInTrial: false,
      isSubscribed: hasActiveEntitlement,
      hasActiveEntitlement,
      daysRemaining: null,
      trialExpired: false,
    });

    it('restores through RevenueCatService and confirms when an entitlement is found', async () => {
      const spyAlert = jest.spyOn(Alert, 'alert');
      mockRestorePurchases.mockResolvedValueOnce(trialStatus(true));

      const screen = render(<SettingsScreen />);
      fireEvent.press(screen.getByTestId('settings-row-Restore Purchase'));

      await waitFor(() => {
        expect(mockRestorePurchases).toHaveBeenCalled();
        expect(spyAlert).toHaveBeenCalledWith(
          'Purchases restored',
          expect.stringContaining('Pro access')
        );
      });
    });

    it('tells the user when no subscription is found', async () => {
      const spyAlert = jest.spyOn(Alert, 'alert');
      mockRestorePurchases.mockResolvedValueOnce(trialStatus(false));

      const screen = render(<SettingsScreen />);
      fireEvent.press(screen.getByTestId('settings-row-Restore Purchase'));

      await waitFor(() => {
        expect(spyAlert).toHaveBeenCalledWith(
          'No subscription found',
          expect.stringContaining('No active subscription')
        );
      });
    });

    it('shows calm failure copy without internal details when restore throws', async () => {
      const spyAlert = jest.spyOn(Alert, 'alert');
      mockRestorePurchases.mockRejectedValueOnce(
        new Error('[RevenueCat] Billing service is unavailable.')
      );

      const screen = render(<SettingsScreen />);
      fireEvent.press(screen.getByTestId('settings-row-Restore Purchase'));

      await waitFor(() => {
        expect(spyAlert).toHaveBeenCalledWith(
          'Restore failed',
          expect.not.stringContaining('RevenueCat')
        );
      });
    });
  });

});
