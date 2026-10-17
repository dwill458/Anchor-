import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { DICTATION_DISCLOSURE_KEY, dictationDisclosure, dictationFailure, mergeDictationWithin } from './visionDictation';

export type DictationState = 'idle' | 'starting' | 'listening';

type Options = {
  /** The field's current text, read when recording starts so spoken words are added after it. */
  getText: () => string;
  /** Receives the field's new text. Never submits anything. */
  onText: (text: string) => void;
  maxChars: number;
};

/**
 * Voice input for the scene description field only. One tap starts, one tap stops. The microphone is
 * released on stop, when the app leaves the foreground, and when the screen unmounts. A first-use
 * disclosure is shown before any recording, and what the person typed is never lost on failure.
 */
export function useVisionDictation({ getText, onText, maxChars }: Options) {
  const [state, setState] = useState<DictationState>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const base = useRef('');
  const active = useRef(false);
  const busy = useRef(false);
  const mounted = useRef(true);

  const stopNative = useCallback(() => {
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* nothing was running */ }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const sub = AppState.addEventListener('change', next => {
      if (next !== 'active' && active.current) stopNative();
    });
    return () => {
      mounted.current = false;
      sub.remove();
      if (active.current) stopNative();
    };
  }, [stopNative]);

  useSpeechRecognitionEvent('start', () => { if (mounted.current) { active.current = true; setState('listening'); } });
  useSpeechRecognitionEvent('end', () => { active.current = false; if (mounted.current) setState('idle'); });
  useSpeechRecognitionEvent('result', event => {
    if (!mounted.current || !active.current) return;
    const transcript = event.results?.[0]?.transcript ?? '';
    onText(mergeDictationWithin(base.current, transcript, maxChars));
  });
  useSpeechRecognitionEvent('error', event => {
    active.current = false;
    if (!mounted.current) return;
    setState('idle');
    const failure = dictationFailure(event.error);
    setNotice(failure.message);
    if (failure.settingsHelp) {
      Alert.alert('Voice input is off', failure.message ?? '', [
        { text: 'Keep typing', style: 'cancel' },
        { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
      ]);
    }
  });

  const confirmDisclosure = useCallback(async (onDevice: boolean): Promise<boolean> => {
    try { if (await AsyncStorage.getItem(DICTATION_DISCLOSURE_KEY) === 'accepted') return true; } catch { /* ask again */ }
    const copy = dictationDisclosure(onDevice);
    const accepted = await new Promise<boolean>(resolve => {
      Alert.alert(copy.title, copy.body, [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    });
    if (accepted) { try { await AsyncStorage.setItem(DICTATION_DISCLOSURE_KEY, 'accepted'); } catch { /* shown again next time */ } }
    return accepted;
  }, []);

  const start = useCallback(async () => {
    if (busy.current || active.current) return;
    busy.current = true;
    setNotice(null);
    setState('starting');
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setNotice(dictationFailure('service-not-allowed').message);
        setState('idle');
        return;
      }
      const onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
      if (!(await confirmDisclosure(onDevice))) { setState('idle'); return; }
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        const failure = dictationFailure('not-allowed');
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
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: onDevice,
        addsPunctuation: true,
        recordingOptions: { persist: false },
      });
    } catch {
      setNotice(dictationFailure(undefined).message);
      setState('idle');
    } finally {
      busy.current = false;
    }
  }, [confirmDisclosure, getText]);

  const stop = useCallback(() => {
    if (!active.current && state === 'idle') return;
    try { ExpoSpeechRecognitionModule.stop(); } catch { stopNative(); }
  }, [state, stopNative]);

  const toggle = useCallback(() => { if (state === 'listening') stop(); else void start(); }, [start, state, stop]);

  return { state, listening: state === 'listening', notice, clearNotice: () => setNotice(null), toggle, stop };
}
