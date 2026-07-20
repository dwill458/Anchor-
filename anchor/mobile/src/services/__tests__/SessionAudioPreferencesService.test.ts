import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { DEFAULT_SESSION_AUDIO_DEFAULTS } from '@/types/sessionAudio';

const mockUpdateUserSettings = jest.fn();

jest.mock('@/services/ApiClient', () => ({
  updateUserSettings: (...args: unknown[]) => mockUpdateUserSettings(...args),
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
}));

import {
  __resetSessionAudioPreferencesSyncForTests,
  persistSessionAudioDefaults,
} from '../SessionAudioPreferencesService';

describe('SessionAudioPreferencesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetSessionAudioPreferencesSyncForTests();
    useAuthStore.setState({ user: null, isAuthenticated: false } as any);
    useSettingsStore.setState({
      sessionAudioDefaults: {
        focus: { ...DEFAULT_SESSION_AUDIO_DEFAULTS.focus },
        deep_prime: { ...DEFAULT_SESSION_AUDIO_DEFAULTS.deep_prime },
        visualize: { ...DEFAULT_SESSION_AUDIO_DEFAULTS.visualize },
      },
      sessionAudioDefaultsOwnerUserId: null,
      sessionAudioDefaultsOwnerInitialized: false,
      sessionAudioDefaultsUpdatedAt: null,
    });
  });

  it('persists guest defaults locally without calling the account API', async () => {
    await persistSessionAudioDefaults('focus', {
      guidanceVoice: 'none',
      backgroundAudio: 'ambient',
    });
    expect(useSettingsStore.getState().sessionAudioDefaults.focus).toEqual({
      guidanceVoice: 'none',
      backgroundAudio: 'ambient',
    });
    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
  });

  it('syncs an authenticated default as a validated structured map', async () => {
    useAuthStore.setState({
      user: { id: 'user-a' },
      isAuthenticated: true,
    } as any);
    mockUpdateUserSettings.mockImplementation(async ({ sessionAudioDefaults }) => ({
      sessionAudioDefaults,
      updatedAt: new Date(Date.now() + 1_000),
    }));

    await persistSessionAudioDefaults('deep_prime', {
      guidanceVoice: 'female',
      backgroundAudio: 'off',
    });

    expect(mockUpdateUserSettings).toHaveBeenCalledWith({
      sessionAudioDefaults: {
        focus: DEFAULT_SESSION_AUDIO_DEFAULTS.focus,
        deep_prime: { guidanceVoice: 'female', backgroundAudio: 'off' },
        visualize: DEFAULT_SESSION_AUDIO_DEFAULTS.visualize,
      },
    });
    expect(useSettingsStore.getState().sessionAudioDefaultsOwnerUserId).toBe('user-a');
  });

  it('keeps an offline edit locally when account sync fails', async () => {
    useAuthStore.setState({
      user: { id: 'user-a' },
      isAuthenticated: true,
    } as any);
    mockUpdateUserSettings.mockRejectedValue(new Error('offline'));

    await expect(
      persistSessionAudioDefaults('focus', {
        guidanceVoice: 'none',
        backgroundAudio: 'off',
      })
    ).rejects.toThrow('offline');
    expect(useSettingsStore.getState().sessionAudioDefaults.focus).toEqual({
      guidanceVoice: 'none',
      backgroundAudio: 'off',
    });
  });
});
