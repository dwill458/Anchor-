import { dictationFailure, mergeDictationWithin, type DictationFailure } from '@/hooks/v2/vision/visionDictation';

/** Pure helpers for Ask Chart's voice input. The native recogniser lives in `useAskDictation`. */

export const ASK_DICTATION_DISCLOSURE_KEY = 'ask_chart_dictation_disclosure_v1';
export const WAVEFORM_BARS = 28;
export const MAX_RECORDING_MS = 120_000;

/** Shown once, before the first recording. Honest about where audio can go, and about what is kept. */
export function askDictationDisclosure(onDevice: boolean): { title: string; body: string } {
  return onDevice
    ? { title: 'Talk to Ask Chart', body: 'Anchor turns what you say into text on this device and does not keep the audio. You can edit the text before you send it.' }
    : { title: 'Talk to Ask Chart', body: 'To turn speech into text, your phone’s speech service (Apple or Google) may process what you say. Anchor does not keep the audio. You can edit the text before you send it.' };
}

/**
 * Builds the running transcript from recogniser results. Final results are kept; the latest interim one is shown
 * after them. Some platforms deliver one growing result, others several segments, and this works for both.
 */
export function createTranscript() {
  let committed = '';
  let interim = '';
  const join = () => `${committed} ${interim}`.replace(/\s+/g, ' ').trim();
  return {
    push(text: string, isFinal: boolean) {
      const clean = text.replace(/\s+/g, ' ').trim();
      if (isFinal) {
        if (clean) committed = `${committed} ${clean}`.trim();
        interim = '';
      } else {
        interim = clean;
      }
    },
    text: join,
    reset() {
      committed = '';
      interim = '';
    },
  };
}

/** The recogniser reports -2 to 10 (below 0 is inaudible). Mapped to 0 to 1 with a curve that keeps quiet speech visible. */
export function levelFromVolume(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const linear = Math.min(1, Math.max(0, value / 10));
  return Math.pow(linear, 0.7);
}

/** Pushes one level onto the right of a fixed-length history, dropping the oldest. */
export function pushLevel(levels: readonly number[], level: number, length = WAVEFORM_BARS): number[] {
  const next = levels.length >= length ? levels.slice(levels.length - length + 1) : [...levels];
  while (next.length < length - 1) next.unshift(0);
  next.push(level);
  return next;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Spoken text added after whatever the person had already typed, clipped to the composer's limit. */
export function composeDictated(base: string, transcript: string, maxChars: number): string {
  return mergeDictationWithin(base, transcript, maxChars);
}

export type AskDictationOutcome = 'delivered' | 'discarded' | 'empty';

/** What to do when recognition ends. Words that were heard are never thrown away unless the person cancelled. */
export function resolveDictationEnd(intent: 'finish' | 'cancel' | 'interrupted' | null, transcript: string): AskDictationOutcome {
  if (intent === 'cancel') return 'discarded';
  return transcript.trim() ? 'delivered' : 'empty';
}

export function askDictationFailure(code: string | undefined): DictationFailure {
  return dictationFailure(code);
}
