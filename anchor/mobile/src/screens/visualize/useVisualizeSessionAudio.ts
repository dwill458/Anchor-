import { useCallback, useEffect, useRef, useState } from 'react';

import {
  useSessionAudio,
  type ManagedSessionAudioPlayer,
} from '@/hooks/useSessionAudio';
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
  VISUALIZE_AMBIENT_LEVELS,
} from './visualizeAudioState';

const COMPLETION_TONE = require('../../assets/sounds/prime-complete.wav');
const FADE_STEP_MS = 40;
const EARLY_EXIT_FADE_MS = 350;

type PreparedCue = {
  cue: ResolvedVoiceCue;
  player: ManagedSessionAudioPlayer;
};

/**
 * Owns every mutable player for one Visualize route instance. The session
 * screen never keys or remounts this hook on phase/prompt changes.
 */
export function useVisualizeSessionAudio(params: {
  plan: ResolvedSessionAudioPlan;
  manifest: VisualizeSessionAudioManifest;
  elapsedMs: number;
  isActive: boolean;
  isCompleting?: boolean;
  isComplete: boolean;
  onInterruption: () => void;
}) {
  const { createSessionAudioPlayer } = useSessionAudio();
  const [, setAudioTick] = useState(0);
  const ambientRef = useRef<ManagedSessionAudioPlayer | null>(null);
  const activeVoiceRef = useRef<PreparedCue | null>(null);
  const preparedVoiceRef = useRef<PreparedCue | null>(null);
  const completionToneRef = useRef<ManagedSessionAudioPlayer | null>(null);
  const handledCueIdsRef = useRef(new Set<string>());
  const ambientFadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambientFadeFinishRef = useRef<(() => void) | null>(null);
  const earlyStopInFlightRef = useRef<Promise<void> | null>(null);
  const completionInFlightRef = useRef<Promise<void> | null>(null);
  const ambientVolumeRef = useRef(0);
  const voiceActiveRef = useRef(false);
  const previousActiveRef = useRef(false);
  const hasStartedRef = useRef(false);
  const ambientWasPlayingRef = useRef(false);
  const isActiveRef = useRef(params.isActive);
  const intentionalPauseRef = useRef(false);
  const earlyExitInProgressRef = useRef(false);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);

  isActiveRef.current = params.isActive;

  const isCurrent = useCallback(
    (generation: number) => mountedRef.current && generationRef.current === generation,
    [],
  );

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

  const fadeAmbientTo = useCallback(
    (target: number, durationMs: number, onFinish?: () => void) => {
      const player = ambientRef.current;
      if (!player) {
        onFinish?.();
        return;
      }
      clearAmbientFade();
      const from = ambientVolumeRef.current;
      const to = Math.max(0, Math.min(1, target));
      const steps = Math.max(1, Math.ceil(durationMs / FADE_STEP_MS));
      if (durationMs <= 0 || Math.abs(from - to) < 0.001) {
        setAmbientVolume(to);
        onFinish?.();
        return;
      }
      let step = 0;
      ambientFadeFinishRef.current = onFinish ?? null;
      ambientFadeRef.current = setInterval(() => {
        step += 1;
        // Equal-power-style easing prevents the low-level dip of a linear fade.
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
    },
    [clearAmbientFade, setAmbientVolume],
  );

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

  const stopCompletionTone = useCallback(() => {
    const tone = completionToneRef.current;
    completionToneRef.current = null;
    tone?.stop();
  }, []);

  const stopAmbient = useCallback(
    (fadeMs = 0): Promise<void> =>
      new Promise((resolve) => {
        const player = ambientRef.current;
        if (!player) {
          resolve();
          return;
        }
        const finish = () => {
          if (ambientRef.current === player) {
            ambientRef.current = null;
            ambientWasPlayingRef.current = false;
            ambientVolumeRef.current = 0;
            player.stop();
          }
          resolve();
        };
        if (fadeMs > 0) fadeAmbientTo(0, fadeMs, finish);
        else finish();
      }),
    [fadeAmbientTo],
  );

  const restoreAmbient = useCallback(() => {
    if (completionInFlightRef.current || earlyExitInProgressRef.current) return;
    fadeAmbientTo(
      getVisualizeAmbientRestingVolume(params.plan.shouldPlayVoice),
      params.manifest.cues[0]?.duckingEnvelope.releaseMs ?? 400,
    );
  }, [
    fadeAmbientTo,
    params.manifest.cues,
    params.plan.shouldPlayVoice,
  ]);

  const prepareCue = useCallback(
    (cue: ResolvedVoiceCue | null, generation = generationRef.current) => {
      if (
        !cue ||
        !isCurrent(generation) ||
        earlyExitInProgressRef.current ||
        completionInFlightRef.current ||
        !params.plan.shouldPlayVoice ||
        handledCueIdsRef.current.has(cue.phaseId)
      )
        return;
      if (preparedVoiceRef.current?.cue.phaseId === cue.phaseId) return;
      stopPreparedVoice();
      const player = createSessionAudioPlayer(cue.track.asset, {
        trackId: getGuidedAudioTrackId(cue.track),
        volume: cue.track.playbackGain,
        onFailure: () => {
          if (!isCurrent(generation)) return;
          handledCueIdsRef.current.add(cue.phaseId);
          trackGuidedAudioLoadFailed(params.plan, cue.phaseId);
          if (preparedVoiceRef.current?.cue.phaseId === cue.phaseId)
            preparedVoiceRef.current = null;
          if (activeVoiceRef.current?.cue.phaseId === cue.phaseId) {
            activeVoiceRef.current = null;
            voiceActiveRef.current = false;
            restoreAmbient();
          }
          setAudioTick((value) => value + 1);
        },
        onFinish: () => {
          if (!isCurrent(generation)) return;
          if (activeVoiceRef.current?.cue.phaseId === cue.phaseId) {
            activeVoiceRef.current = null;
            voiceActiveRef.current = false;
            restoreAmbient();
            setAudioTick((value) => value + 1);
          }
        },
      });
      if (player) preparedVoiceRef.current = { cue, player };
      else handledCueIdsRef.current.add(cue.phaseId);
    },
    [
      createSessionAudioPlayer,
      isCurrent,
      params.plan,
      restoreAmbient,
      stopPreparedVoice,
    ],
  );

  const playCue = useCallback(
    (cue: ResolvedVoiceCue) => {
      if (
        earlyExitInProgressRef.current ||
        completionInFlightRef.current ||
        handledCueIdsRef.current.has(cue.phaseId) ||
        voiceActiveRef.current
      )
        return;
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
        params.manifest.cues.find((item) => item.id === cue.phaseId)
          ?.duckingEnvelope.attackMs ?? 160,
      );
      prepared.player.play();

      const nextDefinition = getNextUnhandledVisualizeCue(
        params.manifest.cues,
        handledCueIdsRef.current,
      );
      const next = nextDefinition
        ? params.plan.voiceCues.find(
            (item) => item.phaseId === nextDefinition.id,
          ) ?? null
        : null;
      prepareCue(next);
    },
    [
      fadeAmbientTo,
      params.manifest.cues,
      params.plan.voiceCues,
      prepareCue,
    ],
  );

  const finishCompletion = useCallback(
    (durationMs = params.manifest.ambient.fadeOutMs): Promise<void> => {
      if (completionInFlightRef.current) return completionInFlightRef.current;
      intentionalPauseRef.current = true;
      stopActiveVoice();
      stopPreparedVoice();
      const operation = stopAmbient(durationMs).then(() => {
        if (
          !mountedRef.current ||
          earlyExitInProgressRef.current ||
          completionToneRef.current ||
          (!params.plan.shouldPlayAmbient && !params.plan.shouldPlayVoice)
        )
          return;
        const tone = createSessionAudioPlayer(COMPLETION_TONE, {
          trackId: 'visualize-completion-cue',
          volume: 0.34,
        });
        completionToneRef.current = tone;
        tone?.play();
      });
      completionInFlightRef.current = operation;
      return operation;
    },
    [
      createSessionAudioPlayer,
      params.manifest.ambient.fadeOutMs,
      params.plan.shouldPlayAmbient,
      params.plan.shouldPlayVoice,
      stopActiveVoice,
      stopAmbient,
      stopPreparedVoice,
    ],
  );

  const fadeOutAndStop = useCallback(
    (durationMs = EARLY_EXIT_FADE_MS): Promise<void> => {
      if (earlyStopInFlightRef.current) return earlyStopInFlightRef.current;
      earlyExitInProgressRef.current = true;
      intentionalPauseRef.current = true;
      clearAmbientFade();
      stopActiveVoice();
      stopPreparedVoice();
      stopCompletionTone();
      const operation = stopAmbient(durationMs);
      earlyStopInFlightRef.current = operation;
      return operation;
    },
    [
      clearAmbientFade,
      stopActiveVoice,
      stopAmbient,
      stopCompletionTone,
      stopPreparedVoice,
    ],
  );

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    mountedRef.current = true;
    handledCueIdsRef.current = new Set();
    previousActiveRef.current = false;
    hasStartedRef.current = false;
    ambientWasPlayingRef.current = false;
    earlyExitInProgressRef.current = false;
    earlyStopInFlightRef.current = null;
    completionInFlightRef.current = null;
    intentionalPauseRef.current = true;
    clearAmbientFade();
    stopActiveVoice();
    stopPreparedVoice();
    stopCompletionTone();
    void stopAmbient(0);

    if (params.plan.shouldPlayAmbient && params.plan.ambientTrack) {
      ambientRef.current = createSessionAudioPlayer(
        params.plan.ambientTrack.asset,
        {
          loop: params.manifest.ambient.loop,
          trackId: getAmbientAudioTrackId(params.plan.ambientTrack),
          volume: 0,
          onFailure: () => {
            if (isCurrent(generation)) trackAmbientAudioLoadFailed(params.plan);
          },
          onStatus: (status) => {
            if (!isCurrent(generation)) return;
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
        },
      );
    }
    if (params.plan.shouldPlayVoice) {
      prepareCue(params.plan.voiceCues[0] ?? null, generation);
    }
    intentionalPauseRef.current = false;

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      intentionalPauseRef.current = true;
      clearAmbientFade();
      stopActiveVoice();
      stopPreparedVoice();
      stopCompletionTone();
      void stopAmbient(0);
    };
  }, [
    clearAmbientFade,
    createSessionAudioPlayer,
    isCurrent,
    params.manifest.ambient.loop,
    params.onInterruption,
    params.plan,
    prepareCue,
    stopActiveVoice,
    stopAmbient,
    stopCompletionTone,
    stopPreparedVoice,
  ]);

  useEffect(() => {
    if (params.isCompleting) {
      previousActiveRef.current = false;
      void finishCompletion();
      return;
    }
    if (params.isComplete) {
      previousActiveRef.current = false;
      intentionalPauseRef.current = true;
      return;
    }
    if (!params.isActive) {
      if (earlyExitInProgressRef.current) return;
      intentionalPauseRef.current = true;
      clearAmbientFade();
      ambientWasPlayingRef.current = false;
      ambientRef.current?.pause();
      activeVoiceRef.current?.player.pause();
      previousActiveRef.current = false;
      return;
    }

    intentionalPauseRef.current = false;
    if (!previousActiveRef.current) {
      const resting = getVisualizeAmbientRestingVolume(
        params.plan.shouldPlayVoice,
      );
      const resumeTarget = voiceActiveRef.current
        ? VISUALIZE_AMBIENT_LEVELS.guidedDucked
        : resting;
      if (ambientRef.current) {
        // Reconcile after backgrounding without recreating the player.
        // Looping assets use the equivalent position in the source track.
        if (hasStartedRef.current && params.elapsedMs > 200) {
          const trackSeconds = params.manifest.ambient.expectedDurationSeconds;
          const targetSeconds = params.manifest.ambient.loop
            ? (params.elapsedMs / 1_000) % trackSeconds
            : Math.min(params.elapsedMs / 1_000, Math.max(0, trackSeconds - 0.1));
          const currentPos = ambientRef.current.getCurrentTime();
          if (Math.abs(currentPos - targetSeconds) > 1.5) {
            void ambientRef.current.seekTo(targetSeconds);
          }
        }
        ambientRef.current.play();
        fadeAmbientTo(resumeTarget, params.manifest.ambient.fadeInMs);
      }
      activeVoiceRef.current?.player.play();
      previousActiveRef.current = true;
      hasStartedRef.current = true;
    }

    if (!voiceActiveRef.current) {
      const definition = getNextDueVisualizeCue(
        params.manifest.cues,
        params.elapsedMs,
        handledCueIdsRef.current,
      );
      if (definition) {
        const cue = params.plan.voiceCues.find(
          (item) => item.phaseId === definition.id,
        );
        if (cue) playCue(cue);
        else handledCueIdsRef.current.add(definition.id);
      }
    }
  }, [
    clearAmbientFade,
    fadeAmbientTo,
    finishCompletion,
    params.elapsedMs,
    params.isActive,
    params.isComplete,
    params.isCompleting,
    params.manifest,
    params.plan.shouldPlayVoice,
    params.plan.voiceCues,
    playCue,
  ]);

  return {
    fadeOutAndStop,
    finishCompletion,
    hasVoiceGuidance: params.plan.shouldPlayVoice,
  };
}
