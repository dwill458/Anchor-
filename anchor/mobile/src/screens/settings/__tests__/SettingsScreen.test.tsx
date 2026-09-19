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
  canGoBack: jest.fn(() => true),
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
  guideModeEnabled: true,
  setGuideModeEnabled: jest.fn(),
  hideIntentionText: false,
  setHideIntentionText: jest.fn(),
  dailyPracticeGoal: 3,
  dailyPracticeGoalPreset: 'three',
  setDailyPracticeGoal: jest.fn(),
  setDailyPracticeGoalPreset: jest.fn(),
  threadStrengthSensitivity: 'balanced',
  setThreadStrengthSensitivity: jest.fn(),
  focusSessionDuration: 30,
  setFocusSessionDuration: jest.fn(),
  primeSessionDuration: 300,
  setPrimeSessionDuration: jest.fn(),
  visualizeSessionDuration: 180,
  setVisualizeSessionDuration: jest.fn(),
  sessionAudioMode: 'ambient',
  setSessionAudioMode: jest.fn(),
};
const mockAuthStoreState = {
  user: { id: 'user-1', email: 'member@anchor.test', displayName: 'Mara Vale' },
  isAuthenticated: true,
  isGuest: false,
  profileData: null,
  fetchProfile: jest.fn(() => Promise.resolve()),
  setUser: jest.fn(),
  setHasCompletedOnboarding: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
};
const mockNotifState = {
  notification_enabled: false,
  dailyPrimeTime: '21:00',
  dailyPrimeEnabled: true,
  threadStrengthAlertsEnabled: true,
  threadStrengthThreshold: 0.7,
  unfinishedAnchorRemindersEnabled: false,
  notificationTone: 'encouraging',
  weeklyRecapEnabled: false,
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  CommonActions: { reset: jest.fn() },
}));

jest.mock('@/hooks/useSettings', () => ({
  useSettingsState: () => ({ settings: mockSettings, updateSetting: mockUpdateSetting, isLoading: false }),
}));

let mockTrialStatus = { isSubscribed: false, isTrialActive: true, daysRemaining: 4 };
jest.mock('@/hooks/useTrialStatus', () => ({
  useTrialStatus: () => mockTrialStatus,
}));
jest.mock('@/components/transitions/SettingsRevealProvider', () => ({
  useSettingsReveal: () => ({ markSettingsReady: jest.fn() }),
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
jest.mock('@/services/ApiClient', () => ({ apiClient: { get: jest.fn(), patch: jest.fn() } }));
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
    mockAuthStoreState.user = { id: 'user-1', email: 'member@anchor.test', displayName: 'Mara Vale' };
    mockAuthStoreState.isAuthenticated = true;
    mockAuthStoreState.isGuest = false;
    NotificationService.requestPermissions = mockRequestPermissions;
    NotificationService.getLastError = jest.fn(() => null);
  });

  it('renders the canonical editorial settings hub with profile header and categories', () => {
    const screen = render(<SettingsScreen />);

    expect(screen.getByText('Profile & Settings')).toBeTruthy();
    expect(screen.getByText('Mara Vale')).toBeTruthy();
    expect(screen.getByText('TRIAL')).toBeTruthy();
    expect(screen.getByText('Anchors')).toBeTruthy();
    expect(screen.getByText('Sessions')).toBeTruthy();
    expect(screen.getByTestId('settings-row-Practice')).toBeTruthy();
    expect(screen.getByTestId('settings-row-Notifications & reminders')).toBeTruthy();
    expect(screen.getByTestId('settings-row-App experience')).toBeTruthy();
    expect(screen.getByTestId('settings-row-Account & data')).toBeTruthy();
    expect(screen.getByTestId('settings-row-Privacy & support')).toBeTruthy();
    expect(screen.getByTestId('settings-row-Sign Out')).toBeTruthy();
  });

  it('navigates to App Experience and persists an interface preference', () => {
    const screen = render(<SettingsScreen />);

    // Tap into App Experience subscreen
    fireEvent.press(screen.getByTestId('settings-row-App experience'));
    expect(screen.getByText('App experience')).toBeTruthy();

    // Toggle Sound Effects
    fireEvent.press(screen.getByTestId('settings-row-Sound Effects'));
    expect(mockUpdateSetting).toHaveBeenCalledWith('soundEffectsEnabled', false);
  });

  it('navigates to Notifications and requests permission before turning practice reminders on', async () => {
    const screen = render(<SettingsScreen />);

    // Tap into Notifications subscreen
    fireEvent.press(screen.getByTestId('settings-row-Notifications & reminders'));
    expect(screen.getByText('Notifications & reminders')).toBeTruthy();

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

    fireEvent.press(screen.getByTestId('settings-row-Notifications & reminders'));
    fireEvent.press(screen.getByTestId('settings-row-Practice Reminders'));

    await waitFor(() => {
      expect(mockToggleNotifications).not.toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith('Notification Permission Required', 'Notification permissions were denied.');
    });
  });

  it('persists picker choices for haptics and reduced motion in App Experience', async () => {
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-row-App experience'));

    fireEvent.press(screen.getByTestId('settings-row-Haptic Feedback'));
    fireEvent.press(screen.getByLabelText('Soft'));
    await waitFor(() => expect(mockUpdateSetting).toHaveBeenCalledWith('hapticFeedback', 'light'));

    fireEvent.press(screen.getByTestId('settings-row-Reduce Motion'));
    fireEvent.press(screen.getByLabelText('Reduced'));
    expect(mockSetReduceMotion).toHaveBeenCalledWith('on');
  });

  it('uses confirmation before resetting teaching tips in App Experience', () => {
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-row-App experience'));

    fireEvent.press(screen.getByTestId('settings-row-Reset Teaching Tips'));
    expect(screen.getByText('Reset teaching tips?')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Reset'));

    expect(mockResetTeaching).toHaveBeenCalled();
  });

  it('navigates to Account & Data, restores purchases and keeps store errors user-facing', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockRestorePurchases.mockResolvedValueOnce({ hasActiveEntitlement: false });
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-row-Account & data'));

    fireEvent.press(screen.getByTestId('settings-row-Restore Purchases'));

    await waitFor(() => {
      expect(mockRestorePurchases).toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith('No subscription found', expect.stringContaining('No active subscription'));
    });
  });

  it('navigates to Login when Sign In row is pressed by unauthenticated user', () => {
    mockAuthStoreState.isAuthenticated = false;
    mockAuthStoreState.isGuest = true;
    mockAuthStoreState.user = null as any;
    const screen = render(<SettingsScreen />);

    expect(screen.getByTestId('settings-row-Sign In')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-row-Sign In'));

    expect(mockNavigate).toHaveBeenCalledWith('Login', { initialTab: 'signin' });
  });

  it('allows navigating back from a subscreen to the Settings Hub', () => {
    const screen = render(<SettingsScreen />);

    // Enter Practice subscreen
    fireEvent.press(screen.getByTestId('settings-row-Practice'));
    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByText('Session defaults')).toBeTruthy();

    // Tap back button
    fireEvent.press(screen.getByLabelText('Back'));

    // Returns to main Hub
    expect(screen.getByText('Profile & Settings')).toBeTruthy();
    expect(screen.getByTestId('settings-row-Practice')).toBeTruthy();
  });

  it('renders PRO badge and summary when user is subscribed', () => {
    mockTrialStatus = { isSubscribed: true, isTrialActive: false, daysRemaining: 0 };
    const screen = render(<SettingsScreen />);

    expect(screen.getByText('PRO')).toBeTruthy();
    expect(screen.getByText('Pro')).toBeTruthy();
  });

  it('renders FREE badge and summary when user has no active subscription or trial', () => {
    mockTrialStatus = { isSubscribed: false, isTrialActive: false, daysRemaining: 0 };
    const screen = render(<SettingsScreen />);

    expect(screen.getByText('FREE')).toBeTruthy();
    expect(screen.getByText('Free')).toBeTruthy();
  });

  it('renders Developer Tools row under __DEV__ environment', () => {
    const screen = render(<SettingsScreen />);
    expect(screen.getByTestId('settings-row-Developer Tools')).toBeTruthy();
    expect(screen.getByText('Developer Tools')).toBeTruthy();
  });

  it('renders header title for Notifications & reminders cleanly without truncation', () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-row-Notifications & reminders'));
    expect(screen.getByText('Notifications & reminders')).toBeTruthy();
  });
});
