import React from 'react';
import { Alert, DeviceEventEmitter } from 'react-native';
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

const originalChartPreviewEnvironment = {
  appEnvironment: process.env.EXPO_PUBLIC_APP_ENV,
  v2Enabled: process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED,
};

function restoreChartPreviewEnvironment() {
  if (originalChartPreviewEnvironment.appEnvironment === undefined) {
    delete process.env.EXPO_PUBLIC_APP_ENV;
  } else {
    process.env.EXPO_PUBLIC_APP_ENV = originalChartPreviewEnvironment.appEnvironment;
  }

  if (originalChartPreviewEnvironment.v2Enabled === undefined) {
    delete process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED;
  } else {
    process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED = originalChartPreviewEnvironment.v2Enabled;
  }
}

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

process.env.EXPO_PUBLIC_SFX_DEBUG = '1';
const NotificationService = require('@/services/NotificationService').default;
const { SettingsScreen } = require('../SettingsScreen');
delete process.env.EXPO_PUBLIC_SFX_DEBUG;

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

  afterEach(() => {
    restoreChartPreviewEnvironment();
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

  it('opens the Chart opening lab from Settings in an enabled staging V2 preview', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'staging';
    process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED = 'true';
    const emitSpy = jest.spyOn(DeviceEventEmitter, 'emit');

    try {
      const screen = render(<SettingsScreen />);
      fireEvent.press(screen.getByTestId('settings-row-Chart opening preview'));

      expect(emitSpy).toHaveBeenCalledWith('openChartLab');
    } finally {
      emitSpy.mockRestore();
    }
  });

  it('hides the Chart opening lab row in production, even with V2 enabled', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED = 'true';

    const screen = render(<SettingsScreen />);

    expect(screen.queryByTestId('settings-row-Chart opening preview')).toBeNull();
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

  it('navigates to the redesigned Notifications screen (permission flows live in its own suite)', async () => {
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-row-Notifications & reminders'));
    expect(screen.getByText('Notifications & reminders')).toBeTruthy();
    expect(screen.getByText('YOUR DAILY MOMENT')).toBeTruthy();
    expect(screen.getByLabelText('Daily reminder')).toBeTruthy();
  });

  it('notifications back returns to the main settings list', async () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-row-Notifications & reminders'));
    expect(screen.getByText('YOUR DAILY MOMENT')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.queryByText('YOUR DAILY MOMENT')).toBeNull();
    expect(screen.getByTestId('settings-row-Notifications & reminders')).toBeTruthy();
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

  it('opens the hidden audio log from a long press on the version', () => {
    const screen = render(<SettingsScreen />);

    expect(screen.queryByText('Audio log')).toBeNull();
    fireEvent(screen.getByTestId('settings-open-audio-log'), 'longPress');

    expect(screen.getByText('Audio log')).toBeTruthy();
    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.getByText('Clear')).toBeTruthy();
  });

  it('renders header title for Notifications & reminders cleanly without truncation', () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-row-Notifications & reminders'));
    expect(screen.getByText('Notifications & reminders')).toBeTruthy();
  });
});
jest.mock('@/components/ToastProvider', () => ({ useToast: () => ({ info: jest.fn() }) }));
