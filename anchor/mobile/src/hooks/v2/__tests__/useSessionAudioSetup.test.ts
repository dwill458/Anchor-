import { act, renderHook } from '@testing-library/react-native';
import { useSessionAudioSetup } from '../useSessionAudioSetup';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { DEFAULT_SESSION_AUDIO_DEFAULTS } from '@/types/sessionAudio';

jest.mock('@/services/ApiClient', () => ({
  updateUserSettings: jest.fn().mockResolvedValue({ updatedAt: new Date().toISOString() }),
}));
jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));

const reset = (patch?: Partial<ReturnType<typeof useSettingsStore.getState>['sessionAudioDefaults']>) =>
  useSettingsStore.setState({
    sessionAudioDefaults: { ...DEFAULT_SESSION_AUDIO_DEFAULTS, ...patch },
    hapticIntensity: 70,
  });

describe('useSessionAudioSetup', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null } as never);
    reset();
  });

  it('seeds from the saved default for that session type', () => {
    reset({ deep_prime: { guidanceVoice: 'male', backgroundAudio: 'off' } });
    const { result } = renderHook(() => useSessionAudioSetup('deep_prime'));
    expect(result.current.voice).toBe('male');
    expect(result.current.ambient).toBe(false);
    expect(result.current.summary).toBe('Grounded · Silence');
  });

  it('a session override does not touch the saved defaults', () => {
    const { result } = renderHook(() => useSessionAudioSetup('focus'));
    act(() => result.current.apply({ guidanceVoice: 'male', backgroundAudio: 'off' }, false));
    expect(result.current.voice).toBe('male');
    expect(useSettingsStore.getState().sessionAudioDefaults).toEqual(DEFAULT_SESSION_AUDIO_DEFAULTS);
  });

  it('"Make this my default" writes one shared default for all three sessions', () => {
    const { result } = renderHook(() => useSessionAudioSetup('focus'));
    act(() => result.current.apply({ guidanceVoice: 'male', backgroundAudio: 'off' }, true));
    const saved = useSettingsStore.getState().sessionAudioDefaults;
    for (const type of ['focus', 'deep_prime', 'visualize'] as const) {
      expect(saved[type]).toEqual({ guidanceVoice: 'male', backgroundAudio: 'off' });
    }
    const other = renderHook(() => useSessionAudioSetup('visualize'));
    expect(other.result.current.voice).toBe('male');
  });

  it('sound toggle is session-only and independent of haptics', () => {
    const { result } = renderHook(() => useSessionAudioSetup('focus'));
    act(() => result.current.toggleSound());
    expect(result.current.soundOn).toBe(false);
    expect(result.current.voice).toBe('none');
    expect(result.current.ambient).toBe(false);
    expect(result.current.hapticsOn).toBe(true);
    act(() => result.current.toggleHaptics());
    expect(result.current.hapticsOn).toBe(false);
    act(() => result.current.toggleSound());
    expect(result.current.soundOn).toBe(true);
    expect(result.current.voice).toBe('female');
    expect(useSettingsStore.getState().hapticIntensity).toBe(70);
    expect(useSettingsStore.getState().sessionAudioDefaults).toEqual(DEFAULT_SESSION_AUDIO_DEFAULTS);
  });

  it('turning sound on from a silent default restores the product default', () => {
    reset({ visualize: { guidanceVoice: 'none', backgroundAudio: 'off' } });
    const { result } = renderHook(() => useSessionAudioSetup('visualize'));
    expect(result.current.soundOn).toBe(false);
    act(() => result.current.toggleSound());
    expect(result.current.soundOn).toBe(true);
    expect(result.current.voice).toBe(DEFAULT_SESSION_AUDIO_DEFAULTS.visualize.guidanceVoice);
  });

  it('selecting a voice while sound is off turns sound on', () => {
    const { result } = renderHook(() => useSessionAudioSetup('focus'));
    act(() => result.current.toggleSound());
    act(() => result.current.apply({ guidanceVoice: 'male', backgroundAudio: 'ambient' }, false));
    expect(result.current.soundOn).toBe(true);
    expect(result.current.voice).toBe('male');
  });
});
