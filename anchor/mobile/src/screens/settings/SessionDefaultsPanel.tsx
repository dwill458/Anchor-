import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  GroupLabel,
  PlayGlyph,
  RadioRow,
  RoundIconButton,
  Segmented,
  SettingsGroup,
  SettingsNote,
  SettingsScreenFrame,
  StopGlyph,
  TextAction,
  cardTheme,
} from '@/components/settings/SettingsCards';
import { updateUserSettings } from '@/services/ApiClient';
import {
  getActivePreviewVoice,
  startVoicePreview,
  stopVoicePreview,
  subscribeToVoicePreview,
} from '@/services/VoicePreviewService';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  DEFAULT_SESSION_AUDIO_DEFAULTS,
  GUIDANCE_VOICE_LABELS,
  type BackgroundAudioMode,
  type GuidanceVoice,
  type SessionAudioSessionType,
} from '@/types/sessionAudio';
import { logger } from '@/utils/logger';

interface Props {
  onBack: () => void;
}

interface ModeConfig {
  id: SessionAudioSessionType;
  name: string;
  durations: ReadonlyArray<{ label: string; value: number }>;
  originalDuration: number;
}

export const SESSION_MODES: ReadonlyArray<ModeConfig> = [
  {
    id: 'focus',
    name: 'Focus',
    durations: [
      { label: '10 sec', value: 10 },
      { label: '30 sec', value: 30 },
      { label: '1 min', value: 60 },
    ],
    originalDuration: 30,
  },
  {
    id: 'deep_prime',
    name: 'Deep Focus',
    durations: [
      { label: '2 min', value: 120 },
      { label: '5 min', value: 300 },
      { label: '10 min', value: 600 },
    ],
    originalDuration: 120,
  },
  {
    id: 'visualize',
    name: 'Visualize',
    durations: [
      { label: '1 min', value: 60 },
      { label: '3 min', value: 180 },
      { label: '10 min', value: 600 },
    ],
    originalDuration: 180,
  },
];

const VOICES: Array<{ id: GuidanceVoice; description: string; preview: boolean }> = [
  { id: 'male', description: 'Steady and measured', preview: true },
  { id: 'female', description: 'Gentle and reflective', preview: true },
  { id: 'warm', description: 'Friendly, like a guide beside you', preview: true },
  { id: 'soothing', description: 'Slow and softly paced', preview: true },
  { id: 'none', description: 'No spoken instruction', preview: false },
];

/** Visualize only ships recordings for these voices. */
const VISUALIZE_VOICES: ReadonlySet<GuidanceVoice> = new Set(['male', 'female', 'none']);

const AUDIO_OPTIONS: Array<{ label: string; value: BackgroundAudioMode }> = [
  { label: 'Ambient', value: 'ambient' },
  { label: 'Silence', value: 'off' },
];

export const SessionDefaultsPanel: React.FC<Props> = ({ onBack }) => {
  const [modeId, setModeId] = useState<SessionAudioSessionType>('focus');
  const [previewVoice, setPreviewVoice] = useState<string | null>(getActivePreviewVoice());
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const focusDuration = useSettingsStore((s) => s.focusSessionDuration ?? 30);
  const setFocusDuration = useSettingsStore((s) => s.setFocusSessionDuration);
  const primeDuration = useSettingsStore((s) => s.primeSessionDuration ?? 120);
  const setPrimeDuration = useSettingsStore((s) => s.setPrimeSessionDuration);
  const visualizeDuration = useSettingsStore((s) => s.visualizeSessionDuration ?? 180);
  const setVisualizeDuration = useSettingsStore((s) => s.setVisualizeSessionDuration);
  const setLastSessionDuration = useSettingsStore((s) => s.setLastSessionDuration);
  const sessionAudioDefaults = useSettingsStore(
    (s) => s.sessionAudioDefaults ?? DEFAULT_SESSION_AUDIO_DEFAULTS
  );
  const setSessionAudioDefaults = useSettingsStore((s) => s.setSessionAudioDefaults);

  const mode = SESSION_MODES.find((m) => m.id === modeId) ?? SESSION_MODES[0];
  const audio = sessionAudioDefaults[modeId] ?? DEFAULT_SESSION_AUDIO_DEFAULTS[modeId];
  const rawDuration =
    modeId === 'focus' ? focusDuration : modeId === 'deep_prime' ? primeDuration : visualizeDuration;
  const duration = mode.durations.some((d) => d.value === rawDuration)
    ? rawDuration
    : mode.originalDuration;
  const voices = modeId === 'visualize' ? VOICES.filter((v) => VISUALIZE_VOICES.has(v.id)) : VOICES;

  useEffect(() => {
    const unsubscribe = subscribeToVoicePreview(setPreviewVoice);
    return () => {
      unsubscribe();
      stopVoicePreview();
    };
  }, []);

  // Changes are written to the store immediately; the account copy follows shortly after, and
  // once more when the screen closes so nothing is lost.
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const syncRemote = useCallback(() => {
    if (!dirty.current || !isAuthenticated) return;
    dirty.current = false;
    const state = useSettingsStore.getState();
    void updateUserSettings({
      focusSessionDuration: state.focusSessionDuration,
      primeSessionDuration: state.primeSessionDuration,
      visualizeSessionDuration: state.visualizeSessionDuration,
      sessionAudioDefaults: state.sessionAudioDefaults,
    }).catch((error) => {
      logger.warn('[SessionDefaultsPanel] Failed to sync session defaults remotely', error);
    });
  }, [isAuthenticated]);

  const markChanged = useCallback(() => {
    dirty.current = true;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(syncRemote, 800);
  }, [syncRemote]);

  useEffect(
    () => () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncRemote();
    },
    [syncRemote]
  );

  const writeDuration = (type: SessionAudioSessionType, value: number) => {
    if (type === 'focus') {
      setFocusDuration(value);
      setLastSessionDuration?.('focus', value);
    } else if (type === 'deep_prime') {
      setPrimeDuration(value);
      setLastSessionDuration?.('deep_prime', value);
    } else {
      setVisualizeDuration(value as 60 | 180 | 600);
      setLastSessionDuration?.('visualize', value as 60 | 180 | 600);
    }
  };

  const handleDuration = (value: number) => {
    writeDuration(modeId, value);
    markChanged();
  };

  const handleVoice = (voice: GuidanceVoice) => {
    setSessionAudioDefaults(modeId, { ...audio, guidanceVoice: voice });
    markChanged();
  };

  const handleBackground = (backgroundAudio: BackgroundAudioMode) => {
    setSessionAudioDefaults(modeId, { ...audio, backgroundAudio });
    markChanged();
  };

  const handlePreview = async (voice: Exclude<GuidanceVoice, 'none'>) => {
    if (previewVoice === voice) {
      stopVoicePreview();
      return;
    }
    await startVoicePreview(voice);
  };

  const handleReset = () => {
    stopVoicePreview();
    writeDuration(modeId, mode.originalDuration);
    setSessionAudioDefaults(modeId, { ...DEFAULT_SESSION_AUDIO_DEFAULTS[modeId] });
    markChanged();
  };

  return (
    <SettingsScreenFrame title="Session defaults" onBack={onBack} testID="session-defaults-screen">
      <Segmented
        options={SESSION_MODES.map((m) => ({ label: m.name, value: m.id }))}
        value={modeId}
        onChange={(next) => {
          stopVoicePreview();
          setModeId(next);
        }}
        label="Practice mode"
        role="tab"
        testIDPrefix="session-defaults-mode"
      />
      <SettingsNote style={styles.modeNote}>
        <>
          {"You're editing defaults for "}
          <Text style={styles.modeNoteStrong}>{mode.name}</Text>
          {'. Each mode keeps its own.'}
        </>
      </SettingsNote>

      <GroupLabel>Duration</GroupLabel>
      <Segmented
        options={mode.durations}
        value={duration}
        onChange={handleDuration}
        label="Duration"
        testIDPrefix="session-defaults-duration"
      />

      <GroupLabel>Guidance voice</GroupLabel>
      <SettingsGroup accessibilityRole="radiogroup" accessibilityLabel="Guidance voice">
        {voices.map((voice) => {
          const label = GUIDANCE_VOICE_LABELS[voice.id];
          const playing = previewVoice === voice.id;
          return (
            <RadioRow
              key={voice.id}
              title={label}
              subtitle={voice.description}
              selected={audio.guidanceVoice === voice.id}
              onPress={() => handleVoice(voice.id)}
              testID={`session-defaults-voice-${voice.id}`}
              trailing={
                voice.preview ? (
                  <RoundIconButton
                    label={playing ? `Stop ${label} preview` : `Preview ${label}`}
                    active={playing}
                    onPress={() => void handlePreview(voice.id as Exclude<GuidanceVoice, 'none'>)}
                    testID={`session-defaults-preview-${voice.id}`}
                  >
                    {playing ? <StopGlyph /> : <PlayGlyph />}
                  </RoundIconButton>
                ) : undefined
              }
            />
          );
        })}
      </SettingsGroup>

      <GroupLabel>Background audio</GroupLabel>
      <Segmented
        options={AUDIO_OPTIONS}
        value={audio.backgroundAudio}
        onChange={handleBackground}
        label="Background audio"
        testIDPrefix="session-defaults-audio"
      />

      <SettingsNote style={styles.footer}>Changes save automatically.</SettingsNote>
      <TextAction
        label={`Reset ${mode.name} to original defaults`}
        onPress={handleReset}
        testID="session-defaults-reset"
      />
    </SettingsScreenFrame>
  );
};

const styles = StyleSheet.create({
  modeNote: { marginTop: 0 },
  modeNoteStrong: { color: cardTheme.ink, fontWeight: '700' },
  footer: { alignItems: 'center', marginTop: 24 },
});
