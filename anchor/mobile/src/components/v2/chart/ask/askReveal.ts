import { useSyncExternalStore } from 'react';

/**
 * Word-by-word reveal bookkeeping for Ask Chart. Progress lives outside React (keyed by message key) so a reply that
 * moves from the streaming draft row to its finished message row continues where it was, a row scrolled out and back
 * never replays, and the footer can wait for the question to finish before offering replies.
 */

/** Words revealed so far per message key. */
const progress = new Map<string, number>();
/** Keys that finished, were skipped, or never needed to animate. */
const done = new Set<string>();
/** Keys currently being revealed (drives the speaking glow and the reply gate). */
const active = new Set<string>();
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

/** Splits text into alternating whitespace / word tokens so spacing and paragraph breaks survive a partial reveal. */
export function tokenize(text: string): string[] {
  return (text ?? '').split(/(\s+)/).filter(token => token.length > 0);
}

export const isWordToken = (token: string) => !/^\s+$/.test(token);

/** Milliseconds to wait after showing this word: a short beat per word, longer after punctuation and paragraph breaks. */
export function wordDelay(word: string, next: string | undefined): number {
  const base = 34 + Math.min(word.length, 10) * 3;
  if (next && /\n\s*\n/.test(next)) return base + 260;
  if (/[.!?…]["”')\]]*$/.test(word)) return base + 190;
  if (/[:;—–]$/.test(word)) return base + 120;
  if (/,["”')\]]*$/.test(word)) return base + 80;
  return base;
}
