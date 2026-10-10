import { useCallback } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCelebrationReduceMotion } from '@/hooks/useCelebrationReduceMotion';
import { AnchorMotion } from '@/theme/v2/motion';

/**
 * Every duration the reminder invitation / time / success surfaces use, in one
 * place so the whole sequence can be re-timed together. Each value sits inside
 * the budget the design set for its kind of movement.
 */
export const NOTIFICATION_MOTION = {
  /** Screen-to-screen transition (450-650ms). */
  screenMs: 560,
  /** The shared Anchor travelling between screens (550-750ms). */
  anchorFlightMs: 650,
  /** One piece of text revealing (300-450ms). */
  textRevealMs: 380,
  /** Touch response (100-140ms). */
  pressMs: 120,
  /** Success acknowledgement (350-500ms). */
  successMs: 420,
  /** Gap between staggered siblings. */
  staggerMs: 75,
  /** Reduced Motion: opacity-only, never longer than this (<=150ms). */
  reducedMs: 140,
  /** Scale the surface sinks to under the finger. */
  pressScale: 0.97,
  /** How far a revealing element rises, in dp. */
  rise: AnchorMotion.rise,
  /** Settling spring for the wheel and any landing element. */
  settleSpring: { damping: 22, stiffness: 230, mass: 0.8 },
} as const;

/** In-app Reduce Motion preference OR the system setting; the same source celebration scenes use. */
export const useNotificationReduceMotion = (): boolean => useCelebrationReduceMotion();

/**
 * Press feedback: scale to 0.97 over `pressMs`. UI-thread transform only, no
 * React state, so a press never re-renders the surface. Under Reduce Motion
 * the surface does not scale.
 */
export const usePressScale = (reduceMotion?: boolean) => {
  const hookReduced = useNotificationReduceMotion();
  const reduced = reduceMotion ?? hookReduced;
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = useCallback(() => {
    if (reduced) return;
    scale.value = withTiming(NOTIFICATION_MOTION.pressScale, {
      duration: NOTIFICATION_MOTION.pressMs,
      easing: AnchorMotion.easing.standard,
    });
  }, [reduced, scale]);

  const onPressOut = useCallback(() => {
    if (reduced) return;
    scale.value = withTiming(1, {
      duration: NOTIFICATION_MOTION.pressMs,
      easing: AnchorMotion.easing.standard,
    });
  }, [reduced, scale]);

  return { style, onPressIn, onPressOut };
};
