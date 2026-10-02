/**
 * Reanimated driver for the chart sequence engine (chartSequence.ts).
 *
 * - One runner per mount (created once, `cancel()`ed on unmount: no timers,
 *   tweens or `call` steps survive the screen).
 * - Tweens are `withTiming` on the shared value with `ReduceMotion.Never`
 *   (reduced motion is decided by the app, see chartMotion.ts, never by the
 *   implicit Reanimated check).
 * - The completion callback runs on the UI thread, so it reaches the JS
 *   engine through `runOnJS`, exactly like the other withTiming callbacks in
 *   this codebase. `finished` is false when the animation was cancelled, so a
 *   cancelled tween never reports done.
 * - Reduced motion is read through a ref at tween start: changes apply to the
 *   next tween, and any tween is clamped to a short linear crossfade
 *   (`CHART_MAP_REDUCED_FADE`). The builders in chartMapSequences.ts already
 *   leave out camera moves and pulses; the runner is deliberately NOT given
 *   the engine's own reducedMotion flag, because that would collapse the 180 ms
 *   crossfades into hard cuts.
 */
import { useEffect, useRef } from 'react';
import { cancelAnimation, Easing, ReduceMotion, runOnJS, withTiming, type SharedValue } from 'react-native-reanimated';
import { CHART_MAP_REDUCED_FADE, CHART_MAP_TIMING } from '../chartMotion';
import type { SequenceEasing, SequenceRunner } from './chartMapContracts';
import { createSequenceRunner, type SequenceDriver, type SequenceTarget } from './chartSequence';

/** Prototype easings: easeIO = cubic in-out, easeO = cubic out. */
const EASINGS: Record<SequenceEasing, (t: number) => number> = {
  inOut: Easing.inOut(Easing.cubic),
  out: Easing.out(Easing.cubic),
  linear: Easing.linear,
};

const asShared = (target: SequenceTarget): SharedValue<number> => target as SharedValue<number>;

export function createReanimatedSequenceDriver(isReduced: () => boolean): SequenceDriver {
  return {
    startTween(target, from, to, duration, easing, onDone) {
      const shared = asShared(target);
      const reduced = isReduced();
      let cancelled = false;
      const done = () => {
        if (!cancelled) onDone();
      };
      // Pin the start value (explicit `from`, or the current value the engine read).
      cancelAnimation(shared);
      shared.value = from;
      shared.value = withTiming(
        to,
        {
          duration: reduced ? Math.min(duration, CHART_MAP_REDUCED_FADE) : duration,
          easing: EASINGS[reduced ? 'linear' : easing],
          reduceMotion: ReduceMotion.Never,
        },
        (finished) => {
          'worklet';
          if (finished) runOnJS(done)();
        },
      );
      return {
        cancel() {
          cancelled = true;
          cancelAnimation(shared);
        },
      };
    },
    setValue(target, value) {
      const shared = asShared(target);
      cancelAnimation(shared);
      shared.value = value;
    },
    getValue(target) {
      return asShared(target).value;
    },
    setTimer(ms, fn) {
      return setTimeout(fn, ms);
    },
    clearTimer(handle) {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
  };
}

export function useChartSequencer(reducedMotion: boolean): SequenceRunner {
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  const runnerRef = useRef<SequenceRunner | null>(null);
  if (runnerRef.current === null) {
    runnerRef.current = createSequenceRunner(createReanimatedSequenceDriver(() => reducedRef.current), {
      timeScale: CHART_MAP_TIMING.timeScale,
    });
  }
  const runner = runnerRef.current;

  useEffect(() => () => runner.cancel(), [runner]);

  return runner;
}
