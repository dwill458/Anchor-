import { useCallback, useEffect, useRef, useState } from 'react';
import { v2Haptics } from '@/hooks/v2';
import {
  RELEASE_HOLD_DURATION_MS,
  RELEASE_HOLD_HAPTIC_STEPS,
  RELEASE_HOLD_TICK_MS,
} from '@/constants/v2/release';

type HoldHaptics = Pick<typeof v2Haptics, 'selection' | 'completion'>;

export interface UseReleaseHoldOptions {
  /** Called once the hold has been sustained for the full duration. */
  onComplete: () => void;
  /** Called when the finger lifts (or focus is lost) before completion. No side effects should have occurred. */
  onCancel?: () => void;
  /** Called the first time progress advances past zero on a fresh hold. */
  onSustainStart?: () => void;
  durationMs?: number;
  /** Reduced Motion: the visual reset is immediate; the hold contract is unchanged. */
  reduceMotion?: boolean;
  haptics?: HoldHaptics;
  /** Test seam for the clock. */
  now?: () => number;
}

export interface UseReleaseHoldResult {
  /** 0 → 1 fill of the radial progress ring. */
  progress: number;
  isHolding: boolean;
  isComplete: boolean;
  /** Wire to Pressable onPressIn / onLongPress start. */
  beginHold: () => void;
  /** Wire to Pressable onPressOut, onResponderTerminate, blur. */
  endHold: () => void;
  /** Return to the resting state (used after a definitive failure requires a fresh hold). */
  reset: () => void;
}

/**
 * Deliberate 1.8s hold-to-release interaction.
 *
 * Progress fills over `durationMs`. Haptic ticks form a crescendo as the ring
 * fills (`v2Haptics.selection()`), resolving to a single `v2Haptics.completion()`
 * pulse at the top. Lifting before completion retreats to zero and fires
 * `onCancel` — no release request is ever sent from here.
 */
export function useReleaseHold(options: UseReleaseHoldOptions): UseReleaseHoldResult {
  const {
    onComplete,
    onCancel,
    onSustainStart,
    durationMs = RELEASE_HOLD_DURATION_MS,
    haptics = v2Haptics,
    now = Date.now,
  } = options;

  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);
  const lastHapticStepRef = useRef<number>(0);
  const sustainNotifiedRef = useRef<boolean>(false);
  // Keep the latest callbacks without re-subscribing the interval.
  const cbRef = useRef({ onComplete, onCancel, onSustainStart, haptics, now });
  cbRef.current = { onComplete, onCancel, onSustainStart, haptics, now };

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const finishComplete = useCallback(() => {
    clearTimer();
    setProgress(1);
    setIsHolding(false);
    setIsComplete(true);
    cbRef.current.haptics.completion();
    cbRef.current.onComplete();
  }, [clearTimer]);

  const tick = useCallback(() => {
    const elapsed = cbRef.current.now() - startRef.current;
    const next = Math.min(1, elapsed / durationMs);

    if (next > 0 && !sustainNotifiedRef.current) {
      sustainNotifiedRef.current = true;
      cbRef.current.onSustainStart?.();
    }

    if (next >= 1) {
      finishComplete();
      return;
    }

    const step = Math.floor(next * RELEASE_HOLD_HAPTIC_STEPS);
    if (step > lastHapticStepRef.current) {
      lastHapticStepRef.current = step;
      cbRef.current.haptics.selection();
    }

    setProgress(next);
  }, [durationMs, finishComplete]);

  const beginHold = useCallback(() => {
    if (isComplete || intervalRef.current !== null) return;
    startRef.current = cbRef.current.now();
    lastHapticStepRef.current = 0;
    sustainNotifiedRef.current = false;
    setIsHolding(true);
    setProgress(0);
    intervalRef.current = setInterval(tick, RELEASE_HOLD_TICK_MS);
  }, [isComplete, tick]);

  const endHold = useCallback(() => {
    if (isComplete || intervalRef.current === null) return;
    clearTimer();
    setIsHolding(false);
    // Cancel cleanly: retreat to zero, no request sent.
    setProgress(0);
    lastHapticStepRef.current = 0;
    sustainNotifiedRef.current = false;
    cbRef.current.onCancel?.();
  }, [clearTimer, isComplete]);

  const reset = useCallback(() => {
    clearTimer();
    setProgress(0);
    setIsHolding(false);
    setIsComplete(false);
    lastHapticStepRef.current = 0;
    sustainNotifiedRef.current = false;
  }, [clearTimer]);

  return { progress, isHolding, isComplete, beginHold, endHold, reset };
}
