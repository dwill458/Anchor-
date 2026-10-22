import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cancelAnimation, Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { v2Haptics } from '@/hooks/v2';
import {
  RELEASE_HOLD_DURATION_MS,
  RELEASE_HOLD_HAPTIC_STEPS,
  RELEASE_HOLD_TICK_MS,
  RELEASE_HOLD_CANCEL_MS,
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
  /** 0 → 1 sampled hold progress; presentation uses visualProgress. */
  progress: number;
  /** UI-thread presentation; the sampled clock remains the authority for commitment. */
  visualProgress: SharedValue<number>;
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
 * The UI-thread fill runs over `durationMs`. Haptic ticks form a crescendo as it
 * fills (`v2Haptics.selection()`), resolving to the injected commitment
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
    reduceMotion = false,
  } = options;

  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const visualProgress = useSharedValue(0);
  const completedRef = useRef(false);

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

  useEffect(() => () => { clearTimer(); cancelAnimation(visualProgress); }, [clearTimer, visualProgress]);

  const finishComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    clearTimer();
    cancelAnimation(visualProgress);
    visualProgress.value = 1;
    setProgress(1);
    setIsHolding(false);
    setIsComplete(true);
    cbRef.current.haptics.completion();
    cbRef.current.onComplete();
  }, [clearTimer, visualProgress]);

  const tick = useCallback(() => {
    const elapsed = cbRef.current.now() - startRef.current;
    const next = Math.min(1, elapsed / durationMs);

    if (next > 0 && !sustainNotifiedRef.current) {
      sustainNotifiedRef.current = true;
      cbRef.current.onSustainStart?.();
      setProgress(next);
    }

    if (next >= 1) {
      finishComplete();
      return;
    }

    const step = Math.floor(next * RELEASE_HOLD_HAPTIC_STEPS);
    if (step > lastHapticStepRef.current) {
      lastHapticStepRef.current = step;
      cbRef.current.haptics.selection();
      setProgress(next);
    }

  }, [durationMs, finishComplete]);

  const beginHold = useCallback(() => {
    if (completedRef.current || intervalRef.current !== null) return;
    startRef.current = cbRef.current.now();
    lastHapticStepRef.current = 0;
    sustainNotifiedRef.current = false;
    setIsHolding(true);
    setProgress(0);
    cancelAnimation(visualProgress);
    visualProgress.value = 0;
    visualProgress.value = withTiming(1, { duration: durationMs, easing: Easing.linear });
    intervalRef.current = setInterval(tick, RELEASE_HOLD_TICK_MS);
  }, [durationMs, tick, visualProgress]);

  const endHold = useCallback(() => {
    if (completedRef.current || intervalRef.current === null) return;
    clearTimer();
    setIsHolding(false);
    // Cancel cleanly: retreat to zero, no request sent.
    setProgress(0);
    cancelAnimation(visualProgress);
    visualProgress.value = reduceMotion ? 0 : withTiming(0, { duration: RELEASE_HOLD_CANCEL_MS, easing: Easing.out(Easing.cubic) });
    lastHapticStepRef.current = 0;
    sustainNotifiedRef.current = false;
    cbRef.current.onCancel?.();
  }, [clearTimer, reduceMotion, visualProgress]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') endHold();
    });
    return () => subscription.remove();
  }, [endHold]);

  const reset = useCallback(() => {
    clearTimer();
    completedRef.current = false;
    cancelAnimation(visualProgress);
    // Easing back (not snapping) keeps a rejected hold or a failed release from flashing the cream sheet.
    visualProgress.value = reduceMotion ? 0 : withTiming(0, { duration: RELEASE_HOLD_CANCEL_MS, easing: Easing.out(Easing.cubic) });
    setProgress(0);
    setIsHolding(false);
    setIsComplete(false);
    lastHapticStepRef.current = 0;
    sustainNotifiedRef.current = false;
  }, [clearTimer, reduceMotion, visualProgress]);

  return { progress, visualProgress, isHolding, isComplete, beginHold, endHold, reset };
}
