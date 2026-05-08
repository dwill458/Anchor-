/**
 * Anchor App - Ritual Controller Hook
 *
 * Manages ritual state, phase transitions, timers, haptics, and long-press seal logic.
 * Reusable for both Quick and Deep charge rituals.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import {
  RitualConfig,
  RitualPhase,
  getCurrentPhase,
  calculateProgress,
  formatTime,
} from '@/config/ritualConfigs';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { useAudio } from '@/hooks/useAudio';
import { useSettingsStore } from '@/stores/settingsStore';

export interface RitualState {
  // Time tracking
  elapsedSeconds: number;
  remainingSeconds: number;
  formattedRemaining: string;
  progress: number; // 0-1 for charging ring animation

  // Phase tracking
  currentPhase: RitualPhase | null;
  currentPhaseIndex: number;
  phaseElapsed: number;
  totalPhases: number;

  // Instruction rotation
  currentInstruction: string;

  // Ritual lifecycle
  isActive: boolean;
  isComplete: boolean;
  isSealPhase: boolean; // Last 3 seconds

  // Seal gesture
  sealProgress: number; // 0-1 during long-press
  isSealComplete: boolean;
}

export interface RitualController {
  state: RitualState;
  actions: {
    start: () => void;
    pause: () => void;
    resume: () => void;
    reset: () => void;
    startSeal: () => void;
    cancelSeal: () => void;
    completeSeal: () => void;
  };
}

export interface UseRitualControllerOptions {
  config: RitualConfig;
  onComplete?: () => void;
  onPhaseChange?: (phase: RitualPhase, index: number) => void;
  onSealComplete?: () => void;
}

/**
 * Main ritual controller hook
 */
export function useRitualController({
  config,
  onComplete,
  onPhaseChange,
  onSealComplete,
}: UseRitualControllerOptions): RitualController {
  const { playSound } = useAudio();
  const focusSessionAudio = useSettingsStore((state) => state.focusSessionAudio ?? 'silent');
  const primeSessionAudio = useSettingsStore((state) => state.primeSessionAudio ?? 'silent');
  const sessionAudioMode = config.id.startsWith('focus') ? focusSessionAudio : primeSessionAudio;
  // ══════════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════════

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);

  // Seal gesture state
  const [isSealActive, setIsSealActive] = useState(false);
  const [sealProgress, setSealProgress] = useState(0);
  const [isSealComplete, setIsSealComplete] = useState(false);

  // Refs for intervals - Use any for cross-platform compatibility
  const timerIntervalRef = useRef<any>(null);
  const hapticIntervalRef = useRef<any>(null);
  const instructionIntervalRef = useRef<any>(null);
  const sealIntervalRef = useRef<any>(null);
  const lastPhaseIndexRef = useRef(-1);
  const bgSoundRef = useRef<{ stop: () => void } | null>(null);

  // Wall-clock timestamp refs for accurate timer even when JS thread is delayed.
  // Instead of accumulating +1/sec (which drifts on overloaded threads), we record
  // when the timer last (re)started and how many seconds were already banked.
  const timerStartedAtRef = useRef<number | null>(null);
  const elapsedAtPauseRef = useRef<number>(0);

  const clearAllIntervals = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
    if (instructionIntervalRef.current) clearInterval(instructionIntervalRef.current);
    if (sealIntervalRef.current) clearInterval(sealIntervalRef.current);
    bgSoundRef.current?.stop();
    bgSoundRef.current = null;
  }, []);

  // ══════════════════════════════════════════════════════════════
  // COMPUTED STATE
  // ══════════════════════════════════════════════════════════════

  const remainingSeconds = Math.max(
    config.totalDurationSeconds - elapsedSeconds,
    0
  );
  const progress = calculateProgress(config.totalDurationSeconds, elapsedSeconds);
  const phaseData = getCurrentPhase(config, elapsedSeconds);
  const currentPhase = phaseData?.phase || null;
  const currentPhaseIndex = phaseData?.phaseIndex ?? (isComplete ? config.phases.length - 1 : -1);
  const phaseElapsed = phaseData?.phaseElapsed ?? 0;

  // FIXED: Seal phase should remain active even after time hits 0:00 until the seal is complete
  const isSealPhase = (remainingSeconds <= config.sealDurationSeconds || isComplete) && !isSealComplete;

  // Get current instruction text
  const currentInstruction = currentPhase
    ? currentPhase.instructions[
    currentInstructionIndex % currentPhase.instructions.length
    ]
    : (isComplete && !isSealComplete ? 'Intention charged.\nHold your Anchor to seal it in.' : '');

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE: Timer
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isActive) return;

    // Record the wall-clock start time for this active interval.
    timerStartedAtRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      const startedAt = timerStartedAtRef.current;
      if (startedAt === null) return;

      const wallElapsed = elapsedAtPauseRef.current + (Date.now() - startedAt) / 1000;
      const next = Math.floor(wallElapsed);

      if (next >= config.totalDurationSeconds) {
        setElapsedSeconds(config.totalDurationSeconds);
        handleRitualComplete();
        return;
      }

      setElapsedSeconds(next);
    }, 250); // Poll at 250ms so display updates smoothly even when ticks are delayed

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isActive, config.totalDurationSeconds]);

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE: Phase Changes
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (currentPhaseIndex !== lastPhaseIndexRef.current && currentPhase) {
      lastPhaseIndexRef.current = currentPhaseIndex;

      // Fire phase change callback
      if (onPhaseChange) {
        onPhaseChange(currentPhase, currentPhaseIndex);
      }

      // Medium haptic on phase transition
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      ErrorTrackingService.addBreadcrumb('Ritual phase changed', 'ritual.phase', {
        phase_index: currentPhaseIndex,
        phase_name: currentPhase.title,
      });

      // Reset instruction index for new phase
      setCurrentInstructionIndex(0);
    }
  }, [currentPhaseIndex, currentPhase, onPhaseChange]);

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE: Haptics
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isActive || !currentPhase) return;

    // Clear previous interval
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
    }

    hapticIntervalRef.current = setInterval(() => {
      if (sessionAudioMode === 'ambient') {
        void playSound('haptic-tone', 0.15);
      }
      void Haptics.impactAsync(currentPhase.hapticStyle);
    }, currentPhase.hapticIntervalMs);

    return () => {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
      }
    };
  }, [currentPhase, isActive, playSound, sessionAudioMode]);

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE: Instruction Rotation
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isActive || !currentPhase) return;

    // Clear previous interval
    if (instructionIntervalRef.current) {
      clearInterval(instructionIntervalRef.current);
    }

    instructionIntervalRef.current = setInterval(() => {
      setCurrentInstructionIndex((prev: number) => prev + 1);
    }, currentPhase.instructionRotationMs);

    return () => {
      if (instructionIntervalRef.current) {
        clearInterval(instructionIntervalRef.current);
      }
    };
  }, [isActive, currentPhase]);

  // ══════════════════════════════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════════════════════════════

  const start = useCallback(() => {
    elapsedAtPauseRef.current = 0;
    timerStartedAtRef.current = null;
    setIsActive(true);
    setElapsedSeconds(0);
    setIsComplete(false);
    setIsSealComplete(false);
    setSealProgress(0);
    bgSoundRef.current?.stop();
    bgSoundRef.current =
      sessionAudioMode === 'ambient' ? playSound('prime-begin', 1, true) : null;
    ErrorTrackingService.addBreadcrumb('Ritual started', 'ritual.lifecycle', {
      duration_seconds: config.totalDurationSeconds,
      phase_count: config.phases.length,
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [config.totalDurationSeconds, config.phases.length, playSound, sessionAudioMode]);

  const pause = useCallback(() => {
    // Bank the elapsed seconds so resume can continue from the right point.
    if (timerStartedAtRef.current !== null) {
      elapsedAtPauseRef.current += (Date.now() - timerStartedAtRef.current) / 1000;
      timerStartedAtRef.current = null;
    }
    setIsActive(false);
    bgSoundRef.current?.stop();
    bgSoundRef.current = null;
    ErrorTrackingService.addBreadcrumb('Ritual paused', 'ritual.lifecycle', {
      elapsed_seconds: elapsedSeconds,
    });
  }, [elapsedSeconds]);

  const resume = useCallback(() => {
    // timerStartedAtRef will be set when the timer useEffect fires on isActive → true.
    setIsActive(true);
    bgSoundRef.current =
      sessionAudioMode === 'ambient' ? playSound('prime-begin', 1, true) : null;
    ErrorTrackingService.addBreadcrumb('Ritual resumed', 'ritual.lifecycle', {
      elapsed_seconds: elapsedSeconds,
    });
  }, [elapsedSeconds, playSound, sessionAudioMode]);

  const reset = useCallback(() => {
    setIsActive(false);
    setElapsedSeconds(0);
    setIsComplete(false);
    setIsSealActive(false);
    setSealProgress(0);
    setIsSealComplete(false);
    setCurrentInstructionIndex(0);
    lastPhaseIndexRef.current = -1;
    timerStartedAtRef.current = null;
    elapsedAtPauseRef.current = 0;
    clearAllIntervals();
    ErrorTrackingService.addBreadcrumb('Ritual reset', 'ritual.lifecycle');
  }, [clearAllIntervals]);

  const handleRitualComplete = useCallback(() => {
    setIsActive(false);
    setIsComplete(true);
    ErrorTrackingService.addBreadcrumb('Ritual timer completed', 'ritual.lifecycle', {
      elapsed_seconds: config.totalDurationSeconds,
    });

    // Don't auto-complete - wait for seal gesture
    // The seal phase should have already been shown
  }, [config.totalDurationSeconds]);

  // ══════════════════════════════════════════════════════════════
  // SEAL GESTURE ACTIONS
  // ══════════════════════════════════════════════════════════════

  const startSeal = useCallback(() => {
    if (!isSealPhase || isSealComplete) return;

    if (sealIntervalRef.current) {
      clearInterval(sealIntervalRef.current);
    }

    setIsSealActive(true);
    setSealProgress(0);
    ErrorTrackingService.addBreadcrumb('Ritual seal hold started', 'ritual.seal');

    // Start progress animation (0 → 1 over 1.5 seconds)
    const startTime = Date.now();
    const sealDuration = config.sealHoldDurationMs ?? 1500;

    sealIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / sealDuration, 1);
      setSealProgress(progress);

      if (progress >= 1) {
        completeSeal();
      }
    }, 16); // ~60fps
  }, [config.sealHoldDurationMs, isSealPhase, isSealComplete]);

  const cancelSeal = useCallback(() => {
    setIsSealActive(false);
    setSealProgress(0);
    ErrorTrackingService.addBreadcrumb('Ritual seal hold canceled', 'ritual.seal');

    if (sealIntervalRef.current) {
      clearInterval(sealIntervalRef.current);
    }
  }, []);

  const completeSeal = useCallback(() => {
    setIsSealActive(false);
    setIsSealComplete(true);
    setSealProgress(1);

    if (sealIntervalRef.current) {
      clearInterval(sealIntervalRef.current);
    }

    ErrorTrackingService.addBreadcrumb('Ritual sealed', 'ritual.seal', {
      elapsed_seconds: elapsedSeconds,
    });

    bgSoundRef.current?.stop();
    bgSoundRef.current = null;

    // Success haptic
    if (sessionAudioMode === 'ambient') {
      void playSound('prime-complete');
    }
    void Haptics.notificationAsync(config.sealSuccessHaptic);

    // Trigger completion callback
    if (onSealComplete) {
      onSealComplete();
    }

    if (onComplete) {
      onComplete();
    }
  }, [config.sealSuccessHaptic, elapsedSeconds, onComplete, onSealComplete, playSound, sessionAudioMode]);

  useEffect(() => {
    return () => {
      clearAllIntervals();
    };
  }, [clearAllIntervals]);

  // ══════════════════════════════════════════════════════════════
  // RETURN STATE + ACTIONS
  // ══════════════════════════════════════════════════════════════

  const state: RitualState = {
    elapsedSeconds,
    remainingSeconds,
    formattedRemaining: formatTime(remainingSeconds),
    progress,
    currentPhase,
    currentPhaseIndex,
    phaseElapsed,
    totalPhases: config.phases.length,
    currentInstruction,
    isActive,
    isComplete,
    isSealPhase,
    sealProgress,
    isSealComplete,
  };

  const actions = {
    start,
    pause,
    resume,
    reset,
    startSeal,
    cancelSeal,
    completeSeal,
  };

  return { state, actions };
}
