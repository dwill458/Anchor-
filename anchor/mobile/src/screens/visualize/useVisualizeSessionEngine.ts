import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import {
  getVisualizePromptAtElapsed,
  type VisualizeDuration,
  type VisualizePhaseId,
  getVisualizeSessionConfig,
} from './visualizeSessionConfig';
import {
  buildVisualizationSchedule,
  getVisualizationPhaseAtElapsed,
  getVisualizationPhaseProgress,
  type VisualizationDurationSeconds,
} from '@/utils/visualizationSchedule';

export type VisualizeEngineState =
  | 'preparing'
  | 'running'
  | 'paused'
  | 'completing'
  | 'completed'
  | 'ended_early';

export type VisualizeSessionTiming = {
  startedAt: string;
  completedAt: string;
};

/** The only clock used for elapsed session time. It is monotonic on devices. */
export const getVisualizeMonotonicNow = (): number =>
  typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();

const getWallClockNow = (): number => Date.now();
const CLOCK_TICK_MS = 100;

// Choose is the one defining in-session moment. Completion haptics are owned
// by the completion transition so they cannot repeat on a render.
const HAPTIC_POSITIONS: Partial<Record<VisualizePhaseId, number>> = {
  choose: 0.52,
};

export function useVisualizeSessionEngine(params: {
  durationSeconds: VisualizationDurationSeconds;
  hapticsEnabled: boolean;
  onComplete: (timing: VisualizeSessionTiming) => Promise<void> | void;
  /** Injected only by deterministic tests. */
  clock?: () => number;
  /** Injected only by deterministic tests. */
  wallClock?: () => number;
}) {
  const schedule = useMemo(
    () => buildVisualizationSchedule(params.durationSeconds),
    [params.durationSeconds],
  );
  const sessionConfig = useMemo(
    () => getVisualizeSessionConfig(params.durationSeconds as VisualizeDuration),
    [params.durationSeconds],
  );
  const readClock = params.clock ?? getVisualizeMonotonicNow;
  const readWallClock = params.wallClock ?? getWallClockNow;

  const [state, setState] = useState<VisualizeEngineState>('preparing');
  const [elapsedMs, setElapsedMs] = useState(0);
  const stateRef = useRef<VisualizeEngineState>('preparing');
  const startedAtMonotonicRef = useRef<number | null>(null);
  const startedAtWallClockRef = useRef<number | null>(null);
  const pausedAtMonotonicRef = useRef<number | null>(null);
  const accumulatedPausedMsRef = useRef(0);
  const reachedPhasesRef = useRef(new Set<VisualizePhaseId>());
  const triggeredHapticsRef = useRef(new Set<VisualizePhaseId>());
  const completionStartedRef = useRef(false);
  const completionPromiseRef = useRef<Promise<void> | null>(null);

  stateRef.current = state;

  const calculateElapsed = useCallback(
    (now = readClock()) => {
      if (startedAtMonotonicRef.current == null) return 0;
      const activePause =
        pausedAtMonotonicRef.current == null
          ? 0
          : Math.max(0, now - pausedAtMonotonicRef.current);
      return Math.max(
        0,
        now -
          startedAtMonotonicRef.current -
          accumulatedPausedMsRef.current -
          activePause,
      );
    },
    [readClock],
  );

  const pause = useCallback(
    (source: string = 'user') => {
      if (stateRef.current !== 'running') return;
      const now = readClock();
      pausedAtMonotonicRef.current = now;
      setElapsedMs(calculateElapsed(now));
      setState('paused');
      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_PAUSED, {
        practice_mode: 'visualize',
        source,
      });
    },
    [calculateElapsed, readClock],
  );

  const resume = useCallback(() => {
    if (
      stateRef.current !== 'paused' ||
      pausedAtMonotonicRef.current == null
    )
      return;
    const now = readClock();
    accumulatedPausedMsRef.current +=
      now - pausedAtMonotonicRef.current;
    pausedAtMonotonicRef.current = null;
    setElapsedMs(calculateElapsed(now));
    setState('running');
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_RESUMED, {
      practice_mode: 'visualize',
    });
  }, [calculateElapsed, readClock]);

  const start = useCallback(() => {
    if (startedAtMonotonicRef.current != null) return;
    startedAtMonotonicRef.current = readClock();
    startedAtWallClockRef.current = readWallClock();
    setElapsedMs(0);
    setState('running');
  }, [readClock, readWallClock]);

  const endEarly = useCallback(() => {
    if (
      stateRef.current === 'completed' ||
      stateRef.current === 'completing' ||
      stateRef.current === 'ended_early'
    )
      return;
    const elapsed = Math.min(
      params.durationSeconds * 1_000,
      calculateElapsed(),
    );
    setElapsedMs(elapsed);
    setState('ended_early');
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_ENDED_EARLY, {
      practice_mode: 'visualize',
      duration_seconds: params.durationSeconds,
      elapsed_seconds: Math.floor(elapsed / 1_000),
    });
  }, [calculateElapsed, params.durationSeconds]);

  const markCompleted = useCallback(() => {
    if (stateRef.current !== 'completing') return;
    setState('completed');
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') pause(`app_${nextState}`);
    });
    return () => subscription.remove();
  }, [pause]);

  useEffect(() => {
    if (state !== 'running') return;
    const sample = () => {
      const durationMs = params.durationSeconds * 1_000;
      setElapsedMs(Math.min(durationMs, calculateElapsed()));
    };
    sample();
    const timer = setInterval(sample, CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [calculateElapsed, params.durationSeconds, state]);

  const elapsedSeconds = Math.min(params.durationSeconds, elapsedMs / 1_000);
  const phase = getVisualizationPhaseAtElapsed(schedule, elapsedSeconds);
  const phaseProgress = getVisualizationPhaseProgress(phase, elapsedSeconds);
  const totalProgress = elapsedSeconds / params.durationSeconds;
  const currentPrompt = getVisualizePromptAtElapsed(
    sessionConfig,
    elapsedMs,
  );

  useEffect(() => {
    if (state !== 'running' || reachedPhasesRef.current.has(phase.id)) return;
    reachedPhasesRef.current.add(phase.id);
    AnalyticsService.track(AnalyticsEvents.PRACTICE_PHASE_REACHED, {
      practice_mode: 'visualize',
      phase: phase.id,
      duration_seconds: params.durationSeconds,
    });
  }, [params.durationSeconds, phase.id, state]);

  useEffect(() => {
    const target = HAPTIC_POSITIONS[phase.id];
    if (
      !params.hapticsEnabled ||
      state !== 'running' ||
      target == null ||
      phaseProgress < target ||
      triggeredHapticsRef.current.has(phase.id)
    )
      return;
    triggeredHapticsRef.current.add(phase.id);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [params.hapticsEnabled, phase.id, phaseProgress, state]);

  useEffect(() => {
    if (
      state !== 'running' ||
      elapsedMs < params.durationSeconds * 1_000 ||
      completionStartedRef.current
    )
      return;

    completionStartedRef.current = true;
    const startedAt = new Date(
      startedAtWallClockRef.current ?? readWallClock(),
    ).toISOString();
    const completedAt = new Date(readWallClock()).toISOString();
    setElapsedMs(params.durationSeconds * 1_000);
    const completionPromise = Promise.resolve()
      .then(() => params.onComplete({ startedAt, completedAt }))
      .catch(() => undefined);
    completionPromiseRef.current = completionPromise;
    setState('completing');
  }, [
    elapsedMs,
    params.durationSeconds,
    params.onComplete,
    readWallClock,
    state,
  ]);

  return {
    state,
    start,
    pause,
    resume,
    endEarly,
    markCompleted,
    completionPromise: completionPromiseRef.current,
    elapsedMs,
    elapsedSeconds,
    remainingSeconds: Math.max(
      0,
      Math.ceil(params.durationSeconds - elapsedSeconds),
    ),
    phase,
    phaseProgress,
    totalProgress,
    schedule,
    currentPrompt,
  };
}
