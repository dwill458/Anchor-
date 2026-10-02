import { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, type PanResponderInstance } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import { safeHaptics } from '@/utils/haptics';
import {
  PAGE_COUNT,
  advanceHold,
  beginTouch,
  holdHapticInterval,
  holdHapticStrength,
  moveTouch,
  snapPage,
  type PagerTouch,
} from './choosePager';
import { SEAL_SETTLE_SECONDS } from './creationFlowConfig';
import { SEAL_SEQUENCE_SECONDS } from './sealMath';

/** The pager sits inside this strip of the design space; touches are mapped relative to it. */
export const TOUCH_SURFACE = { top: 100, height: 675 } as const;

export type ChoosePhase = 'choosing' | 'sealing' | 'sealed';

interface UseChooseControllerOptions {
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

/**
 * All of Choose's per-frame motion in one place: the swipe, the hold-to-seal fill (with its
 * haptics) and the seal sequence. The rules themselves live in `choosePager.ts`; this wires them
 * to touches and a single animation clock, and mirrors the result into shared values so the
 * visuals animate without re-rendering.
 *
 * It runs on the JS thread on purpose: gesture state, haptics and callbacks all need to be here,
 * and only plain numbers cross into the shared values.
 */
export function useChooseController({
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
  const holdActiveRef = useRef(false);
  const [activePage, setActivePage] = useState(0);

  const phaseRef = useRef<ChoosePhase>('choosing');
  const pageRef = useRef(0);
  const pageTargetRef = useRef(0);
  const holdRef = useRef(0);
  const holdingRef = useRef(false);
  const touchRef = useRef<PagerTouch | null>(null);
  const hapticAccRef = useRef(0);
  const sealElapsedRef = useRef(0);
  const flashElapsedRef = useRef(10);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const callbacksRef = useRef({ onHoldComplete, onSealAnimationDone });
  callbacksRef.current = { onHoldComplete, onSealAnimationDone };
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  const syncActivePage = useCallback(() => {
    const rounded = Math.min(PAGE_COUNT - 1, Math.max(0, Math.round(pageRef.current)));
    setActivePage((current) => (current === rounded ? current : rounded));
  }, []);

  const startLoop = useRef<() => void>(() => {});

  const tick = useCallback((now: number) => {
    rafRef.current = null;
    const dt = Math.min(0.05, Math.max(0, (now - lastRef.current) / 1000));
    lastRef.current = now;
    let busy = false;

    // Page: follows the finger while dragging, otherwise eases to its target.
    if (!touchRef.current?.dragging) {
      const target = pageTargetRef.current;
      if (Math.abs(target - pageRef.current) > 0.0005) {
        pageRef.current = reduceMotionRef.current
          ? target
          : pageRef.current + (target - pageRef.current) * (1 - Math.exp(-dt * 12));
        if (Math.abs(target - pageRef.current) <= 0.0005) pageRef.current = target;
        busy = true;
        syncActivePage();
      }
    } else {
      busy = true;
    }
    page.value = pageRef.current;

    if (phaseRef.current === 'choosing') {
      const step = advanceHold(holdRef.current, dt, holdingRef.current);
      holdRef.current = step.progress;
      hold.value = step.progress;
      const active = step.progress > 0.02;
      if (active !== holdActiveRef.current) {
        holdActiveRef.current = active;
        setHoldActive(active);
      }
      if (holdingRef.current) {
        busy = true;
        hapticAccRef.current += dt * 1000;
        if (hapticAccRef.current >= holdHapticInterval(step.progress)) {
          hapticAccRef.current = 0;
          void safeHaptics.impact(
            holdHapticStrength(step.progress) === 'light'
              ? Haptics.ImpactFeedbackStyle.Light
              : Haptics.ImpactFeedbackStyle.Medium
          );
        }
      } else if (step.progress > 0) {
        busy = true;
      }

      if (step.complete) {
        holdingRef.current = false;
        touchRef.current = null;
        phaseRef.current = 'sealing';
        setPhase('sealing');
        sealElapsedRef.current = 0;
        flashElapsedRef.current = 0;
        // The seal lands: heavy haptic now; the screen plays `forge-seal`.
        void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Heavy);
        callbacksRef.current.onHoldComplete(Math.round(pageRef.current));
        busy = true;
      }
    }

    if (phaseRef.current === 'sealing') {
      busy = true;
      sealElapsedRef.current += dt;
      flashElapsedRef.current += dt;
      const u = reduceMotionRef.current
        ? Math.min(1, sealElapsedRef.current / 0.4)
        : Math.min(1, sealElapsedRef.current / SEAL_SEQUENCE_SECONDS);
      sealU.value = u;
      flash.value = flashElapsedRef.current;
      hold.value = 1;
      // The medallion rests on cream for a beat before the flow moves on.
      const settle = reduceMotionRef.current ? 0.1 : SEAL_SETTLE_SECONDS;
      const total =
        (reduceMotionRef.current ? 0.4 : SEAL_SEQUENCE_SECONDS) + settle;
      if (sealElapsedRef.current >= total) {
        phaseRef.current = 'sealed';
        setPhase('sealed');
        callbacksRef.current.onSealAnimationDone();
        busy = false;
      }
    }

    if (busy) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [flash, hold, page, sealU, syncActivePage]);

  startLoop.current = () => {
    if (rafRef.current !== null) return;
    lastRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    },
    []
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current && phaseRef.current === 'choosing',
      onMoveShouldSetPanResponder: () => !disabledRef.current && phaseRef.current === 'choosing',
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const x = event.nativeEvent.locationX;
        const y = event.nativeEvent.locationY + TOUCH_SURFACE.top;
        const touch = beginTouch(x, y, pageRef.current);
        touchRef.current = touch;
        holdingRef.current = touch.holding;
        hapticAccRef.current = 0;
        startLoop.current();
      },
      onPanResponderMove: (event) => {
        const touch = touchRef.current;
        if (!touch) return;
        const result = moveTouch(touch, event.nativeEvent.locationX);
        touchRef.current = result.touch;
        holdingRef.current = result.touch.holding;
        if (result.page !== null) {
          pageRef.current = result.page;
          page.value = result.page;
          syncActivePage();
        }
        startLoop.current();
      },
      onPanResponderRelease: (event) => {
        const touch = touchRef.current;
        holdingRef.current = false;
        if (touch?.dragging) {
          pageTargetRef.current = snapPage(touch.startPage, event.nativeEvent.locationX, touch.startX);
        }
        touchRef.current = null;
        startLoop.current();
      },
      onPanResponderTerminate: () => {
        holdingRef.current = false;
        if (touchRef.current?.dragging) {
          pageTargetRef.current = Math.min(PAGE_COUNT - 1, Math.max(0, Math.round(pageRef.current)));
        }
        touchRef.current = null;
        startLoop.current();
      },
    })
  ).current;

  const reset = useCallback(() => {
    phaseRef.current = 'choosing';
    setPhase('choosing');
    holdRef.current = 0;
    holdingRef.current = false;
    touchRef.current = null;
    sealElapsedRef.current = 0;
    flashElapsedRef.current = 10;
    hold.value = 0;
    sealU.value = 0;
    flash.value = 10;
    holdActiveRef.current = false;
    setHoldActive(false);
    startLoop.current();
  }, [flash, hold, sealU]);

  const goToPage = useCallback((index: number) => {
    if (phaseRef.current !== 'choosing') return;
    pageTargetRef.current = Math.min(PAGE_COUNT - 1, Math.max(0, index));
    startLoop.current();
  }, []);

  const sealNow = useCallback(() => {
    if (phaseRef.current !== 'choosing' || disabledRef.current) return;
    holdRef.current = 1;
    holdingRef.current = true;
    startLoop.current();
  }, []);

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
