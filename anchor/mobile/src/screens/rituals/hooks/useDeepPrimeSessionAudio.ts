import { useCallback, useEffect, useMemo, useRef } from 'react';
import { type ManagedAudioPlayer, useAudio } from '@/hooks/useAudio';

const DEEP_PRIME_AMBIENT_KEY = 'deep-prime-ambient' as const;
const AMBIENT_BASE_VOLUME = 0.12;
const AMBIENT_DUCKED_VOLUME = 0.08;
const AMBIENT_FADE_IN_MS = 900;
const AMBIENT_FADE_OUT_MS = 650;
const AMBIENT_DUCK_MS = 180;
const AMBIENT_UNDUCK_MS = 260;
const AMBIENT_FADE_STEP_MS = 50;

type DeepPrimeCueName =
  | 'opening'
  | 'intention'
  | 'deepening'
  | 'return'
  | 'reinforcement'
  | 'visualization'
  | 'settling'
  | 'closing';
type DeepPrimeCueKey =
  | 'deep-prime-2m-closing'
  | 'deep-prime-2m-deepening'
  | 'deep-prime-2m-intention'
  | 'deep-prime-2m-opening'
  | 'deep-prime-5m-closing'
  | 'deep-prime-5m-deepening'
  | 'deep-prime-5m-intention'
  | 'deep-prime-5m-opening'
  | 'deep-prime-5m-reinforcement'
  | 'deep-prime-5m-return'
  | 'deep-prime-10m-closing'
  | 'deep-prime-10m-deepening'
  | 'deep-prime-10m-intention'
  | 'deep-prime-10m-opening'
  | 'deep-prime-10m-reinforcement'
  | 'deep-prime-10m-return'
  | 'deep-prime-10m-settling'
  | 'deep-prime-10m-visualization'
  | 'deep-prime-15m-closing'
  | 'deep-prime-15m-deepening'
  | 'deep-prime-15m-intention'
  | 'deep-prime-15m-opening'
  | 'deep-prime-15m-reinforcement'
  | 'deep-prime-15m-return'
  | 'deep-prime-15m-settling'
  | 'deep-prime-15m-visualization';

type DeepPrimeGuidanceProfile = {
  cues: Array<{
    key: DeepPrimeCueKey;
    name: DeepPrimeCueName;
    triggerAtRemainingMs: number;
  }>;
};

const EMPTY_CUE_PLAYED_STATE: Record<DeepPrimeCueName, boolean> = {
  opening: false,
  intention: false,
  deepening: false,
  return: false,
  reinforcement: false,
  visualization: false,
  settling: false,
  closing: false,
};

const DEEP_PRIME_GUIDANCE_PROFILES: Record<number, DeepPrimeGuidanceProfile | undefined> = {
  120: {
    cues: [
      { key: 'deep-prime-2m-opening', name: 'opening', triggerAtRemainingMs: 120_000 },
      { key: 'deep-prime-2m-intention', name: 'intention', triggerAtRemainingMs: 90_000 },
      { key: 'deep-prime-2m-deepening', name: 'deepening', triggerAtRemainingMs: 50_000 },
      { key: 'deep-prime-2m-closing', name: 'closing', triggerAtRemainingMs: 10_000 },
    ],
  },
  300: {
    cues: [
      { key: 'deep-prime-5m-opening', name: 'opening', triggerAtRemainingMs: 300_000 },
      { key: 'deep-prime-5m-intention', name: 'intention', triggerAtRemainingMs: 265_000 },
      { key: 'deep-prime-5m-deepening', name: 'deepening', triggerAtRemainingMs: 200_000 },
      { key: 'deep-prime-5m-return', name: 'return', triggerAtRemainingMs: 135_000 },
      { key: 'deep-prime-5m-reinforcement', name: 'reinforcement', triggerAtRemainingMs: 60_000 },
      { key: 'deep-prime-5m-closing', name: 'closing', triggerAtRemainingMs: 10_000 },
    ],
  },
  600: {
    cues: [
      { key: 'deep-prime-10m-opening', name: 'opening', triggerAtRemainingMs: 600_000 },
      { key: 'deep-prime-10m-intention', name: 'intention', triggerAtRemainingMs: 555_000 },
      { key: 'deep-prime-10m-deepening', name: 'deepening', triggerAtRemainingMs: 480_000 },
      { key: 'deep-prime-10m-return', name: 'return', triggerAtRemainingMs: 390_000 },
      { key: 'deep-prime-10m-reinforcement', name: 'reinforcement', triggerAtRemainingMs: 300_000 },
      { key: 'deep-prime-10m-visualization', name: 'visualization', triggerAtRemainingMs: 210_000 },
      { key: 'deep-prime-10m-settling', name: 'settling', triggerAtRemainingMs: 105_000 },
      { key: 'deep-prime-10m-closing', name: 'closing', triggerAtRemainingMs: 15_000 },
    ],
  },
  900: {
    cues: [
      { key: 'deep-prime-15m-opening', name: 'opening', triggerAtRemainingMs: 900_000 },
      { key: 'deep-prime-15m-intention', name: 'intention', triggerAtRemainingMs: 832_500 },
      { key: 'deep-prime-15m-deepening', name: 'deepening', triggerAtRemainingMs: 720_000 },
      { key: 'deep-prime-15m-return', name: 'return', triggerAtRemainingMs: 585_000 },
      { key: 'deep-prime-15m-reinforcement', name: 'reinforcement', triggerAtRemainingMs: 450_000 },
      { key: 'deep-prime-15m-visualization', name: 'visualization', triggerAtRemainingMs: 315_000 },
      { key: 'deep-prime-15m-settling', name: 'settling', triggerAtRemainingMs: 157_500 },
      { key: 'deep-prime-15m-closing', name: 'closing', triggerAtRemainingMs: 22_500 },
    ],
  },
};

type UseDeepPrimeSessionAudioOptions = {
  durationSeconds: number;
  enabled: boolean;
  isActive: boolean;
  isComplete: boolean;
};

type UseDeepPrimeSessionAudioResult = {
  fadeOutAndStop: () => Promise<void>;
  hasVoiceGuidance: boolean;
};

export function useDeepPrimeSessionAudio({
  durationSeconds,
  enabled,
  isActive,
  isComplete,
}: UseDeepPrimeSessionAudioOptions): UseDeepPrimeSessionAudioResult {
  const { createManagedPlayer } = useAudio();
  const totalMs = Math.max(1_000, Math.round(durationSeconds * 1_000));
  const guidanceProfile = useMemo(
    () => (enabled ? DEEP_PRIME_GUIDANCE_PROFILES[durationSeconds] ?? null : null),
    [durationSeconds, enabled]
  );

  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endAtMsRef = useRef<number>(Date.now() + totalMs);
  const remainingMsRef = useRef<number>(totalMs);
  const hasStartedRef = useRef(false);
  const wasActiveRef = useRef(false);
  const wasCompleteRef = useRef(false);
  const ambientAudioRef = useRef<ManagedAudioPlayer | null>(null);
  const ambientFadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambientVolumeRef = useRef(0);
  const guidanceAudioRef = useRef<ManagedAudioPlayer | null>(null);
  const guidanceCuePlayedRef = useRef<Record<DeepPrimeCueName, boolean>>({
    ...EMPTY_CUE_PLAYED_STATE,
  });
  const voiceCueActiveRef = useRef(false);

  const clearTickInterval = useCallback(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

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
      const progressRatio = step / stepCount;
      setAmbientVolume(fromVolume + (toVolume - fromVolume) * progressRatio);
      if (step >= stepCount) {
        clearAmbientFade();
        onComplete?.();
      }
    }, AMBIENT_FADE_STEP_MS);
  }, [clearAmbientFade, setAmbientVolume]);

  const restoreAmbientBed = useCallback(() => {
    if (!ambientAudioRef.current) {
      return;
    }
    fadeAmbientTo(AMBIENT_BASE_VOLUME, AMBIENT_UNDUCK_MS);
  }, [fadeAmbientTo]);

  const duckAmbientBed = useCallback(() => {
    if (!ambientAudioRef.current) {
      return;
    }
    fadeAmbientTo(AMBIENT_DUCKED_VOLUME, AMBIENT_DUCK_MS);
  }, [fadeAmbientTo]);

  const stopGuidanceAudio = useCallback(() => {
    guidanceAudioRef.current?.stop();
    guidanceAudioRef.current = null;
    voiceCueActiveRef.current = false;
  }, []);

  const resetGuidanceAudio = useCallback(() => {
    stopGuidanceAudio();
    guidanceCuePlayedRef.current = { ...EMPTY_CUE_PLAYED_STATE };
  }, [stopGuidanceAudio]);

  const startAmbientBed = useCallback(() => {
    if (!ambientAudioRef.current) {
      ambientAudioRef.current = createManagedPlayer(DEEP_PRIME_AMBIENT_KEY, {
        loop: true,
        volume: 0,
      });
      ambientVolumeRef.current = 0;
    }

    ambientAudioRef.current?.play();
    fadeAmbientTo(
      voiceCueActiveRef.current ? AMBIENT_DUCKED_VOLUME : AMBIENT_BASE_VOLUME,
      AMBIENT_FADE_IN_MS
    );
  }, [createManagedPlayer, fadeAmbientTo]);

  const pauseAmbientBed = useCallback(() => {
    clearAmbientFade();
    ambientAudioRef.current?.pause();
  }, [clearAmbientFade]);

  const stopAmbientBed = useCallback((fadeOut: boolean) => {
    if (!ambientAudioRef.current) {
      return;
    }

    const player = ambientAudioRef.current;
    const finishStop = () => {
      if (ambientAudioRef.current === player) {
        player.stop();
        ambientAudioRef.current = null;
        ambientVolumeRef.current = 0;
      }
    };

    if (!fadeOut) {
      clearAmbientFade();
      finishStop();
      return;
    }

    fadeAmbientTo(0, AMBIENT_FADE_OUT_MS, finishStop);
  }, [clearAmbientFade, fadeAmbientTo]);

  const playGuidanceCue = useCallback((cue: DeepPrimeCueName) => {
    if (!guidanceProfile || guidanceCuePlayedRef.current[cue]) {
      return;
    }

    const cueConfig = guidanceProfile.cues.find((entry) => entry.name === cue);
    if (!cueConfig) {
      return;
    }

    stopGuidanceAudio();
    guidanceCuePlayedRef.current[cue] = true;
    voiceCueActiveRef.current = true;
    duckAmbientBed();
    guidanceAudioRef.current = createManagedPlayer(cueConfig.key, {
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
    guidanceAudioRef.current?.play();
  }, [createManagedPlayer, duckAmbientBed, guidanceProfile, restoreAmbientBed, stopGuidanceAudio]);

  const pauseGuidanceAudio = useCallback(() => {
    guidanceAudioRef.current?.pause();
  }, []);

  const maybePlayScheduledGuidanceCue = useCallback((remainingMs: number) => {
    if (!guidanceProfile) {
      return;
    }

    const nextCue = guidanceProfile.cues.find(
      (cue) => !guidanceCuePlayedRef.current[cue.name] && remainingMs <= cue.triggerAtRemainingMs
    );

    if (nextCue) {
      playGuidanceCue(nextCue.name);
    }
  }, [guidanceProfile, playGuidanceCue]);

  const tickSessionAudio = useCallback(() => {
    const remainingMs = Math.max(0, endAtMsRef.current - Date.now());
    remainingMsRef.current = remainingMs;

    if (remainingMs > 0) {
      maybePlayScheduledGuidanceCue(remainingMs);
      return;
    }

    clearTickInterval();
  }, [clearTickInterval, maybePlayScheduledGuidanceCue]);

  const startTickInterval = useCallback(() => {
    clearTickInterval();
    tickIntervalRef.current = setInterval(tickSessionAudio, 250);
  }, [clearTickInterval, tickSessionAudio]);

  const fadeOutAndStop = useCallback(() => {
    clearTickInterval();
    stopGuidanceAudio();

    return new Promise<void>((resolve) => {
      if (!ambientAudioRef.current) {
        resolve();
        return;
      }

      const player = ambientAudioRef.current;
      fadeAmbientTo(0, AMBIENT_FADE_OUT_MS, () => {
        if (ambientAudioRef.current === player) {
          player.stop();
          ambientAudioRef.current = null;
          ambientVolumeRef.current = 0;
        }
        resolve();
      });
    });
  }, [clearTickInterval, fadeAmbientTo, stopGuidanceAudio]);

  useEffect(() => {
    remainingMsRef.current = totalMs;
    endAtMsRef.current = Date.now() + totalMs;
    hasStartedRef.current = false;
    wasActiveRef.current = false;
    wasCompleteRef.current = false;
    resetGuidanceAudio();
    clearTickInterval();
    stopAmbientBed(false);

    return () => {
      clearTickInterval();
      clearAmbientFade();
      stopGuidanceAudio();
      stopAmbientBed(false);
    };
  }, [clearAmbientFade, clearTickInterval, resetGuidanceAudio, stopAmbientBed, stopGuidanceAudio, totalMs]);

  useEffect(() => {
    if (!enabled) {
      remainingMsRef.current = totalMs;
      endAtMsRef.current = Date.now() + totalMs;
      hasStartedRef.current = false;
      wasActiveRef.current = false;
      wasCompleteRef.current = false;
      resetGuidanceAudio();
      clearTickInterval();
      clearAmbientFade();
      stopAmbientBed(false);
      return;
    }

    if (isComplete && !wasCompleteRef.current) {
      clearTickInterval();
      remainingMsRef.current = 0;
      stopGuidanceAudio();
      stopAmbientBed(true);
    } else if (isActive && !wasActiveRef.current && !isComplete) {
      const nextRemainingMs = hasStartedRef.current ? remainingMsRef.current : totalMs;
      if (!hasStartedRef.current) {
        resetGuidanceAudio();
        hasStartedRef.current = true;
      }
      remainingMsRef.current = Math.max(0, nextRemainingMs);
      endAtMsRef.current = Date.now() + remainingMsRef.current;
      startAmbientBed();

      if (guidanceProfile) {
        if (guidanceAudioRef.current) {
          guidanceAudioRef.current.play();
        } else {
          maybePlayScheduledGuidanceCue(remainingMsRef.current);
        }
      }

      startTickInterval();
    } else if (!isActive && wasActiveRef.current && !isComplete) {
      remainingMsRef.current = Math.max(0, endAtMsRef.current - Date.now());
      clearTickInterval();
      pauseAmbientBed();
      pauseGuidanceAudio();
    }

    wasActiveRef.current = isActive;
    wasCompleteRef.current = isComplete;
  }, [
    clearAmbientFade,
    clearTickInterval,
    enabled,
    guidanceProfile,
    isActive,
    isComplete,
    maybePlayScheduledGuidanceCue,
    pauseAmbientBed,
    pauseGuidanceAudio,
    resetGuidanceAudio,
    startAmbientBed,
    startTickInterval,
    stopAmbientBed,
    stopGuidanceAudio,
    totalMs,
  ]);

  return {
    fadeOutAndStop,
    hasVoiceGuidance: Boolean(guidanceProfile),
  };
}
