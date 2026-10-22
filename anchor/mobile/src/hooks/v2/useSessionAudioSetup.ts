import { useCallback, useMemo, useState } from 'react';
import { persistGlobalSessionAudioDefaults } from '@/services/SessionAudioPreferencesService';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  DEFAULT_SESSION_AUDIO_DEFAULTS,
  formatSessionAudioSummary,
  isSessionAudioSilent,
  type GuidanceVoice,
  type SessionAudioDefaults,
  type SessionAudioSessionType,
} from '@/types/sessionAudio';

export interface SessionAudioSetupOptions {
  initialVoice?: GuidanceVoice;
  initialAmbient?: boolean;
}

/**
 * Per-session Sound + Haptics state for a Practice setup screen.
 *
 * The global default (`sessionAudioDefaults` in the settings store) only seeds
 * the initial choice. Everything changed here is session-only until the person
 * applies the sheet with "Make this my default", which is the one path that
 * writes back to the store.
 */
export function useSessionAudioSetup(
  sessionType: SessionAudioSessionType,
  { initialVoice, initialAmbient }: SessionAudioSetupOptions = {},
) {
  const saved = useSettingsStore((state) => state.sessionAudioDefaults?.[sessionType]);
  const hapticIntensity = useSettingsStore((state) => state.hapticIntensity);
  const fallback = DEFAULT_SESSION_AUDIO_DEFAULTS[sessionType];
  const defaults: SessionAudioDefaults = saved ?? fallback;

  const [config, setConfig] = useState<SessionAudioDefaults>(() => ({
    guidanceVoice: initialVoice ?? defaults.guidanceVoice,
    backgroundAudio:
      initialAmbient === undefined ? defaults.backgroundAudio : initialAmbient ? 'ambient' : 'off',
  }));
  const [soundEnabled, setSoundEnabled] = useState(() => !isSessionAudioSilent(config));
  const [hapticsOn, setHapticsOn] = useState(() => (hapticIntensity ?? 70) > 0);

  const soundOn = soundEnabled && !isSessionAudioSilent(config);

  const effective = useMemo<SessionAudioDefaults>(
    () => (soundOn ? config : { guidanceVoice: 'none', backgroundAudio: 'off' }),
    [config, soundOn],
  );

  const toggleSound = useCallback(() => {
    if (soundOn) {
      setSoundEnabled(false);
      return;
    }
    // Turning sound back on from a fully silent choice restores the saved
    // default, or the product default when that is silent too.
    if (isSessionAudioSilent(config)) {
      setConfig(isSessionAudioSilent(defaults) ? fallback : defaults);
    }
    setSoundEnabled(true);
  }, [config, defaults, fallback, soundOn]);

  const toggleHaptics = useCallback(() => setHapticsOn((previous) => !previous), []);

  const apply = useCallback((next: SessionAudioDefaults, makeDefault: boolean) => {
    setConfig(next);
    setSoundEnabled(!isSessionAudioSilent(next));
    if (makeDefault) {
      void persistGlobalSessionAudioDefaults(next);
    }
  }, []);

  return {
    config,
    voice: effective.guidanceVoice,
    ambient: effective.backgroundAudio === 'ambient',
    soundOn,
    summary: formatSessionAudioSummary(config),
    hapticsOn,
    toggleSound,
    toggleHaptics,
    apply,
  };
}
