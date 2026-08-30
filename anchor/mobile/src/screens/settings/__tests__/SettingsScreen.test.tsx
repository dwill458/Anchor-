import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockUpdateSetting = jest.fn(() => Promise.resolve());
const mockRequestPermissions = jest.fn(() => Promise.resolve(true));
const mockToggleNotifications = jest.fn(() => Promise.resolve());
const mockUpdateNotificationPreferences = jest.fn(() => Promise.resolve());
const mockSetReduceMotion = jest.fn();
const mockResetTeaching = jest.fn();
const mockRestorePurchases = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn(), dispatch: jest.fn() })),
  dispatch: jest.fn(),
};

const mockSettings = {
  openDailyAnchorAutomatically: false,
  practiceGuidanceEnabled: true,
  reduceIntentionVisibility: false,
  hapticFeedback: 'strong' as const,
  soundEffectsEnabled: true,
};
const mockSettingsStoreState = {
  traceDefaultEnabled: true,
  setTraceDefaultEnabled: jest.fn(),
  reduceMotion: 'system' as const,
  setReduceMotion: mockSetReduceMotion,
  analyticsEnabled: true,
  setAnalyticsEnabled: jest.fn(),
};
const mockAuthStoreState = {
  user: { id: 'user-1', email: 'member@anchor.test' },
  isAuthenticated: true,
  profileData: null,
  fetchProfile: jest.fn(() => Promise.resolve()),
  setUser: jest.fn(),
  setHasCompletedOnboarding: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
};
const mockNotifState = {
  notification_enabled: false,
  dailyPrimeTime: '21:00',
  weeklyRecapEnabled: false,
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  CommonActions: { reset: jest.fn() },
}));

jest.mock('@/hooks/useSettings', () => ({
  useSettingsState: () => ({ settings: mockSettings, updateSetting: mockUpdateSetting, isLoading: false }),
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({ useReduceMotionEnabled: () => false }));
jest.mock('@/hooks/useTrialStatus', () => ({
  useTrialStatus: () => ({ isSubscribed: false, isTrialActive: true, daysRemaining: 4 }),
}));
jest.mock('@/components/transitions/SettingsRevealProvider', () => ({
  useSettingsReveal: () => ({ markSettingsReady: jest.fn() }),
}));
jest.mock('@/components/settings/SettingsRow', () => ({
  SettingsRow: ({ title, subtitle, value, type, onToggle, toggleValue, onPress, rightElement }: any) => {
    const ReactNative = require('react-native');
    return (
      <ReactNative.Pressable
        testID={`settings-row-${title}`}
        onPress={() => type === 'toggle' && onToggle ? onToggle(!toggleValue) : onPress?.()}
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
jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    notifState: mockNotifState,
    toggleNotifications: mockToggleNotifications,
    updateNotificationPreferences: mockUpdateNotificationPreferences,
  }),
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: typeof mockAuthStoreState) => unknown) =>
    selector ? selector(mockAuthStoreState) : mockAuthStoreState,
}));
jest.mock('@/stores/teachingStore', () => ({
  useTeachingStore: { getState: () => ({ reset: mockResetTeaching }) },
}));
jest.mock('@/services/AuthService', () => ({
  AuthService: {
    getCurrentFirebaseUser: jest.fn(() => null),
    getLinkedProviders: jest.fn(() => ['password']),
    signOut: jest.fn(() => Promise.resolve()),
    deleteAccount: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: { SIGN_OUT: 'sign_out' },
  AnalyticsService: { track: jest.fn(), setEnabled: jest.fn() },
}));
jest.mock('@/services/ApiClient', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/services/reviewPromptService', () => ({ openStoreListing: jest.fn(() => Promise.resolve()) }));
jest.mock('@/services/RevenueCatService', () => ({
  __esModule: true,
  default: { restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args) },
}));

const NotificationService = require('@/services/NotificationService').default;
const { SettingsScreen } = require('../SettingsScreen');

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifState.notification_enabled = false;
    mockNotifState.weeklyRecapEnabled = false;
    mockNotifState.dailyPrimeTime = '21:00';
    mockAuthStoreState.user = { id: 'user-1', email: 'member@anchor.test' };
    mockAuthStoreState.isAuthenticated = true;
    NotificationService.requestPermissions = mockRequestPermissions;
    NotificationService.getLastError = jest.fn(() => null);
  });

  it('renders the canonical editorial settings flow without legacy rows', () => {
    const screen = render(<SettingsScreen />);

    expect(screen.getByText('PRACTICE')).toBeTruthy();
    expect(screen.getByText('REMINDERS')).toBeTruthy();
    expect(screen.getByText('SUPPORT & PRIVACY')).toBeTruthy();
    expect(screen.getByText('member@anchor.test')).toBeTruthy();
    expect(screen.queryByText('Daily Prime Reminder')).toBeNull();
    expect(screen.queryByText('Danger Zone')).toBeNull();
  });

  it('persists an interface preference through the existing settings hook', () => {
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-row-Sound Effects'));

    expect(mockUpdateSetting).toHaveBeenCalledWith('soundEffectsEnabled', false);
  });

  it('requests permission before turning practice reminders on', async () => {
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-row-Practice Reminders'));

    await waitFor(() => {
      expect(mockRequestPermissions).toHaveBeenCalled();
      expect(mockToggleNotifications).toHaveBeenCalledWith(true);
    });
  });

  it('keeps reminder controls blocked when notification permission is denied', async () => {
    mockRequestPermissions.mockResolvedValueOnce(false);
    NotificationService.getLastError = jest.fn(() => ({ message: 'Notification permissions were denied.' }));
    const alert = jest.spyOn(Alert, 'alert');
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-row-Practice Reminders'));

    await waitFor(() => {
      expect(mockToggleNotifications).not.toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith('Notification Permission Required', 'Notification permissions were denied.');
    });
  });

  it('persists picker choices for haptics and reduced motion', async () => {
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-row-Haptic Feedback'));
    fireEvent.press(screen.getByLabelText('Soft'));
    await waitFor(() => expect(mockUpdateSetting).toHaveBeenCalledWith('hapticFeedback', 'light'));

    fireEvent.press(screen.getByTestId('settings-row-Reduce Motion'));
    fireEvent.press(screen.getByLabelText('Reduced'));
    expect(mockSetReduceMotion).toHaveBeenCalledWith('on');
  });

  it('uses confirmation before resetting teaching tips', () => {
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-row-Reset Teaching Tips'));
    expect(screen.getByText('Show teaching tips again?')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Reset Tips'));

    expect(mockResetTeaching).toHaveBeenCalled();
  });

  it('restores purchases and keeps store errors user-facing', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockRestorePurchases.mockResolvedValueOnce({ hasActiveEntitlement: false });
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-row-Restore Purchases'));

    await waitFor(() => {
      expect(mockRestorePurchases).toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith('No subscription found', expect.stringContaining('No active subscription'));
    });
  });
});
