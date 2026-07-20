import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Haptics from "expo-haptics";

import { AnalyticsEvents, AnalyticsService } from "@/services/AnalyticsService";
import type { VisualizationCueDefinition } from "@/services/VisualizationCueManifest";
import { getVisualizeSessionAudioManifest } from "@/services/visualizeAudioManifest";
import {
  buildVisualizationSchedule,
  getVisualizationPhaseAtElapsed,
  getVisualizationPhaseProgress,
  type VisualizationDurationSeconds,
  type VisualizationPhaseId,
} from "@/utils/visualizationSchedule";

export type VisualizeEngineState =
  | "preparing"
  | "running"
  | "paused"
  | "completing"
  | "completed"
  | "ended_early";

const HAPTIC_POSITIONS: Partial<Record<VisualizationPhaseId, number>> = {
  arrive: 0.08,
  feel: 0.5,
  seal: 0.1,
  return: 0.9,
};

export function useVisualizeSessionEngine(params: {
  durationSeconds: VisualizationDurationSeconds;
  hapticsEnabled: boolean;
  onComplete: (timing: {
    startedAt: string;
    completedAt: string;
  }) => Promise<void> | void;
}) {
  const schedule = useMemo(
    () => buildVisualizationSchedule(params.durationSeconds),
    [params.durationSeconds],
  );
  const audioManifest = useMemo(
    () => getVisualizeSessionAudioManifest(params.durationSeconds),
    [params.durationSeconds],
  );
  const [state, setState] = useState<VisualizeEngineState>("preparing");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const accumulatedPausedMsRef = useRef(0);
  const reachedPhasesRef = useRef(new Set<VisualizationPhaseId>());
  const triggeredHapticsRef = useRef(new Set<VisualizationPhaseId>());
  const completionStartedRef = useRef(false);

  const calculateElapsed = useCallback((now = Date.now()) => {
    if (startedAtRef.current == null) return 0;
    const activePause =
      pausedAtRef.current == null ? 0 : now - pausedAtRef.current;
    return Math.max(
      0,
      now - startedAtRef.current - accumulatedPausedMsRef.current - activePause,
    );
  }, []);

  const pause = useCallback((source: string = "user") => {
    setState((current) => {
      if (current !== "running") return current;
      pausedAtRef.current = Date.now();
      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_PAUSED, {
        practice_mode: "visualize",
        source,
      });
      return "paused";
    });
  }, []);

  const resume = useCallback(() => {
    setState((current) => {
      if (current !== "paused" || pausedAtRef.current == null) return current;
      accumulatedPausedMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_RESUMED, {
        practice_mode: "visualize",
      });
      return "running";
    });
  }, []);

  const start = useCallback(() => {
    if (startedAtRef.current != null) return;
    startedAtRef.current = Date.now();
    setState("running");
  }, []);

  const endEarly = useCallback(() => {
    if (state === "completed" || state === "completing") return;
    setState("ended_early");
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_ENDED_EARLY, {
      practice_mode: "visualize",
      duration_seconds: params.durationSeconds,
      elapsed_seconds: Math.floor(calculateElapsed() / 1000),
    });
  }, [calculateElapsed, params.durationSeconds, state]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") pause(next);
    });
    return () => subscription.remove();
  }, [pause]);

  useEffect(() => {
    if (state !== "running") return;
    const sample = () => setElapsedMs(calculateElapsed());
    sample();
    const timer = setInterval(sample, 100);
    return () => clearInterval(timer);
  }, [calculateElapsed, state]);

  const elapsedSeconds = Math.min(params.durationSeconds, elapsedMs / 1000);
  const phase = getVisualizationPhaseAtElapsed(schedule, elapsedSeconds);
  const phaseProgress = getVisualizationPhaseProgress(phase, elapsedSeconds);
  const totalProgress = elapsedSeconds / params.durationSeconds;

  useEffect(() => {
    if (state !== "running" || reachedPhasesRef.current.has(phase.id)) return;
    reachedPhasesRef.current.add(phase.id);
    AnalyticsService.track(AnalyticsEvents.PRACTICE_PHASE_REACHED, {
      practice_mode: "visualize",
      phase: phase.id,
      duration_seconds: params.durationSeconds,
    });
  }, [params.durationSeconds, phase.id, state]);

  useEffect(() => {
    const target = HAPTIC_POSITIONS[phase.id];
    if (
      !params.hapticsEnabled ||
      state !== "running" ||
      target == null ||
      phaseProgress < target ||
      triggeredHapticsRef.current.has(phase.id)
    )
      return;
    triggeredHapticsRef.current.add(phase.id);
    void Haptics.impactAsync(
      phase.id === "feel"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    );
  }, [params.hapticsEnabled, phase.id, phaseProgress, state]);

  useEffect(() => {
    if (
      state !== "running" ||
      elapsedMs < params.durationSeconds * 1000 ||
      completionStartedRef.current
    )
      return;
    completionStartedRef.current = true;
    setState("completing");
    const startedAt = new Date(
      startedAtRef.current ?? Date.now(),
    ).toISOString();
    const completedAt = new Date().toISOString();
    void Promise.resolve(params.onComplete({ startedAt, completedAt })).finally(
      () => setState("completed"),
    );
  }, [elapsedMs, params, state]);

  const currentCue: VisualizationCueDefinition | null =
    [...audioManifest.cues]
      .reverse()
      .find((cueDefinition) => elapsedSeconds >= cueDefinition.startSeconds) ?? null;

  return {
    state,
    start,
    pause,
    resume,
    endEarly,
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
    currentCue,
  };
}
