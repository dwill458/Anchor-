import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { deepFocusPhaseAt, type DeepFocusDuration } from './deepFocusTimeline';

export type DeepFocusSessionData = {
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  startedAt: string;
  completedAt: string;
};
const now = () => typeof performance?.now === 'function' ? performance.now() : Date.now();

export function useDeepFocusSession({ duration, showTime, onSample, onComplete }: {
  duration: DeepFocusDuration;
  showTime: boolean;
  onSample: (elapsedSeconds: number) => void;
  onComplete: (data: DeepFocusSessionData) => void;
}) {
  const [state, setState] = useState<'running' | 'paused' | 'complete'>(
    AppState.currentState == null || AppState.currentState === 'active' ? 'running' : 'paused',
  );
  const stateRef = useRef(state);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState(deepFocusPhaseAt(0, duration));
  const phaseRef = useRef(phase);
  const [ending, setEnding] = useState(false);
  const accumulated = useRef(0);
  const resumedAt = useRef<number | null>(null);
  const startedAt = useRef<string | null>(null);
  const finishAt = useRef<number>(duration);
  const manualEndAt = useRef<number | null>(null);
  const done = useRef(false);
  const latest = useRef({ showTime, onSample, onComplete });
  latest.current = { showTime, onSample, onComplete };
  const readElapsed = useCallback(() => Math.min(finishAt.current,
    accumulated.current + (resumedAt.current == null ? 0 : Math.max(0, now() - resumedAt.current) / 1000)), []);

  const pause = useCallback((reason = 'user') => {
    if (stateRef.current !== 'running' || done.current) return;
    accumulated.current = readElapsed();
    resumedAt.current = null;
    stateRef.current = 'paused';
    setElapsed(accumulated.current);
    setState('paused');
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_PAUSED, { practice_mode: 'deep_prime', reason });
  }, [readElapsed]);
  const resume = useCallback(() => {
    if (stateRef.current !== 'paused' || done.current || (AppState.currentState != null && AppState.currentState !== 'active')) return;
    stateRef.current = 'running';
    setState('running');
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_RESUMED, { practice_mode: 'deep_prime' });
  }, []);
  const end = useCallback(() => {
    if (done.current || manualEndAt.current != null) return;
    const seconds = readElapsed();
    manualEndAt.current = seconds;
    finishAt.current = Math.min(duration, seconds + 1.2);
    setEnding(true);
    setElapsed(seconds);
    // A deliberate End also resolves from the paused overlay.
    stateRef.current = 'running';
    setState('running');
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_ENDED_EARLY, {
      practice_mode: 'deep_prime', planned_duration_seconds: duration, elapsed_seconds: Math.ceil(seconds),
    });
  }, [duration, readElapsed]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') pause(`app_${next}`);
    });
    return () => subscription.remove();
  }, [pause]);

  useEffect(() => {
    if (state !== 'running' || done.current) return;
    resumedAt.current = now();
    if (startedAt.current == null) {
      startedAt.current = new Date().toISOString();
      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_STARTED, { practice_mode: 'deep_prime', duration_seconds: duration });
    }
    let lastSecond = -1;
    const sample = () => {
      if (stateRef.current !== 'running' || done.current) return;
      const seconds = readElapsed();
      latest.current.onSample(seconds);
      const nextPhase = deepFocusPhaseAt(seconds, duration);
      if (phaseRef.current !== nextPhase) {
        phaseRef.current = nextPhase;
        setPhase(nextPhase);
      }
      if (latest.current.showTime && Math.floor(seconds) !== lastSecond) {
        lastSecond = Math.floor(seconds);
        setElapsed(seconds);
      }
      if (seconds < finishAt.current) return;
      done.current = true;
      stateRef.current = 'complete';
      setState('complete');
      latest.current.onComplete({
        plannedDurationSeconds: duration,
        actualDurationSeconds: manualEndAt.current == null ? duration : Math.max(1, Math.ceil(manualEndAt.current)),
        startedAt: startedAt.current!, completedAt: new Date().toISOString(),
      });
    };
    sample();
    const interval = setInterval(sample, 250);
    return () => { clearInterval(interval); };
  }, [duration, readElapsed, state]);

  return { state, phase, elapsed, ending, manualEndAt, finishAt, readElapsed, pause, resume, end };
}
