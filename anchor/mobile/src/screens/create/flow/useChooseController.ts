import { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, type PanResponderInstance } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Easing,
  ReduceMotion,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { safeHaptics } from '@/utils/haptics';
import { trace, traceReset } from '@/utils/dev/creationTrace';
import {
  PAGE_COUNT,
  beginTouch,
  holdHapticInterval,
  holdHapticStrength,
  moveTouch,
  snapPage,
  type PagerTouch,
} from './choosePager';
import { playCreationSound, type CreationSoundHandle } from '@/services/CreationSounds';
import { SEAL_DRAIN_RATE, SEAL_HOLD_MS, SEAL_SETTLE_SECONDS } from './creationFlowConfig';
import { SEAL_PULSE_AT, SEAL_SEQUENCE_SECONDS } from './sealMath';

/** The pager sits inside this strip of the design space; touches are mapped relative to it. */
export const TOUCH_SURFACE = { top: 100, height: 675 } as const;

export type ChoosePhase = 'choosing' | 'sealing' | 'sealed';

/** The swipe settles with an ease-out of this length (the old per-frame ease had ~83 ms time constant). */
const PAGE_GLIDE_MS = 380;
/** Seconds of the flash animation (`sealFlash` maps 0..0.4 s onto its scale/alpha). */
const FLASH_SECONDS = 0.4;
/** Every clock here is the app's own; the OS animator scale must not collapse it. */
const NEVER_REDUCE = ReduceMotion.Never;

interface UseChooseControllerOptions {
  /** The ring completes and the flash begins, before saving can occupy JS. */
  onSealLanded: () => void;
  /** The hold reached 100%: begin saving. Called once. */
  onHoldComplete: (pageIndex: number) => void;
  /** The seal animation finished. Called once, after `onHoldComplete`. */
  onSealAnimationDone: () => void;
  /** Reduced motion: no swipe glide, no press/contract — the seal is a short crossfade. */
  reduceMotion: boolean;
  /** Anything that should keep the pager inert (e.g. while a save is retried). */
  disabled?: boolean;
}

export interface ChooseController {
  phase: ChoosePhase;
  /** Which Form is showing (rounded page), for labels and the seal. */
  activePage: number;
  /** Live values for Reanimated styles. */
  page: SharedValue<number>;
  hold: SharedValue<number>;
  /** 0..1 across the seal sequence. */
  sealU: SharedValue<number>;
  /** Seconds since the seal landed, for the ring flash. */
  flash: SharedValue<number>;
  panHandlers: PanResponderInstance['panHandlers'];
  /** Non-gesture alternatives for assistive technology. */
  goToPage: (index: number) => void;
  /** Seal without holding (assistive technology activates the control instead). */
  sealNow: () => void;
  /** True once the hold has visibly begun (drives "Keep holding…" and the header beat). */
  holdActive: boolean;
  /** Back to choosing, e.g. after a save was refused. */
  reset: () => void;
}

const clampPage = (value: number) => Math.min(PAGE_COUNT - 1, Math.max(0, Math.round(value)));

/**
 * All of Choose's motion in one place: the swipe, the hold-to-seal fill (with its haptics) and
 * the seal sequence. The rules live in `choosePager.ts`; this wires them to touches.
 *
 * The clocks run on the UI thread: the hold fill/drain, the pager glide, the seal sequence (and
 * the beat it rests before moving on) and the ring flash are Reanimated timings, so a stalled JS
 * thread — the save, an image decode, a setState — cannot drop a frame of them. The JS thread
 * keeps only what must be there: touch capture (one event per move, not per frame), haptics, and
 * the two callbacks, fired at the event instants through `runOnJS` from the animation callbacks.
 *
 * `advanceHold` in `choosePager.ts` states the same fill/drain maths (1.1 s fill, 2.6x drain) and
 * stays as the tested definition; the timings below are its closed form.
 */
export function useChooseController({
  onSealLanded,
  onHoldComplete,
  onSealAnimationDone,
  reduceMotion,
  disabled = false,
}: UseChooseControllerOptions): ChooseController {
  const page = useSharedValue(0);
  const hold = useSharedValue(0);
  const sealU = useSharedValue(0);
  const flash = useSharedValue(10);

  const [phase, setPhase] = useState<ChoosePhase>('choosing');
  const [holdActive, setHoldActive] = useState(false);
  const [activePage, setActivePage] = useState(0);

  const phaseRef = useRef<ChoosePhase>('choosing');
  /** The page the pager is at, or gliding to; what a completed hold seals. */
  const settledPageRef = useRef(0);
  const holdingRef = useRef(false);
  const touchRef = useRef<PagerTouch | null>(null);
  const hapticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sealRiseRef = useRef<CreationSoundHandle | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({ onHoldComplete, onSealAnimationDone, onSealLanded });
  callbacksRef.current = { onHoldComplete, onSealAnimationDone, onSealLanded };
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  // Mirror the two pieces of UI-thread state React needs.
  useAnimatedReaction(
    () => Math.min(PAGE_COUNT - 1, Math.max(0, Math.round(page.value))),
    (rounded, previous) => {
      if (rounded !== previous) runOnJS(setActivePage)(rounded);
    },
    []
  );
  useAnimatedReaction(
    () => hold.value > 0.02,
    (active, previous) => {
      if (active !== previous) runOnJS(setHoldActive)(active);
    },
    []
  );

  const stopHaptics = useCallback(() => {
    if (hapticTimerRef.current !== null) clearTimeout(hapticTimerRef.current);
    hapticTimerRef.current = null;
  }, []);

  /** Cadence tightens from 150 ms to 50 ms as the hold fills; strength steps up halfway. */
  const scheduleHaptic = useCallback(() => {
    hapticTimerRef.current = setTimeout(() => {
      hapticTimerRef.current = null;
      if (!holdingRef.current || phaseRef.current !== 'choosing') return;
      const progress = hold.value;
      void safeHaptics.impact(
        holdHapticStrength(progress) === 'light'
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium
      );
      scheduleHaptic();
    }, holdHapticInterval(hold.value));
  }, [hold]);

  const finishSeal = useCallback(() => {
    if (phaseRef.current !== 'sealing') return;
    phaseRef.current = 'sealed';
    setPhase('sealed');
    trace('seal sequence end');
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    callbacksRef.current.onSealAnimationDone();
  }, []);

  /** Play the seal: the sequence, then the beat it rests before the flow moves on. */
  const startSeal = useCallback(() => {
    const reduced = reduceMotionRef.current;
    const sequenceMs = (reduced ? 0.4 : SEAL_SEQUENCE_SECONDS) * 1000;
    const settleMs = Math.max(0.5, SEAL_SETTLE_SECONDS) * 1000;
    sealU.value = 0;
    flash.value = 0;
    flash.value = withTiming(FLASH_SECONDS, { duration: FLASH_SECONDS * 1000, easing: Easing.linear, reduceMotion: NEVER_REDUCE });
    sealU.value = withSequence(
      withTiming(1, { duration: sequenceMs, easing: Easing.linear, reduceMotion: NEVER_REDUCE }),
      withTiming(1, { duration: settleMs, easing: Easing.linear, reduceMotion: NEVER_REDUCE }, (finished) => {
        'worklet';
        if (finished) runOnJS(finishSeal)();
      })
    );
    callbacksRef.current.onSealLanded();
    const pulseDelayMs = Math.round(SEAL_PULSE_AT * sequenceMs);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      pulseTimerRef.current = null;
      if (phaseRef.current === 'sealing') {
        playCreationSound('anchorPulse');
      }
    }, pulseDelayMs);
  }, [finishSeal, flash, sealU]);

  /** The hold reached 100% (or assistive tech sealed directly). JS thread. */
  const completeHold = useCallback(() => {
    if (phaseRef.current !== 'choosing') return;
    stopHaptics();
    sealRiseRef.current?.stop(150);
    sealRiseRef.current = null;
    holdingRef.current = false;
    touchRef.current = null;
    phaseRef.current = 'sealing';
    setPhase('sealing');
    hold.value = 1;
    // Start the flash and its cue together before save/persistence can occupy JS.
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Heavy);
    trace('hold complete / seal sequence start');
    startSeal();
    callbacksRef.current.onHoldComplete(settledPageRef.current);
  }, [hold, startSeal, stopHaptics]);

  /** Fill from wherever the ring is, linearly, finishing at SEAL_HOLD_MS for a full ring. */
  const startHolding = useCallback(() => {
    const remaining = Math.max(0, 1 - hold.value);
    sealRiseRef.current?.stop();
    sealRiseRef.current = playCreationSound('sealRise', undefined, { loop: true });
    hold.value = withTiming(
      1,
      { duration: Math.max(1, remaining * SEAL_HOLD_MS), easing: Easing.linear, reduceMotion: NEVER_REDUCE },
      (finished) => {
        'worklet';
        if (finished) runOnJS(completeHold)();
      }
    );
    stopHaptics();
    scheduleHaptic();
  }, [completeHold, hold, scheduleHaptic, stopHaptics]);

  /** Released early (or the finger became a swipe): drain at SEAL_DRAIN_RATE times the fill rate. */
  const stopHolding = useCallback(() => {
    stopHaptics();
    sealRiseRef.current?.stop(200);
    sealRiseRef.current = null;
    holdingRef.current = false;
    const current = hold.value;
    if (current <= 0) return;
    hold.value = withTiming(0, {
      duration: (current / SEAL_DRAIN_RATE) * 1000,
      easing: Easing.linear,
      reduceMotion: NEVER_REDUCE,
    });
  }, [hold, stopHaptics]);

  const glideTo = useCallback(
    (target: number) => {
      settledPageRef.current = target;
      page.value = reduceMotionRef.current
        ? target
        : withTiming(target, { duration: PAGE_GLIDE_MS, easing: Easing.out(Easing.cubic), reduceMotion: NEVER_REDUCE });
    },
    [page]
  );

  useEffect(
    () => () => {
      stopHaptics();
      sealRiseRef.current?.stop();
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      cancelAnimation(hold);
      cancelAnimation(page);
      cancelAnimation(sealU);
      cancelAnimation(flash);
    },
    [flash, hold, page, sealU, stopHaptics]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current && phaseRef.current === 'choosing',
      onMoveShouldSetPanResponder: () => !disabledRef.current && phaseRef.current === 'choosing',
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const x = event.nativeEvent.locationX;
        const y = event.nativeEvent.locationY + TOUCH_SURFACE.top;
        const touch = beginTouch(x, y, page.value);
        touchRef.current = touch;
        holdingRef.current = touch.holding;
        if (touch.holding) {
          traceReset('hold start');
          startHolding();
        }
      },
      onPanResponderMove: (event) => {
        const touch = touchRef.current;
        if (!touch) return;
        const result = moveTouch(touch, event.nativeEvent.locationX);
        touchRef.current = result.touch;
        const wasHolding = holdingRef.current;
        holdingRef.current = result.touch.holding;
        if (wasHolding && !result.touch.holding) stopHolding();
        if (result.page !== null) {
          // Assigning cancels any glide in flight: the page follows the finger.
          page.value = result.page;
        }
      },
      onPanResponderRelease: (event) => {
        const touch = touchRef.current;
        touchRef.current = null;
        if (holdingRef.current) stopHolding();
        if (touch?.dragging) {
          glideTo(snapPage(touch.startPage, event.nativeEvent.locationX, touch.startX));
        }
      },
      onPanResponderTerminate: () => {
        const touch = touchRef.current;
        touchRef.current = null;
        if (holdingRef.current) stopHolding();
        if (touch?.dragging) glideTo(clampPage(page.value));
      },
    })
  ).current;

  const reset = useCallback(() => {
    stopHaptics();
    sealRiseRef.current?.stop();
    sealRiseRef.current = null;
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = null;
    phaseRef.current = 'choosing';
    setPhase('choosing');
    holdingRef.current = false;
    touchRef.current = null;
    hold.value = 0;
    sealU.value = 0;
    flash.value = 10;
  }, [flash, hold, sealU, stopHaptics]);

  const goToPage = useCallback(
    (index: number) => {
      if (phaseRef.current !== 'choosing') return;
      glideTo(clampPage(index));
    },
    [glideTo]
  );

  const sealNow = useCallback(() => {
    if (phaseRef.current !== 'choosing' || disabledRef.current) return;
    holdingRef.current = true;
    completeHold();
  }, [completeHold]);

  return {
    phase,
    activePage,
    page,
    hold,
    sealU,
    flash,
    panHandlers: panResponder.panHandlers,
    goToPage,
    sealNow,
    holdActive,
    reset,
  };
}
