/**
 * Chart sequence engine. Pure: no Reanimated import. A `SequenceDriver`
 * supplies tweens, values and timers (the Reanimated driver lives in
 * useChartSequencer.ts), so the engine is fully testable with a fake driver.
 *
 * Guarantees:
 * - each `call` step runs exactly once (naturally or on skip);
 * - skip() applies the end state of every unfinished step in ascending `at`
 *   order, then calls onEnd once and resolves;
 * - cancel() applies nothing, never calls onEnd, leaves no timers/tweens, and
 *   resolves (never rejects);
 * - run() while busy first skips the previous run.
 */
import type { SequenceEasing, SequenceRunner, SequenceSpec, SequenceStep } from './chartMapContracts';

/** Opaque animation target (a SharedValue<number> in the app). The engine never reads it. */
export type SequenceTarget = object;

export type TweenHandle = { cancel(): void };
export type TimerHandle = unknown;

export type SequenceDriver = {
  /** Start a tween; call onDone once when it completes naturally (never after cancel()). */
  startTween(
    target: SequenceTarget,
    from: number,
    to: number,
    duration: number,
    easing: SequenceEasing,
    onDone: () => void
  ): TweenHandle;
  setValue(target: SequenceTarget, value: number): void;
  getValue(target: SequenceTarget): number;
  setTimer(ms: number, fn: () => void): TimerHandle;
  clearTimer(handle: TimerHandle): void;
};

export type SequenceRunnerOptions = {
  reducedMotion?: boolean | (() => boolean);
  /** Multiplies every step offset and tween duration. Default 1. */
  timeScale?: number;
};

type StepState = {
  step: SequenceStep;
  index: number;
  status: 'pending' | 'running' | 'done';
  timer: TimerHandle | null;
  hasTimer: boolean;
  tween: TweenHandle | null;
  /** Safety-net timer: a tween completes at most duration + SAFETY_MS after it starts. */
  safety: TimerHandle | null;
  hasSafety: boolean;
};

const SAFETY_MS = 250;

type ActiveRun = {
  steps: StepState[];
  onEnd?: () => void;
  ended: boolean;
  /** True while skip/cancel is tearing down handles: driver callbacks from cancelled tweens are ignored. */
  clearing: boolean;
  resolve: () => void;
};

export function createSequenceRunner(driver: SequenceDriver, opts: SequenceRunnerOptions = {}): SequenceRunner {
  let active: ActiveRun | null = null;

  const isReduced = (): boolean =>
    typeof opts.reducedMotion === 'function' ? opts.reducedMotion() : Boolean(opts.reducedMotion);
  const scale = (): number => (typeof opts.timeScale === 'number' && opts.timeScale >= 0 ? opts.timeScale : 1);

  const clearSafety = (s: StepState): void => {
    if (s.hasSafety) {
      driver.clearTimer(s.safety);
      s.hasSafety = false;
      s.safety = null;
    }
  };

  const clearAll = (run: ActiveRun): void => {
    run.clearing = true;
    for (const s of run.steps) {
      clearSafety(s);
      if (s.hasTimer) {
        driver.clearTimer(s.timer);
        s.hasTimer = false;
        s.timer = null;
      }
      if (s.tween) {
        const handle = s.tween;
        s.tween = null;
        handle.cancel();
      }
    }
    run.clearing = false;
  };

  const finish = (run: ActiveRun, callOnEnd: boolean): void => {
    if (run.ended) return;
    run.ended = true;
    if (active === run) active = null;
    if (callOnEnd) {
      try {
        run.onEnd?.();
      } catch {
        /* a throwing onEnd must not leave the runner busy */
      }
    }
    run.resolve();
  };

  const maybeFinish = (run: ActiveRun): void => {
    if (!run.ended && run.steps.every((s) => s.status === 'done')) finish(run, true);
  };

  const runCall = (s: StepState & { step: Extract<SequenceStep, { kind: 'call' }> }): void => {
    if (s.status === 'done') return;
    s.status = 'done';
    try {
      s.step.run();
    } catch {
      /* one failing side effect must not stall the sequence */
    }
  };

  const fire = (run: ActiveRun, s: StepState, reduced: boolean, k: number): void => {
    if (run.ended || s.status !== 'pending') return;
    s.hasTimer = false;
    s.timer = null;
    const step = s.step;
    if (step.kind === 'call') {
      runCall(s as StepState & { step: Extract<SequenceStep, { kind: 'call' }> });
    } else {
      const duration = step.duration * k;
      if (reduced || !(duration > 0)) {
        if (step.from !== undefined) driver.setValue(step.target, step.from);
        driver.setValue(step.target, step.to);
        s.status = 'done';
      } else {
        // Supersede: any other tween still running on the same target is done.
        for (const other of run.steps) {
          if (other !== s && other.status === 'running' && other.step.kind === 'tween' && other.step.target === step.target) {
            other.status = 'done';
            clearSafety(other);
            const handle = other.tween;
            other.tween = null;
            handle?.cancel();
          }
        }
        s.status = 'running';
        const from = step.from !== undefined ? step.from : driver.getValue(step.target);
        s.tween = driver.startTween(step.target, from, step.to, duration, step.easing ?? 'inOut', () => {
          if (run.ended || run.clearing || s.status !== 'running') return;
          clearSafety(s);
          s.tween = null;
          s.status = 'done';
          maybeFinish(run);
        });
        if (s.status === 'running') {
          s.hasSafety = true;
          s.safety = driver.setTimer(duration + SAFETY_MS, () => {
            s.hasSafety = false;
            s.safety = null;
            if (run.ended || s.status !== 'running') return;
            const handle = s.tween;
            s.tween = null;
            s.status = 'done';
            handle?.cancel();
            driver.setValue(step.target, step.to);
            maybeFinish(run);
          });
        }
        return;
      }
    }
    maybeFinish(run);
  };

  const skip = (): void => {
    const run = active;
    if (!run || run.ended) return;
    clearAll(run);
    const ordered = [...run.steps].sort((a, b) => a.step.at - b.step.at || a.index - b.index);
    for (const s of ordered) {
      if (s.status === 'done') continue;
      if (s.step.kind === 'tween') {
        driver.setValue(s.step.target, s.step.to);
        s.status = 'done';
      } else if (s.step.transient) {
        s.status = 'done';
      } else {
        runCall(s as StepState & { step: Extract<SequenceStep, { kind: 'call' }> });
      }
    }
    finish(run, true);
  };

  const cancel = (): void => {
    const run = active;
    if (!run || run.ended) return;
    clearAll(run);
    finish(run, false);
  };

  const runSpec = (spec: SequenceSpec): Promise<void> => {
    if (active) skip();
    return new Promise<void>((resolve) => {
      const run: ActiveRun = {
        steps: spec.steps.map((step, index) => ({ step, index, status: 'pending', timer: null, hasTimer: false, tween: null, safety: null, hasSafety: false })),
        onEnd: spec.onEnd,
        ended: false,
        clearing: false,
        resolve,
      };
      active = run;
      if (run.steps.length === 0) {
        finish(run, true);
        return;
      }
      const reduced = isReduced();
      const k = scale();
      const immediate: StepState[] = [];
      for (const s of run.steps) {
        const ms = Math.max(0, s.step.at * k);
        if (ms <= 0) immediate.push(s);
        else {
          s.hasTimer = true;
          s.timer = driver.setTimer(ms, () => fire(run, s, reduced, k));
        }
      }
      // at 0: start synchronously, in declaration order.
      for (const s of immediate) fire(run, s, reduced, k);
    });
  };

  return {
    run: runSpec,
    skip,
    cancel,
    isBusy: () => active !== null && !active.ended,
  };
}
