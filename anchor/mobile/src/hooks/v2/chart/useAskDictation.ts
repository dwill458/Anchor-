import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { safeHaptics } from '@/utils/haptics';
import { speechModule, useSpeechEvent } from '@/hooks/v2/vision/speechRecognition';
import {
  ASK_DICTATION_DISCLOSURE_KEY,
  MAX_RECORDING_MS,
  WAVEFORM_BARS,
  askDictationDisclosure,
  askDictationFailure,
  composeDictated,
  createTranscript,
  levelFromVolume,
  pushLevel,
  resolveDictationEnd,
} from './askChartDictation';

export type AskDictationState = 'idle' | 'starting' | 'listening' | 'finishing';

type Options = {
  /** The composer's text when recording starts: spoken words are added after it, never over it. */
  getText: () => string;
  /** Receives the composer's new text once, when recording ends. It never sends anything. */
  onText: (text: string) => void;
  maxChars: number;
};

/**
 * Voice input for the Ask Chart composer: tap to record, then finish (the words land in the composer to edit) or
 * cancel (nothing is kept). The microphone is released on finish, cancel, a failure, when the app leaves the
 * foreground and when the screen goes away. Words that were heard are never lost to an interruption.
 */
export function useAskDictation({ getText, onText, maxChars }: Options) {
  const [state, setState] = useState<AskDictationState>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [volumeSupported, setVolumeSupported] = useState<boolean | null>(null);
  const levels = useSharedValue<number[]>(Array(WAVEFORM_BARS).fill(0)) as SharedValue<number[]>;
  const transcript = useRef(createTranscript());
  const base = useRef('');
  const intent = useRef<'finish' | 'cancel' | 'interrupted' | null>(null);
  const active = useRef(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const startedAt = useRef(0);
  const sawVolume = useRef(false);

  /** Offered only when this device can actually recognise speech: never a control that cannot work. */
  const available = useMemo(() => {
    try {
      return Boolean(speechModule?.isRecognitionAvailable());
    } catch {
      return false;
    }
  }, []);

  const release = useCallback((abort: boolean) => {
    active.current = false;
    if (abort) {
      try { speechModule?.abort(); } catch { /* nothing was running */ }
    }
  }, []);

  const finishRecording = useCallback(() => {
    const outcome = resolveDictationEnd(intent.current, transcript.current.text());
    active.current = false;
    if (mounted.current) {
      if (outcome === 'delivered') onText(composeDictated(base.current, transcript.current.text(), maxChars));
      setState('idle');
      levels.value = Array(WAVEFORM_BARS).fill(0);
    }
    transcript.current.reset();
    intent.current = null;
  }, [levels, maxChars, onText]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active' && active.current) {
        // Leaving the app ends the recording, and keeps what was heard.
        intent.current = 'interrupted';
        setNotice('Recording stopped when you left. What I heard is in the message box.');
        try { speechModule?.stop(); } catch { release(true); }
      }
    });
    return () => {
      mounted.current = false;
      subscription?.remove?.();
      if (active.current) release(true);
    };
  }, [release]);

  // A recording must not run forever.
  useEffect(() => {
    if (state !== 'listening') return undefined;
    startedAt.current = Date.now();
    setElapsedMs(0);
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setElapsedMs(elapsed);
      if (elapsed >= MAX_RECORDING_MS && intent.current === null) {
        intent.current = 'finish';
        try { speechModule?.stop(); } catch { release(true); }
      }
    }, 250);
    // If the device never reports volume, say so, so the waveform can show a calm idle state instead of a flat line.
    const volumeCheck = setTimeout(() => { if (!sawVolume.current && mounted.current) setVolumeSupported(false); }, 900);
    return () => {
      clearInterval(timer);
      clearTimeout(volumeCheck);
    };
  }, [release, state]);

  useSpeechEvent('start', () => {
    if (!mounted.current) return;
    active.current = true;
    sawVolume.current = false;
    setVolumeSupported(null);
    setState('listening');
  });
  useSpeechEvent('result', event => {
    if (!mounted.current || !active.current) return;
    const best = event.results?.[0];
    transcript.current.push(best?.transcript ?? '', Boolean(event.isFinal));
  });
  useSpeechEvent('volumechange', event => {
    if (!mounted.current || !active.current) return;
    if (!sawVolume.current) {
      sawVolume.current = true;
      setVolumeSupported(true);
    }
    levels.value = pushLevel(levels.value, levelFromVolume(event.value));
  });
  useSpeechEvent('end', () => {
    if (!mounted.current && !active.current) return;
    finishRecording();
  });
  useSpeechEvent('error', event => {
    if (!mounted.current) return;
    const failure = askDictationFailure(event.error);
    if (event.error === 'aborted' && intent.current === 'cancel') return; // the 'end' that follows discards it
    setNotice(failure.message);
    if (failure.settingsHelp) {
      Alert.alert('Voice input is off', failure.message ?? '', [
        { text: 'Keep typing', style: 'cancel' },
        { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
      ]);
    }
    // Keep whatever was heard before the failure.
    if (intent.current === null) intent.current = 'interrupted';
    if (active.current) finishRecording();
  });

  const confirmDisclosure = useCallback(async (onDevice: boolean): Promise<boolean> => {
    try { if (await AsyncStorage.getItem(ASK_DICTATION_DISCLOSURE_KEY) === 'accepted') return true; } catch { /* ask again */ }
    const copy = askDictationDisclosure(onDevice);
    const accepted = await new Promise<boolean>(resolve => {
      Alert.alert(copy.title, copy.body, [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    });
    if (accepted) { try { await AsyncStorage.setItem(ASK_DICTATION_DISCLOSURE_KEY, 'accepted'); } catch { /* shown again next time */ } }
    return accepted;
  }, []);

  const start = useCallback(async () => {
    if (busy.current || active.current || !available) return;
    busy.current = true;
    setNotice(null);
    setState('starting');
    try {
      const onDevice = speechModule?.supportsOnDeviceRecognition() ?? false;
      if (!(await confirmDisclosure(onDevice))) { setState('idle'); return; }
      const permission = await speechModule?.requestPermissionsAsync();
      if (!permission?.granted) {
        const failure = askDictationFailure('not-allowed');
        setNotice(failure.message);
        setState('idle');
        Alert.alert('Voice input is off', failure.message ?? '', [
          { text: 'Keep typing', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
        ]);
        return;
      }
      if (!mounted.current) return;
      base.current = getText();
      transcript.current.reset();
      intent.current = null;
      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
      speechModule?.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: onDevice,
        addsPunctuation: true,
        recordingOptions: { persist: false },
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      });
    } catch {
      setNotice(askDictationFailure(undefined).message);
      setState('idle');
    } finally {
      busy.current = false;
    }
  }, [available, confirmDisclosure, getText]);

  /** Stop and keep the words. */
  const finish = useCallback(() => {
    if (!active.current) return;
    intent.current = 'finish';
    setState('finishing');
    void safeHaptics.selection();
    try { speechModule?.stop(); } catch { release(true); finishRecording(); }
  }, [finishRecording, release]);

  /** Stop and throw the recording away. Whatever was typed stays as it was. */
  const cancel = useCallback(() => {
    if (!active.current && state === 'idle') return;
    intent.current = 'cancel';
    release(true);
    transcript.current.reset();
    setState('idle');
    levels.value = Array(WAVEFORM_BARS).fill(0);
  }, [levels, release, state]);

  return { available, state, listening: state === 'listening', recording: state !== 'idle', notice, clearNotice: () => setNotice(null), elapsedMs, volumeSupported, levels, start, finish, cancel };
}
