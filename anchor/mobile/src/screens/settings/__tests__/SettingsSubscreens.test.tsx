import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PracticeSubscreen } from '../PracticeSubscreen';
import { AppExperienceSubscreen } from '../AppExperienceSubscreen';
import { PrivacySupportSubscreen } from '../PrivacySupportSubscreen';

const mockUpdateSetting = jest.fn(() => Promise.resolve());
const mockTeachingReset = jest.fn(async (_accountId: string | null) => undefined);
const mockToastInfo = jest.fn();
jest.mock('@/hooks/v2/teaching/teachingSeen', () => ({ resetAllTeachingSeen: (accountId: string | null) => mockTeachingReset(accountId) }));
jest.mock('@/components/ToastProvider', () => ({ useToast: () => ({ info: mockToastInfo }) }));
const mockSetDailyPracticeGoal = jest.fn();
const mockSetDailyPracticeGoalPreset = jest.fn();
const mockSetThreadStrengthSensitivity = jest.fn();
const mockSetTraceDefaultEnabled = jest.fn();
const mockSetGuideMode = jest.fn();
const mockSetReduceIntentionVisibility = jest.fn();
const mockSetReduceMotion = jest.fn();
const mockSetAnalyticsEnabled = jest.fn();
const mockSetFocusSessionDuration = jest.fn();
const mockSetPrimeSessionDuration = jest.fn();
const mockSetVisualizeSessionDuration = jest.fn();
const mockSetLastSessionDuration = jest.fn();
const mockSetSessionAudioDefaults = jest.fn();
const mockSetWeeklySummaryEnabled = jest.fn();

const mockStartVoicePreview = jest.fn((_voice?: any) => Promise.resolve(true));
const mockStopVoicePreview = jest.fn();

const mockUpdateNotificationPreferences = jest.fn(() => Promise.resolve());
const mockToggleNotifications = jest.fn(() => Promise.resolve());

const mockSettings = {
  hapticFeedback: 'medium' as const,
  soundEffectsEnabled: true,
  openDailyAnchorAutomatically: false,
};

const mockSettingsStoreState = {
  traceDefaultEnabled: true,
  setTraceDefaultEnabled: mockSetTraceDefaultEnabled,
  guideMode: true,
  setGuideMode: mockSetGuideMode,
  reduceIntentionVisibility: false,
  setReduceIntentionVisibility: mockSetReduceIntentionVisibility,
  dailyPracticeGoal: 1,
  dailyPracticeGoalPreset: 'once',
  setDailyPracticeGoal: mockSetDailyPracticeGoal,
  setDailyPracticeGoalPreset: mockSetDailyPracticeGoalPreset,
  threadStrengthSensitivity: 'balanced',
  setThreadStrengthSensitivity: mockSetThreadStrengthSensitivity,
  focusSessionDuration: 30,
  setFocusSessionDuration: mockSetFocusSessionDuration,
  primeSessionDuration: 300,
  setPrimeSessionDuration: mockSetPrimeSessionDuration,
  visualizeSessionDuration: 180,
  setVisualizeSessionDuration: mockSetVisualizeSessionDuration,
  setLastSessionDuration: mockSetLastSessionDuration,
  sessionAudioDefaults: {
    focus: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
    deep_prime: { guidanceVoice: 'male', backgroundAudio: 'ambient' },
    visualize: { guidanceVoice: 'none', backgroundAudio: 'off' },
  },
  setSessionAudioDefaults: mockSetSessionAudioDefaults,
  reduceMotion: 'system' as const,
  setReduceMotion: mockSetReduceMotion,
  analyticsEnabled: true,
  setAnalyticsEnabled: mockSetAnalyticsEnabled,
  weeklySummaryEnabled: false,
  setWeeklySummaryEnabled: mockSetWeeklySummaryEnabled,
};

const mockNotifState = {
  notification_enabled: false,
  dailyPrimeTime: '21:00',
  dailyPrimeEnabled: true,
  personalDailyReminderOptedIn: true,
  threadStrengthAlertsEnabled: true,
  threadStrengthThreshold: 70,
  unfinishedAnchorRemindersEnabled: false,
  notificationTone: 'encouraging',
  weeklyRecapEnabled: false,
  notificationPermissionStatus: 'granted' as 'granted' | 'denied' | 'undetermined',
};

jest.mock('@/hooks/useSettings', () => ({
  useSettingsState: () => ({
    settings: mockSettings,
    updateSetting: mockUpdateSetting,
    isLoading: false,
  }),
}));

jest.mock('@/stores/settingsStore', () => {
  const hook = (selector?: (state: typeof mockSettingsStoreState) => unknown) =>
    selector ? selector(mockSettingsStoreState) : mockSettingsStoreState;
  (hook as any).getState = () => mockSettingsStoreState;
  return {
    useSettingsStore: hook,
  };
});

jest.mock('@/stores/profileStore', () => ({
  useProfileStore: () => ({
    timezone: 'America/Chicago',
    updateProfile: jest.fn(),
  }),
  TIMEZONE_OPTIONS: ['America/Chicago', 'America/New_York'],
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { isAuthenticated: boolean; user: { id: string } }) => unknown) =>
    selector ? selector({ isAuthenticated: true, user: { id: 'account-a' } }) : { isAuthenticated: true, user: { id: 'account-a' } },
}));

jest.mock('@/services/ApiClient', () => ({
  updateUserSettings: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/VoicePreviewService', () => ({
  getActivePreviewVoice: () => null,
  startVoicePreview: (voice: any) => mockStartVoicePreview(voice),
  stopVoicePreview: () => mockStopVoicePreview(),
  subscribeToVoicePreview: (cb: any) => {
    cb(null);
    return () => {};
  },
}));

jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    notifState: mockNotifState,
    toggleNotifications: mockToggleNotifications,
    updateNotificationPreferences: mockUpdateNotificationPreferences,
  }),
}));

jest.mock('@/services/NotificationService', () => ({
  __esModule: true,
  default: {
    requestPermissions: jest.fn(() => Promise.resolve(true)),
    getLastError: jest.fn(() => null),
  },
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn(), setEnabled: jest.fn() },
}));

describe('PracticeSubscreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('resets app tips for the current account and confirms using the existing toast', async () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);
    expect(screen.getByText('Show the quick tips again on every screen.')).toBeTruthy();
    fireEvent.press(screen.getByText('Replay app tips'));
    await waitFor(() => expect(mockTeachingReset).toHaveBeenCalledWith('account-a'));
    await waitFor(() => expect(mockToastInfo).toHaveBeenCalledWith('App tips reset.'));
    expect(mockSetGuideMode).not.toHaveBeenCalled();
  });

  it('renders session defaults, goal, thread behavior, and practice behavior rows', () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);

    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByText('Session defaults')).toBeTruthy();
    expect(screen.getByText('Daily practice goal')).toBeTruthy();
    expect(screen.getByText('Thread Strength behavior')).toBeTruthy();
    expect(screen.getByText('Guide Mode')).toBeTruthy();
    expect(screen.getByText('Hide Intention Text')).toBeTruthy();
    expect(screen.getByText('Anchor Tracing')).toBeTruthy();
    expect(screen.getByText('Timezone')).toBeTruthy();
  });

  it('navigates into Session Defaults and allows switching practice mode tabs with correct durations', () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByText('Session defaults'));
    expect(screen.getByText('Guidance Voice')).toBeTruthy();

    // Focus mode durations
    expect(screen.getByText('10 sec')).toBeTruthy();
    expect(screen.getByText('30 sec')).toBeTruthy();
    expect(screen.getByText('1 min')).toBeTruthy();

    fireEvent.press(screen.getByText('10 sec'));
    expect(mockSetFocusSessionDuration).toHaveBeenCalledWith(10);

    // Deep Prime mode durations
    fireEvent.press(screen.getByText('Deep Prime'));
    expect(screen.getByText('2 min')).toBeTruthy();
    expect(screen.getByText('5 min')).toBeTruthy();
    expect(screen.getByText('10 min')).toBeTruthy();

    fireEvent.press(screen.getByText('10 min'));
    expect(mockSetPrimeSessionDuration).toHaveBeenCalledWith(600);

    // Visualize mode durations
    fireEvent.press(screen.getByText('Visualize'));
    expect(screen.getByText('1 min')).toBeTruthy();
    expect(screen.getByText('3 min')).toBeTruthy();
    expect(screen.getByText('5 min')).toBeTruthy();

    fireEvent.press(screen.getByText('Save defaults'));
    expect(screen.getByText('Practice')).toBeTruthy();
  });

  it('handles guidance voice radio selection and preview correctly', () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);
    fireEvent.press(screen.getByText('Session defaults'));

    // Grounded selection
    fireEvent.press(screen.getByLabelText('Grounded. Steady, measured, reassuring'));
    expect(mockSetSessionAudioDefaults).toHaveBeenCalledWith('focus', expect.objectContaining({
      guidanceVoice: 'male',
    }));

    // No guidance selection
    fireEvent.press(screen.getByLabelText('No guidance. No spoken instruction'));
    expect(mockSetSessionAudioDefaults).toHaveBeenCalledWith('focus', expect.objectContaining({
      guidanceVoice: 'none',
    }));

    // Preview button plays without changing voice selection
    fireEvent.press(screen.getByLabelText('Preview Serene'));
    expect(mockStartVoicePreview).toHaveBeenCalledWith('female');
  });

  it('handles audio mode single-select (Ambient vs Silence)', () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);
    fireEvent.press(screen.getByText('Session defaults'));

    fireEvent.press(screen.getByText('Silence'));
    expect(mockSetSessionAudioDefaults).toHaveBeenCalledWith('focus', expect.objectContaining({
      backgroundAudio: 'off',
    }));

    fireEvent.press(screen.getByText('Ambient'));
    expect(mockSetSessionAudioDefaults).toHaveBeenCalledWith('focus', expect.objectContaining({
      backgroundAudio: 'ambient',
    }));
  });

  it('navigates into Daily Practice Goal and updates preset to once, three, five, or custom', () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByText('Daily practice goal'));
    expect(screen.getByText('Daily practice goal')).toBeTruthy();

    // Once shows recommended
    expect(screen.getByText('Recommended')).toBeTruthy();
    fireEvent.press(screen.getByText('Once'));
    expect(mockSetDailyPracticeGoalPreset).toHaveBeenCalledWith('once');
    expect(mockSetDailyPracticeGoal).toHaveBeenCalledWith(1);

    fireEvent.press(screen.getByText('Three'));
    expect(mockSetDailyPracticeGoalPreset).toHaveBeenCalledWith('three');
    expect(mockSetDailyPracticeGoal).toHaveBeenCalledWith(3);

    fireEvent.press(screen.getByText('Five'));
    expect(mockSetDailyPracticeGoalPreset).toHaveBeenCalledWith('five');
    expect(mockSetDailyPracticeGoal).toHaveBeenCalledWith(5);

    fireEvent.press(screen.getByText('Custom'));
    expect(mockSetDailyPracticeGoalPreset).toHaveBeenCalledWith('custom');

    fireEvent.press(screen.getByText('Save goal'));
    expect(screen.getByText('Practice')).toBeTruthy();
  });

  it('renders custom stepper and respects boundaries when custom is active', () => {
    mockSettingsStoreState.dailyPracticeGoalPreset = 'custom';
    mockSettingsStoreState.dailyPracticeGoal = 1;
    render(<PracticeSubscreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByText('Daily practice goal'));
    expect(screen.getByLabelText('Decrease custom goal').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByLabelText('Increase custom goal'));
    expect(mockSetDailyPracticeGoal).toHaveBeenCalledWith(2);

    mockSettingsStoreState.dailyPracticeGoalPreset = 'once';
  });

  it('navigates into Thread Strength and updates sensitivity', () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByText('Thread Strength behavior'));
    expect(screen.getByText('Thread Strength')).toBeTruthy();

    fireEvent.press(screen.getByText('Lenient'));
    expect(mockSetThreadStrengthSensitivity).toHaveBeenCalledWith('lenient');

    fireEvent.press(screen.getByText('Strict'));
    expect(mockSetThreadStrengthSensitivity).toHaveBeenCalledWith('strict');

    fireEvent.press(screen.getByText('Save'));
    expect(screen.getByText('Practice')).toBeTruthy();
  });

  it('toggles Guide Mode, Hide Intention Text, and Anchor Tracing', () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByTestId('settings-row-Guide Mode'));
    expect(mockSetGuideMode).toHaveBeenCalledWith(false);

    fireEvent.press(screen.getByTestId('settings-row-Hide Intention Text'));
    expect(mockSetReduceIntentionVisibility).toHaveBeenCalledWith(true);

    fireEvent.press(screen.getByTestId('settings-row-Anchor Tracing'));
    expect(mockSetTraceDefaultEnabled).toHaveBeenCalledWith(false);
  });
});

// NotificationsSubscreen cases migrated to screens/v2/notifications/__tests__/NotificationSettingsScreen.test.tsx

describe('AppExperienceSubscreen', () => {
  it('renders interface options and toggles openDailyAnchorAutomatically', () => {
    render(<AppExperienceSubscreen onBack={jest.fn()} />);

    expect(screen.getByText('App experience')).toBeTruthy();
    expect(screen.getByText('Haptic feedback')).toBeTruthy();
    expect(screen.getByText('Sound effects')).toBeTruthy();

    fireEvent.press(screen.getByTestId('settings-row-Open to Practice'));
    expect(mockUpdateSetting).toHaveBeenCalledWith('openDailyAnchorAutomatically', true);
  });
});

describe('PrivacySupportSubscreen', () => {
  it('renders privacy, support, and legal sections and toggles analytics', () => {
    render(<PrivacySupportSubscreen onBack={jest.fn()} />);

    expect(screen.getByText('Privacy & support')).toBeTruthy();
    expect(screen.getByText('Help & support')).toBeTruthy();
    expect(screen.getByText('Privacy policy')).toBeTruthy();

    fireEvent.press(screen.getByTestId('settings-row-Analytics'));
    expect(mockSetAnalyticsEnabled).toHaveBeenCalledWith(false);
  });
});
