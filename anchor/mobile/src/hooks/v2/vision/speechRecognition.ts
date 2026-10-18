/**
 * Guarded access to `expo-speech-recognition`. The package throws at import time when the installed
 * native build predates it, which would take the whole app down. Loading it here lets a build without
 * the module simply hide the microphone while typing keeps working.
 */
type SpeechModule = typeof import('expo-speech-recognition');

let loaded: SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  loaded = require('expo-speech-recognition') as SpeechModule;
} catch {
  loaded = null;
}

/** The native speech module, or null on a build that does not include it. */
export const speechModule = loaded?.ExpoSpeechRecognitionModule ?? null;

const noopEvent = (() => {}) as unknown as SpeechModule['useSpeechRecognitionEvent'];

/** Same contract as the package's hook; does nothing when the module is absent (the choice is fixed at load, so hook order never changes). */
export const useSpeechEvent: SpeechModule['useSpeechRecognitionEvent'] = loaded?.useSpeechRecognitionEvent ?? noopEvent;
