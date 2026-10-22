/** Pure helpers for dictating a scene description. The native recogniser lives in `useVisionDictation`. */

/** Puts spoken text after what the person had already typed, never replacing it. */
export function mergeDictation(base: string, transcript: string): string {
  const spoken = transcript.replace(/\s+/g, ' ').trim();
  if (!spoken) return base;
  if (!base.trim()) return spoken;
  if (/\n$/.test(base)) return `${base}${spoken}`;
  return `${base.replace(/[ \t]+$/, '')} ${spoken}`;
}

/** Same, clipped to the field's limit. */
export function mergeDictationWithin(base: string, transcript: string, maxChars: number): string {
  return mergeDictation(base, transcript).slice(0, maxChars);
}

export type DictationFailure = { message: string | null; settingsHelp: boolean };

/**
 * What to tell the person when recognition stops with an error. `null` means say nothing:
 * silence and cancellation are not failures. Typed text is always left as it was.
 */
export function dictationFailure(code: string | undefined): DictationFailure {
  switch (code) {
    case 'not-allowed':
      return { message: 'Microphone or speech access is off. You can keep typing, or allow it in Settings.', settingsHelp: true };
    case 'service-not-allowed':
    case 'language-not-supported':
      return { message: 'Voice input isn’t available on this device. You can keep typing.', settingsHelp: false };
    case 'no-speech':
    case 'speech-timeout':
    case 'aborted':
      return { message: null, settingsHelp: false };
    case 'audio-capture':
      return { message: 'The microphone isn’t available right now. You can keep typing.', settingsHelp: false };
    case 'network':
      return { message: 'Voice input needs a connection right now. You can keep typing.', settingsHelp: false };
    default:
      return { message: 'Voice input stopped. Your text is safe; you can try again or keep typing.', settingsHelp: false };
  }
}

export const DICTATION_DISCLOSURE_KEY = 'vision_dictation_disclosure_v1';

/** Shown once, before the first recording. Honest about where audio can go. */
export function dictationDisclosure(onDevice: boolean): { title: string; body: string } {
  return onDevice
    ? { title: 'Describe it with your voice', body: 'Anchor turns what you say into text on this device and does not keep the audio. You can edit the text before anything is created.' }
    : { title: 'Describe it with your voice', body: 'To turn speech into text, your phone’s speech service (Apple or Google) may process what you say. Anchor does not keep the audio. You can edit the text before anything is created.' };
}
