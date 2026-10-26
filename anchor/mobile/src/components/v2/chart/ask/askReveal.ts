import { useSyncExternalStore } from 'react';
import { Easing, makeMutable, ReduceMotion, withSequence, withTiming } from 'react-native-reanimated';

/**
 * Character (Unicode code point) reveal bookkeeping for Ask Chart. Progress lives outside React (keyed by message key) so a reply that
 * moves from the streaming draft row to its finished message row continues where it was, a row scrolled out and back
 * never replays, and the footer can wait for the question to finish before offering replies.
 */

/** Unicode code points revealed so far per message key, never UTF-16 offsets. */
const progress = new Map<string, number>();
/** Keys that finished, were skipped, or never needed to animate. */
const done = new Set<string>();
/** Keys currently being revealed (drives the speaking glow and the reply gate). */
const active = new Set<string>();
export const askRevealEnergy = makeMutable(0);
export const ASK_REVEAL = { msPerChar: 24, minMsPerChar: 9, capMs: 9000 } as const;
const listeners = new Set<() => void>();
let snapshot = 0;

const emit = () => {
  snapshot += 1;
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const askReveal = {
  bump() {
    askRevealEnergy.value = withSequence(
      withTiming(1, { duration: 60, reduceMotion: ReduceMotion.Never }),
      withTiming(0, { duration: 380, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
    );
  },
  count: (key: string) => progress.get(key) ?? 0,
  isDone: (key: string) => done.has(key),
  setCount(key: string, count: number) {
    progress.set(key, count);
  },
  begin(key: string) {
    if (active.has(key)) return;
    active.add(key);
    emit();
  },
  /** The reveal finished, or was skipped by a tap. */
  finish(key: string) {
    const changed = active.delete(key);
    done.add(key);
    if (changed) emit();
  },
  /** Leaves the key unfinished (screen unmounted mid-reveal); the next mount picks it up. */
  pause(key: string) {
    if (active.delete(key)) emit();
  },
  /** For messages that must appear at rest: restored history. */
  markDone(key: string) {
    done.add(key);
  },
  isActive: (key: string) => active.has(key),
  /** Tests only. */
  reset() {
    progress.clear();
    done.clear();
    active.clear();
    askRevealEnergy.value = 0;
    emit();
  },
};

/** True while any reply is being revealed. */
export function useAnyRevealing(): boolean {
  return useSyncExternalStore(subscribe, () => active.size > 0, () => false);
}

/** True while this specific reply is being revealed. */
export function useRevealing(key: string): boolean {
  return useSyncExternalStore(subscribe, () => active.has(key), () => false);
}

/** Pause after a code point; punctuation inside a word (3.5, e.g.) has no sentence pause. */
export function charDelay(char: string, next: string | undefined): number {
  if (char === '\n' && next === '\n') return 300;
  if (/\s/.test(char)) return 0;
  if (char === ',') return ASK_REVEAL.msPerChar + 85;
  if (/[;:—–]/.test(char)) return ASK_REVEAL.msPerChar + 120;
  if (/[.!?…]/.test(char) && (!next || /\s/.test(next))) return ASK_REVEAL.msPerChar + 230;
  return ASK_REVEAL.msPerChar;
}

// DEFERRED: replaced by charDelay (Oct 2026). No other consumers used the word helpers.
// export const tokenize = (text: string) => (text ?? '').split(/(\s+)/).filter(Boolean);
// export const isWordToken = (token: string) => !/^\s+$/.test(token);
// export function wordDelay(word: string, next: string | undefined) {
//   const base = 34 + Math.min(word.length, 10) * 3;
//   if (next && /\n\s*\n/.test(next)) return base + 260;
//   if (/[.!?…]["”')\]]*$/.test(word)) return base + 190;
//   if (/[:;—–]$/.test(word)) return base + 120;
//   if (/,["”')\]]*$/.test(word)) return base + 80;
//   return base;
// }
