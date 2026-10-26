import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PracticeSubscreen } from '../PracticeSubscreen';
import { SoundFeelSubscreen } from '../SoundFeelSubscreen';
import { useTeachingStore } from '@/stores/teachingStore';
import { HelpAboutSubscreen } from '../HelpAboutSubscreen';
import { DataPrivacySubscreen } from '../DataPrivacySubscreen';

const mockTeachingReset = jest.fn(async (_accountId: string | null) => undefined);
const mockToastInfo = jest.fn();
jest.mock('@/hooks/v2/guidance/guidanceRuntime', () => ({ replayGuidance: (accountId: string) => mockTeachingReset(accountId) }));
jest.mock('@/components/ToastProvider', () => ({ useToast: () => ({ info: mockToastInfo }) }));
const mockSetDailyPracticeGoal = jest.fn();
const mockSetDailyPracticeGoalPreset = jest.fn();
const mockSetThreadStrengthSensitivity = jest.fn();
const mockSetTraceDefaultEnabled = jest.fn();
const mockSetGuideMode = jest.fn();
const mockSetReduceIntentionVisibility = jest.fn();
const mockSetOpenDailyAnchorAutomatically = jest.fn();
const mockSetReduceMotion = jest.fn();
const mockSetHapticIntensity = jest.fn();
const mockSetSoundEffectsEnabled = jest.fn();
const mockSetAnalyticsEnabled = jest.fn();
const mockSetFocusSessionDuration = jest.fn();
const mockSetPrimeSessionDuration = jest.fn();
const mockSetVisualizeSessionDuration = jest.fn();
const mockSetLastSessionDuration = jest.fn();
const mockSetSessionAudioDefaults = jest.fn();
const mockApiPut = jest.fn(() => Promise.resolve({}));

const mockStartVoicePreview = jest.fn((_voice?: any) => Promise.resolve(true));
const mockStopVoicePreview = jest.fn();

const mockSettingsStoreState = {
  traceDefaultEnabled: true,
  setTraceDefaultEnabled: mockSetTraceDefaultEnabled,
  showTips: true,
  setShowTips: mockSetGuideMode,
  reduceIntentionVisibility: false,
  setReduceIntentionVisibility: mockSetReduceIntentionVisibility,
  openDailyAnchorAutomatically: false,
  setOpenDailyAnchorAutomatically: mockSetOpenDailyAnchorAutomatically,
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
  hapticIntensity: 55,
  setHapticIntensity: mockSetHapticIntensity,
  soundEffectsEnabled: true,
  setSoundEffectsEnabled: mockSetSoundEffectsEnabled,
  reduceMotion: 'system' as const,
  setReduceMotion: mockSetReduceMotion,
  analyticsEnabled: true,
  setAnalyticsEnabled: mockSetAnalyticsEnabled,
};

jest.mock('@/stores/settingsStore', () => {
  const hook = (selector?: (state: typeof mockSettingsStoreState) => unknown) =>
    selector ? selector(mockSettingsStoreState) : mockSettingsStoreState;
  (hook as any).getState = () => mockSettingsStoreState;
  return {
    useSettingsStore: hook,
  };
});

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { isAuthenticated: boolean; user: { id: string } }) => unknown) =>
    selector ? selector({ isAuthenticated: true, user: { id: 'account-a' } }) : { isAuthenticated: true, user: { id: 'account-a' } },
}));

jest.mock('@/services/ApiClient', () => ({
  updateUserSettings: jest.fn(() => Promise.resolve({})),
  apiClient: { put: (...args: unknown[]) => (mockApiPut as any)(...args), get: jest.fn() },
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

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn(), setEnabled: jest.fn() },
  AnalyticsEvents: {},
}));

jest.mock('@/services/AuthService', () => ({
  AuthService: { deleteAccount: jest.fn(() => Promise.resolve()) },
}));

jest.mock('@/services/reviewPromptService', () => ({ openStoreListing: jest.fn(() => Promise.resolve()) }));

describe('PracticeSubscreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsStoreState.dailyPracticeGoal = 1;
  });

  it('renders goal, thread, session defaults, practice behavior and launch rows', () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);

    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByText('Daily goal')).toBeTruthy();
    expect(screen.getByText('Thread Strength')).toBeTruthy();
    expect(screen.getByText('What happens when you miss a day')).toBeTruthy();
    expect(screen.getByText('Session defaults')).toBeTruthy();
    expect(screen.getByText('Show tips')).toBeTruthy();
    expect(screen.getByText('Hide intention text')).toBeTruthy();
    expect(screen.getByText('Anchor tracing')).toBeTruthy();
    expect(screen.getByText('Open to Practice')).toBeTruthy();
  });

  it('keeps settings that now live elsewhere out of Practice', () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);

    expect(screen.queryByText('Timezone')).toBeNull();
    expect(screen.queryByText('Replay app tips')).toBeNull();
  });

  it('steps the daily goal with plus and minus and respects the lower bound', () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);

    expect(screen.getByLabelText('Decrease daily goal').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText('Increase daily goal'));
    expect(mockSetDailyPracticeGoal).toHaveBeenCalledWith(2);
    expect(mockSetDailyPracticeGoalPreset).toHaveBeenCalledWith('custom');
  });

  it('maps the stepper onto the existing once, three and five presets', () => {
    mockSettingsStoreState.dailyPracticeGoal = 2;
    render(<PracticeSubscreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Increase daily goal'));
    expect(mockSetDailyPracticeGoal).toHaveBeenCalledWith(3);
    expect(mockSetDailyPracticeGoalPreset).toHaveBeenCalledWith('three');
  });

  it('opens Thread Strength and saves as soon as a behavior is chosen', () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByText('Thread Strength'));
    expect(screen.getByText('Saved as soon as you choose.')).toBeTruthy();
    expect(screen.getByText('Missed, thread holds')).toBeTruthy();
    expect(screen.getByText('Thread softens')).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();

    fireEvent.press(screen.getByLabelText('Lenient'));
    expect(mockSetThreadStrengthSensitivity).toHaveBeenCalledWith('lenient');
    expect(mockApiPut).toHaveBeenCalledWith('/api/auth/settings', { threadStrengthSensitivity: 'lenient' });

    fireEvent.press(screen.getByLabelText('Strict'));
    expect(mockSetThreadStrengthSensitivity).toHaveBeenCalledWith('strict');
  });

  it('toggles Show tips, Hide intention text, Anchor tracing and Open to Practice', () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Show tips'));
    expect(mockSetGuideMode).toHaveBeenCalledWith(false);

    fireEvent.press(screen.getByLabelText('Hide intention text'));
    expect(mockSetReduceIntentionVisibility).toHaveBeenCalledWith(true);

    fireEvent.press(screen.getByLabelText('Anchor tracing'));
    expect(mockSetTraceDefaultEnabled).toHaveBeenCalledWith(false);

    fireEvent.press(screen.getByLabelText('Open to Practice'));
    expect(mockSetOpenDailyAnchorAutomatically).toHaveBeenCalledWith(true);
  });
});

describe('Session defaults', () => {
  const openSessionDefaults = () => {
    render(<PracticeSubscreen onBack={jest.fn()} />);
    fireEvent.press(screen.getByText('Session defaults'));
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('autosaves: no save button, with a per-mode reset', () => {
    openSessionDefaults();

    expect(screen.getByText('Changes save automatically.')).toBeTruthy();
    expect(screen.getByText('Reset Focus to original defaults')).toBeTruthy();
    expect(screen.queryByText('Save defaults')).toBeNull();
    expect(screen.getByText('Each mode keeps its own.', { exact: false })).toBeTruthy();
  });

  it('switches mode tabs and writes the matching duration setter immediately', () => {
    openSessionDefaults();

    fireEvent.press(screen.getByLabelText('10 sec'));
    expect(mockSetFocusSessionDuration).toHaveBeenCalledWith(10);

    fireEvent.press(screen.getByLabelText('Deep Focus'));
    expect(screen.getByText('Reset Deep Focus to original defaults')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('10 min'));
    expect(mockSetPrimeSessionDuration).toHaveBeenCalledWith(600);

    fireEvent.press(screen.getByLabelText('Visualize'));
    expect(screen.getByLabelText('3 min')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('1 min'));
    expect(mockSetVisualizeSessionDuration).toHaveBeenCalledWith(60);
  });

  it('writes voice choices to the active mode only and previews without selecting', () => {
    openSessionDefaults();

    fireEvent.press(screen.getByLabelText('Grounded'));
    expect(mockSetSessionAudioDefaults).toHaveBeenCalledTimes(1);
    expect(mockSetSessionAudioDefaults).toHaveBeenCalledWith(
      'focus',
      expect.objectContaining({ guidanceVoice: 'male' })
    );

    fireEvent.press(screen.getByLabelText('No guidance'));
    expect(mockSetSessionAudioDefaults).toHaveBeenLastCalledWith(
      'focus',
      expect.objectContaining({ guidanceVoice: 'none' })
    );

    mockSetSessionAudioDefaults.mockClear();
    fireEvent.press(screen.getByLabelText('Preview Serene'));
    expect(mockStartVoicePreview).toHaveBeenCalledWith('female');
    expect(mockSetSessionAudioDefaults).not.toHaveBeenCalled();
  });

  it('shows the plain voice descriptions and hides voices Visualize does not ship', () => {
    openSessionDefaults();
    expect(screen.getByText('Friendly, like a guide beside you')).toBeTruthy();
    expect(screen.getByText('Slow and softly paced')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Visualize'));
    expect(screen.queryByText('Slow and softly paced')).toBeNull();
    expect(screen.getByText('Steady and measured')).toBeTruthy();
  });

  it('sets background audio to Silence or Ambient', () => {
    openSessionDefaults();

    fireEvent.press(screen.getByLabelText('Silence'));
    expect(mockSetSessionAudioDefaults).toHaveBeenCalledWith(
      'focus',
      expect.objectContaining({ backgroundAudio: 'off' })
    );

    fireEvent.press(screen.getByLabelText('Ambient'));
    expect(mockSetSessionAudioDefaults).toHaveBeenCalledWith(
      'focus',
      expect.objectContaining({ backgroundAudio: 'ambient' })
    );
  });

  it('resets the active mode to its original duration and audio', () => {
    openSessionDefaults();

    fireEvent.press(screen.getByText('Reset Focus to original defaults'));
    expect(mockSetFocusSessionDuration).toHaveBeenCalledWith(30);
    expect(mockSetSessionAudioDefaults).toHaveBeenCalledWith(
      'focus',
      expect.objectContaining({ guidanceVoice: 'female', backgroundAudio: 'ambient' })
    );
  });
});

describe('SoundFeelSubscreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows haptics, sound and motion groups with plain labels', () => {
    render(<SoundFeelSubscreen onBack={jest.fn()} />);

    expect(screen.getByText('Sound & feel')).toBeTruthy();
    expect(screen.getByText('Haptics')).toBeTruthy();
    expect(screen.getByText('Balanced tactile feedback.')).toBeTruthy();
    expect(screen.getByLabelText('Match device')).toBeTruthy();
    expect(screen.queryByText('Device setting')).toBeNull();
  });

  it('writes haptics, sound effects and motion straight to the store', () => {
    render(<SoundFeelSubscreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Strong'));
    expect(mockSetHapticIntensity).toHaveBeenCalledWith(80);

    fireEvent.press(screen.getByLabelText('Sound effects'));
    expect(mockSetSoundEffectsEnabled).toHaveBeenCalledWith(false);

    fireEvent.press(screen.getByLabelText('Full'));
    expect(mockSetReduceMotion).toHaveBeenCalledWith('off');
  });
});

describe('HelpAboutSubscreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('groups support, app tips, rating and legal', () => {
    render(<HelpAboutSubscreen onBack={jest.fn()} />);

    expect(screen.getByText('Help & about')).toBeTruthy();
    expect(screen.getByText('Contact support')).toBeTruthy();
    expect(screen.getByText('Replay app tips')).toBeTruthy();
    expect(screen.getByText('Rate Anchor')).toBeTruthy();
    expect(screen.getByText('Privacy policy')).toBeTruthy();
    expect(screen.getByText('Terms of service')).toBeTruthy();
  });

  it('replays app tips for the current account after confirming, and confirms with the existing toast', async () => {
    useTeachingStore.getState().setUserFlag('hasSeenFirstAnchorArrival', true);
    useTeachingStore.getState().setUserFlag('hasSeenFirstPracticeScene', true);
    render(<HelpAboutSubscreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByTestId('settings-row-Replay app tips'));
    fireEvent.press(screen.getByLabelText('Replay'));

    await waitFor(() => expect(mockTeachingReset).toHaveBeenCalledWith('account-a'));
    await waitFor(() => expect(mockToastInfo).toHaveBeenCalledWith('App tips reset.'));
    expect(mockSetGuideMode).not.toHaveBeenCalled();
    expect(useTeachingStore.getState().userFlags.hasSeenFirstAnchorArrival).toBe(true);
    expect(useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene).toBe(true);
  });
});

describe('DataPrivacySubscreen', () => {
  it('toggles anonymous analytics and offers backup, export and delete', () => {
    render(
      <DataPrivacySubscreen onBack={jest.fn()} onOpenBackup={jest.fn()} onResetToOnboarding={jest.fn()} />
    );

    expect(screen.getByText('Data & privacy')).toBeTruthy();
    expect(screen.getByText('Backup & recovery')).toBeTruthy();
    expect(screen.getByText('Export my data')).toBeTruthy();
    expect(screen.getByText('Delete account')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Share anonymous analytics'));
    expect(mockSetAnalyticsEnabled).toHaveBeenCalledWith(false);
  });

  it('opens Backup & recovery from the Your data group', () => {
    const onOpenBackup = jest.fn();
    render(
      <DataPrivacySubscreen onBack={jest.fn()} onOpenBackup={onOpenBackup} onResetToOnboarding={jest.fn()} />
    );

    fireEvent.press(screen.getByTestId('settings-row-Backup & recovery'));
    expect(onOpenBackup).toHaveBeenCalled();
  });
});
