import { useCallback, useEffect, useRef, useState } from 'react';

import { useSessionAudio, type ManagedSessionAudioPlayer } from '@/hooks/useSessionAudio';
import {
  getAmbientAudioTrackId,
  getGuidedAudioTrackId,
  type ResolvedSessionAudioPlan,
  type ResolvedVoiceCue,
} from '@/services/SessionAudioManifest';
import {
  trackAmbientAudioLoadFailed,
  trackGuidedAudioLoadFailed,
} from '@/services/SessionAudioAnalytics';
import type { VisualizeSessionAudioManifest } from '@/services/visualizeAudioManifest';
import {
  getNextDueVisualizeCue,
  getNextUnhandledVisualizeCue,
  getVisualizeAmbientRestingVolume,
  getVisualizeFinalFadeRemainingMs,
  VISUALIZE_AMBIENT_LEVELS,
} from './visualizeAudioState';

const FADE_STEP_MS = 40;
const EARLY_EXIT_FADE_MS = 350;

type PreparedCue = {
  cue: ResolvedVoiceCue;
  player: ManagedSessionAudioPlayer;
};

export function useVisualizeSessionAudio(params: {
  plan: ResolvedSessionAudioPlan;
  manifest: VisualizeSessionAudioManifest;
  elapsedMs: number;
  isActive: boolean;
  isComplete: boolean;
  onInterruption: () => void;
}) {
  const { createSessionAudioPlayer } = useSessionAudio();
  const [, setAudioTick] = useState(0);
  const ambientRef = useRef<ManagedSessionAudioPlayer | null>(null);
  const activeVoiceRef = useRef<PreparedCue | null>(null);
  const preparedVoiceRef = useRef<PreparedCue | null>(null);
  const handledCueIdsRef = useRef(new Set<string>());
  const ambientFadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambientFadeFinishRef = useRef<(() => void) | null>(null);
  const stopInFlightRef = useRef<Promise<void> | null>(null);
  const ambientVolumeRef = useRef(0);
  const voiceActiveRef = useRef(false);
  const previousActiveRef = useRef(false);
  const hasStartedRef = useRef(false);
  const finalFadeStartedRef = useRef(false);
  const ambientWasPlayingRef = useRef(false);
  const isActiveRef = useRef(params.isActive);
  const intentionalPauseRef = useRef(false);
  const earlyExitInProgressRef = useRef(false);

  isActiveRef.current = params.isActive;

  const clearAmbientFade = useCallback(() => {
    if (ambientFadeRef.current) clearInterval(ambientFadeRef.current);
    ambientFadeRef.current = null;
    const finish = ambientFadeFinishRef.current;
    ambientFadeFinishRef.current = null;
    finish?.();
  }, []);

  const setAmbientVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    ambientVolumeRef.current = clamped;
    ambientRef.current?.setVolume(clamped);
  }, []);

  const fadeAmbientTo = useCallback((target: number, durationMs: number, onFinish?: () => void) => {
    if (!ambientRef.current) {
      onFinish?.();
      return;
    }
    clearAmbientFade();
    if (!ambientRef.current) {
      onFinish?.();
      return;
    }
    const from = ambientVolumeRef.current;
    const to = Math.max(0, Math.min(1, target));
    const steps = Math.max(1, Math.ceil(durationMs / FADE_STEP_MS));
    let step = 0;
    if (durationMs <= 0 || Math.abs(from - to) < 0.001) {
      setAmbientVolume(to);
      onFinish?.();
      return;
    }
    ambientFadeFinishRef.current = onFinish ?? null;
    ambientFadeRef.current = setInterval(() => {
      step += 1;
      // Equal-power-style easing avoids an audible linear dip at low levels.
      const progress = Math.sin((Math.min(1, step / steps) * Math.PI) / 2);
      setAmbientVolume(from + (to - from) * progress);
      if (step >= steps) {
        if (ambientFadeRef.current) clearInterval(ambientFadeRef.current);
        ambientFadeRef.current = null;
        const finish = ambientFadeFinishRef.current;
        ambientFadeFinishRef.current = null;
        finish?.();
      }
    }, FADE_STEP_MS);
  }, [clearAmbientFade, setAmbientVolume]);

  const stopPreparedVoice = useCallback(() => {
    const prepared = preparedVoiceRef.current;
    preparedVoiceRef.current = null;
    prepared?.player.stop();
  }, []);

  const stopActiveVoice = useCallback(() => {
    const active = activeVoiceRef.current;
    activeVoiceRef.current = null;
    voiceActiveRef.current = false;
    active?.player.stop();
  }, []);

  const stopAmbient = useCallback((fadeMs = 0) => new Promise<void>(resolvePromise => {
    const player = ambientRef.current;
    if (!player) {
      resolvePromise();
      return;
    }
    const finish = () => {
      if (ambientRef.current === player) {
        ambientRef.current = null;
        ambientWasPlayingRef.current = false;
        ambientVolumeRef.current = 0;
        player.stop();
      }
      resolvePromise();
    };
    if (fadeMs > 0) fadeAmbientTo(0, fadeMs, finish);
    else finish();
  }), [fadeAmbientTo]);

  const restoreAmbient = useCallback(() => {
    if (finalFadeStartedRef.current) return;
    fadeAmbientTo(
      getVisualizeAmbientRestingVolume(params.plan.shouldPlayVoice),
      params.manifest.cues[0]?.duckingEnvelope.releaseMs ?? 400,
    );
  }, [fadeAmbientTo, params.manifest.cues, params.plan.shouldPlayVoice]);

  const prepareCue = useCallback((cue: ResolvedVoiceCue | null) => {
    if (
      !cue ||
      earlyExitInProgressRef.current ||
      !params.plan.shouldPlayVoice ||
      handledCueIdsRef.current.has(cue.phaseId)
    ) return;
    if (preparedVoiceRef.current?.cue.phaseId === cue.phaseId) return;
    stopPreparedVoice();
    const player = createSessionAudioPlayer(cue.track.asset, {
      trackId: getGuidedAudioTrackId(cue.track),
      volume: cue.track.playbackGain,
      onFailure: () => {
        handledCueIdsRef.current.add(cue.phaseId);
        trackGuidedAudioLoadFailed(params.plan, cue.phaseId);
        if (preparedVoiceRef.current?.cue.phaseId === cue.phaseId) preparedVoiceRef.current = null;
        if (activeVoiceRef.current?.cue.phaseId === cue.phaseId) {
          activeVoiceRef.current = null;
          voiceActiveRef.current = false;
          restoreAmbient();
        }
        setAudioTick(value => value + 1);
      },
      onFinish: () => {
        if (activeVoiceRef.current?.cue.phaseId === cue.phaseId) {
          activeVoiceRef.current = null;
          voiceActiveRef.current = false;
          restoreAmbient();
          setAudioTick(value => value + 1);
        }
      },
    });
    if (player) preparedVoiceRef.current = { cue, player };
    else handledCueIdsRef.current.add(cue.phaseId);
  }, [createSessionAudioPlayer, params.plan, restoreAmbient, stopPreparedVoice]);

  const playCue = useCallback((cue: ResolvedVoiceCue) => {
    if (
      earlyExitInProgressRef.current ||
      handledCueIdsRef.current.has(cue.phaseId) ||
      voiceActiveRef.current
    ) return;
    if (preparedVoiceRef.current?.cue.phaseId !== cue.phaseId) prepareCue(cue);
    const prepared = preparedVoiceRef.current;
    if (!prepared || prepared.cue.phaseId !== cue.phaseId) {
      handledCueIdsRef.current.add(cue.phaseId);
      return;
    }
    preparedVoiceRef.current = null;
    activeVoiceRef.current = prepared;
    voiceActiveRef.current = true;
    handledCueIdsRef.current.add(cue.phaseId);
    fadeAmbientTo(
      VISUALIZE_AMBIENT_LEVELS.guidedDucked,
      params.manifest.cues.find(item => item.id === cue.phaseId)?.duckingEnvelope.attackMs ?? 160,
    );
    prepared.player.play();

    const nextDefinition = getNextUnhandledVisualizeCue(params.manifest.cues, handledCueIdsRef.current);
    const next = nextDefinition
      ? params.plan.voiceCues.find(item => item.phaseId === nextDefinition.id) ?? null
      : null;
    prepareCue(next);
  }, [fadeAmbientTo, params.manifest.cues, params.plan.voiceCues, prepareCue]);

  const fadeOutAndStop = useCallback((durationMs = EARLY_EXIT_FADE_MS): Promise<void> => {
    if (stopInFlightRef.current) return stopInFlightRef.current;
    earlyExitInProgressRef.current = true;
    intentionalPauseRef.current = true;
    clearAmbientFade();
    stopActiveVoice();
    stopPreparedVoice();
    const stopOperation = stopAmbient(durationMs);
    stopInFlightRef.current = stopOperation;
    return stopOperation;
  }, [clearAmbientFade, stopActiveVoice, stopAmbient, stopPreparedVoice]);

  useEffect(() => {
    handledCueIdsRef.current = new Set();
    previousActiveRef.current = false;
    hasStartedRef.current = false;
    finalFadeStartedRef.current = false;
    earlyExitInProgressRef.current = false;
    stopInFlightRef.current = null;
    intentionalPauseRef.current = true;
    clearAmbientFade();
    stopActiveVoice();
    stopPreparedVoice();
    void stopAmbient(0);

    if (params.plan.shouldPlayAmbient && params.plan.ambientTrack) {
      ambientRef.current = createSessionAudioPlayer(params.plan.ambientTrack.asset, {
        loop: false,
        trackId: getAmbientAudioTrackId(params.plan.ambientTrack),
        volume: 0,
        onFailure: () => trackAmbientAudioLoadFailed(params.plan),
        onStatus: status => {
          if (status.playing) ambientWasPlayingRef.current = true;
          if (
            ambientWasPlayingRef.current &&
            !status.playing &&
            !status.didJustFinish &&
            isActiveRef.current &&
            !intentionalPauseRef.current
          ) {
            ambientWasPlayingRef.current = false;
            params.onInterruption();
          }
        },
      });
    }
    if (params.plan.shouldPlayVoice) prepareCue(params.plan.voiceCues[0] ?? null);
    intentionalPauseRef.current = false;
  }, [
    clearAmbientFade,
    createSessionAudioPlayer,
    params.onInterruption,
    params.plan,
    prepareCue,
    stopActiveVoice,
    stopAmbient,
    stopPreparedVoice,
  ]);

  useEffect(() => {
    if (params.isComplete) {
      intentionalPauseRef.current = true;
      stopActiveVoice();
      stopPreparedVoice();
      void stopAmbient(0);
      previousActiveRef.current = false;
      return;
    }
    if (!params.isActive) {
      if (earlyExitInProgressRef.current) return;
      intentionalPauseRef.current = true;
      clearAmbientFade();
      ambientRef.current?.pause();
      activeVoiceRef.current?.player.pause();
      previousActiveRef.current = false;
      return;
    }

    intentionalPauseRef.current = false;
    if (!previousActiveRef.current) {
      const resting = getVisualizeAmbientRestingVolume(params.plan.shouldPlayVoice);
      const resumeTarget = voiceActiveRef.current
        ? VISUALIZE_AMBIENT_LEVELS.guidedDucked
        : resting;
      if (ambientRef.current) {
        if (hasStartedRef.current && params.elapsedMs > 200) {
          void ambientRef.current.seekTo(params.elapsedMs / 1_000);
        }
        ambientRef.current.play();
        ambientWasPlayingRef.current = true;
        const initialFadeRemaining = Math.max(0, params.manifest.ambient.fadeInMs - params.elapsedMs);
        fadeAmbientTo(resumeTarget, initialFadeRemaining);
      }
      activeVoiceRef.current?.player.play();
      previousActiveRef.current = true;
      hasStartedRef.current = true;
    }

    const remainingFadeMs = getVisualizeFinalFadeRemainingMs(
      params.manifest.durationSeconds,
      params.manifest.ambient.fadeOutMs,
      params.elapsedMs,
    );
    if (remainingFadeMs != null) {
      finalFadeStartedRef.current = true;
      clearAmbientFade();
      const fadeProgress = 1 - remainingFadeMs / params.manifest.ambient.fadeOutMs;
      const baseVolume = voiceActiveRef.current
        ? VISUALIZE_AMBIENT_LEVELS.guidedDucked
        : getVisualizeAmbientRestingVolume(params.plan.shouldPlayVoice);
      setAmbientVolume(baseVolume * Math.cos(clamp01(fadeProgress) * Math.PI / 2));
    }

    if (!voiceActiveRef.current) {
      const definition = getNextDueVisualizeCue(
        params.manifest.cues,
        params.elapsedMs,
        handledCueIdsRef.current,
      );
      if (definition) {
        const cue = params.plan.voiceCues.find(item => item.phaseId === definition.id);
        if (cue) playCue(cue);
        else handledCueIdsRef.current.add(definition.id);
      }
    }
  }, [
    clearAmbientFade,
    fadeAmbientTo,
    params.elapsedMs,
    params.isActive,
    params.isComplete,
    params.manifest,
    params.plan.shouldPlayVoice,
    params.plan.voiceCues,
    playCue,
    setAmbientVolume,
    stopActiveVoice,
    stopAmbient,
    stopPreparedVoice,
  ]);

  useEffect(() => () => {
    intentionalPauseRef.current = true;
    clearAmbientFade();
    stopActiveVoice();
    stopPreparedVoice();
    void stopAmbient(0);
  }, [clearAmbientFade, stopActiveVoice, stopAmbient, stopPreparedVoice]);

  return {
    fadeOutAndStop,
    hasVoiceGuidance: params.plan.shouldPlayVoice,
  };
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
