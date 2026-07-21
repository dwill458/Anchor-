import { useCallback, useEffect, useRef } from 'react';
import {
  trackAmbientAudioLoadFailed,
  trackGuidedAudioLoadFailed,
} from '@/services/SessionAudioAnalytics';
import {
  getAmbientAudioTrackId,
  getGuidedAudioTrackId,
  type ResolvedSessionAudioPlan,
} from '@/services/SessionAudioManifest';
import {
  type ManagedSessionAudioPlayer,
  useSessionAudio,
} from '@/hooks/useSessionAudio';

const AMBIENT_BASE_VOLUME = 0.12;
const AMBIENT_DUCKED_VOLUME = 0.08;
const AMBIENT_FADE_IN_MS = 900;
const AMBIENT_FADE_OUT_MS = 650;
const AMBIENT_DUCK_MS = 180;
const AMBIENT_UNDUCK_MS = 260;
const AMBIENT_FADE_STEP_MS = 50;

type UseDeepPrimeSessionAudioOptions = {
  plan: ResolvedSessionAudioPlan;
  remainingMs: number;
  isActive: boolean;
  isComplete: boolean;
};

type UseDeepPrimeSessionAudioResult = {
  fadeOutAndStop: () => Promise<void>;
  hasVoiceGuidance: boolean;
};

/**
 * Plays a resolved Deep Prime plan while treating RitualScreen's wall-clock timer
 * as the only source of truth. Audio can pause, fail, or finish without ever
 * advancing or completing the ritual itself.
 */
export function useDeepPrimeSessionAudio({
  plan,
  remainingMs,
  isActive,
  isComplete,
}: UseDeepPrimeSessionAudioOptions): UseDeepPrimeSessionAudioResult {
  const { createSessionAudioPlayer } = useSessionAudio();
  const ambientAudioRef = useRef<ManagedSessionAudioPlayer | null>(null);
  const guidanceAudioRef = useRef<ManagedSessionAudioPlayer | null>(null);
  const ambientFadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambientVolumeRef = useRef(0);
  const playedPhaseIdsRef = useRef<Set<string>>(new Set());
  const voiceCueActiveRef = useRef(false);
  const previousActiveRef = useRef(false);

  const clearAmbientFade = useCallback(() => {
    if (ambientFadeIntervalRef.current) {
      clearInterval(ambientFadeIntervalRef.current);
      ambientFadeIntervalRef.current = null;
    }
  }, []);

  const setAmbientVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    ambientVolumeRef.current = clamped;
    ambientAudioRef.current?.setVolume(clamped);
  }, []);

  const fadeAmbientTo = useCallback((
    targetVolume: number,
    durationMs: number,
    onComplete?: () => void
  ) => {
    if (!ambientAudioRef.current) {
      onComplete?.();
      return;
    }

    clearAmbientFade();
    const fromVolume = ambientVolumeRef.current;
    const toVolume = Math.max(0, Math.min(1, targetVolume));
    if (durationMs <= 0 || Math.abs(fromVolume - toVolume) < 0.001) {
      setAmbientVolume(toVolume);
      onComplete?.();
      return;
    }

    const stepCount = Math.max(1, Math.round(durationMs / AMBIENT_FADE_STEP_MS));
    let step = 0;
    ambientFadeIntervalRef.current = setInterval(() => {
      step += 1;
      setAmbientVolume(fromVolume + (toVolume - fromVolume) * (step / stepCount));
      if (step >= stepCount) {
        clearAmbientFade();
        onComplete?.();
      }
    }, AMBIENT_FADE_STEP_MS);
  }, [clearAmbientFade, setAmbientVolume]);

  const restoreAmbientBed = useCallback(() => {
    fadeAmbientTo(AMBIENT_BASE_VOLUME, AMBIENT_UNDUCK_MS);
  }, [fadeAmbientTo]);

  const stopGuidanceAudio = useCallback(() => {
    guidanceAudioRef.current?.stop();
    guidanceAudioRef.current = null;
    voiceCueActiveRef.current = false;
  }, []);

  const stopAmbientBed = useCallback((fadeOut: boolean, onComplete?: () => void) => {
    const player = ambientAudioRef.current;
    if (!player) {
      onComplete?.();
      return;
    }

    const finish = () => {
      if (ambientAudioRef.current === player) {
        player.stop();
        ambientAudioRef.current = null;
        ambientVolumeRef.current = 0;
      }
      onComplete?.();
    };
    if (fadeOut) {
      fadeAmbientTo(0, AMBIENT_FADE_OUT_MS, finish);
    } else {
      clearAmbientFade();
      finish();
    }
  }, [clearAmbientFade, fadeAmbientTo]);

  const startAmbientBed = useCallback(() => {
    if (!plan.shouldPlayAmbient || !plan.ambientTrack) return;
    if (!ambientAudioRef.current) {
      ambientAudioRef.current = createSessionAudioPlayer(plan.ambientTrack.asset, {
        loop: true,
        trackId: getAmbientAudioTrackId(plan.ambientTrack),
        volume: 0,
        onFailure: () => trackAmbientAudioLoadFailed(plan),
      });
      ambientVolumeRef.current = 0;
    }
    ambientAudioRef.current?.play();
    fadeAmbientTo(
      voiceCueActiveRef.current ? AMBIENT_DUCKED_VOLUME : AMBIENT_BASE_VOLUME,
      AMBIENT_FADE_IN_MS
    );
  }, [createSessionAudioPlayer, fadeAmbientTo, plan]);

  const playCue = useCallback((phaseId: string) => {
    if (playedPhaseIdsRef.current.has(phaseId)) return;
    const cue = plan.voiceCues.find((entry) => entry.phaseId === phaseId);
    if (!cue) return;

    playedPhaseIdsRef.current.add(phaseId);
    stopGuidanceAudio();
    voiceCueActiveRef.current = true;
    fadeAmbientTo(AMBIENT_DUCKED_VOLUME, AMBIENT_DUCK_MS);
    guidanceAudioRef.current = createSessionAudioPlayer(cue.track.asset, {
      trackId: getGuidedAudioTrackId(cue.track),
      volume: cue.track.playbackGain,
      onFailure: () => trackGuidedAudioLoadFailed(plan, phaseId),
      onFinish: () => {
        guidanceAudioRef.current = null;
        voiceCueActiveRef.current = false;
        restoreAmbientBed();
      },
    });
    if (!guidanceAudioRef.current) {
      voiceCueActiveRef.current = false;
      restoreAmbientBed();
      return;
    }
    guidanceAudioRef.current.play();
  }, [createSessionAudioPlayer, fadeAmbientTo, plan, restoreAmbientBed, stopGuidanceAudio]);

  const fadeOutAndStop = useCallback(() => {
    stopGuidanceAudio();
    return new Promise<void>((resolve) => stopAmbientBed(true, resolve));
  }, [stopAmbientBed, stopGuidanceAudio]);

  useEffect(() => {
    playedPhaseIdsRef.current = new Set();
    previousActiveRef.current = false;
    stopGuidanceAudio();
    stopAmbientBed(false);
  }, [plan, stopAmbientBed, stopGuidanceAudio]);

  useEffect(() => {
    if (isComplete) {
      void fadeOutAndStop();
      previousActiveRef.current = false;
      return;
    }

    if (!isActive) {
      clearAmbientFade();
      ambientAudioRef.current?.pause();
      guidanceAudioRef.current?.pause();
      previousActiveRef.current = false;
      return;
    }

    if (!previousActiveRef.current) {
      startAmbientBed();
      guidanceAudioRef.current?.play();
      previousActiveRef.current = true;
    }

    const nextCue = plan.voiceCues.find(
      (cue) =>
        !playedPhaseIdsRef.current.has(cue.phaseId) &&
        remainingMs <= cue.triggerAtRemainingMs
    );
    if (nextCue) playCue(nextCue.phaseId);
  }, [
    clearAmbientFade,
    fadeOutAndStop,
    isActive,
    isComplete,
    plan.voiceCues,
    playCue,
    remainingMs,
    startAmbientBed,
  ]);

  useEffect(() => () => {
    clearAmbientFade();
    stopGuidanceAudio();
    stopAmbientBed(false);
  }, [clearAmbientFade, stopAmbientBed, stopGuidanceAudio]);

  return {
    fadeOutAndStop,
    hasVoiceGuidance: plan.shouldPlayVoice,
  };
}
