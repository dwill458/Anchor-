/**
 * Every duration and physical constant for the Vision board, in one place.
 *
 * Two classes of motion:
 *   camera  - `withTiming`, a slow cinematic ease, never a bounce
 *   objects - `withSpring`, restrained physical settling
 *
 * The app decides Reduce Motion itself (`useV2ReduceMotion`) and passes the
 * reduced variants explicitly. The wrappers pin `ReduceMotion.Never` so a
 * device with system animator scale 0 does not silently jump every camera
 * move to its end (seen on the team's S24).
 */
import {
  Easing, ReduceMotion, withDelay, withSpring, withTiming,
  type AnimationCallback, type WithSpringConfig, type WithTimingConfig,
} from 'react-native-reanimated';

export const VISION_BOARD_MOTION = {
  /** Scene is laid out this much larger than the board is shown, so zooming stays sharp. */
  renderScale: 1.7,
  focus: {
    moveMs: 900,
    returnMs: 820,
    /** Zoom relative to the whole-board view (brief: roughly 1.4-1.7x). */
    minZoom: 1.4,
    maxZoom: 1.7,
    fill: 0.8,
    /** Controls appear once the move has mostly arrived. */
    controlsAtMs: 520,
    controlsFadeMs: 260,
  },
  lift: {
    scale: 1.045,
    shadowOpacity: 0.34,
    restShadowOpacity: 0.16,
    shadowOffset: 10,
    restShadowOffset: 4,
    longPressMs: 320,
  },
  spring: { damping: 20, stiffness: 150, mass: 1 } satisfies WithSpringConfig,
  /** Changing image count: the board recomposes into the next preset. */
  recompose: {
    moveMs: 1000,
    enterDelayMs: 380,
    enterMs: 720,
    enterFromScale: 1.08,
    enterFromLift: -14,
    exitMs: 420,
    exitToScale: 0.92,
  },
  frameCrossfadeMs: 320,
  reduced: {
    focusFadeOutMs: 140,
    focusFadeInMs: 240,
    recomposeMs: 240,
    swapMs: 160,
  },
} as const;

/** The camera's ease: unhurried in, unhurried out, no overshoot. */
export const boardCameraEasing = Easing.bezier(0.45, 0, 0.2, 1);
/** Objects moving to a new composition. */
export const boardRecomposeEasing = Easing.bezier(0.33, 0, 0.15, 1);

export function boardTiming(toValue: number, config: Omit<WithTimingConfig, 'reduceMotion'> = {}, callback?: AnimationCallback) {
  'worklet';
  return withTiming(toValue, { ...config, reduceMotion: ReduceMotion.Never }, callback);
}

export function boardSpring(toValue: number, callback?: AnimationCallback) {
  'worklet';
  return withSpring(toValue, { ...VISION_BOARD_MOTION.spring, reduceMotion: ReduceMotion.Never }, callback);
}

export function boardDelay<T>(delayMs: number, animation: T): T {
  'worklet';
  return withDelay(delayMs, animation as never, ReduceMotion.Never) as T;
}
