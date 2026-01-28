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

  // Refs for intervals
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hapticIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const instructionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sealIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPhaseIndexRef = useRef(-1);

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
  const currentPhaseIndex = phaseData?.phaseIndex ?? -1;
  const phaseElapsed = phaseData?.phaseElapsed ?? 0;
  const isSealPhase = remainingSeconds <= config.sealDurationSeconds && remainingSeconds > 0;

  // Get current instruction text
  const currentInstruction = currentPhase
    ? currentPhase.instructions[
        currentInstructionIndex % currentPhase.instructions.length
      ]
    : '';

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE: Timer
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isActive) return;

    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;

        // Check if ritual is complete
        if (next >= config.totalDurationSeconds) {
          handleRitualComplete();
          return config.totalDurationSeconds;
        }

        return next;
      });
    }, 1000);

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
      Haptics.impactAsync(currentPhase.hapticStyle);
    }, currentPhase.hapticIntervalMs);

    return () => {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
      }
    };
  }, [isActive, currentPhase]);

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
      setCurrentInstructionIndex((prev) => prev + 1);
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
    setIsActive(true);
    setElapsedSeconds(0);
    setIsComplete(false);
    setIsSealComplete(false);
    setSealProgress(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const pause = useCallback(() => {
    setIsActive(false);
  }, []);

  const resume = useCallback(() => {
    setIsActive(true);
  }, []);

  const reset = useCallback(() => {
    setIsActive(false);
    setElapsedSeconds(0);
    setIsComplete(false);
    setIsSealActive(false);
    setSealProgress(0);
    setIsSealComplete(false);
    setCurrentInstructionIndex(0);
    lastPhaseIndexRef.current = -1;

    // Clear all intervals
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
    if (instructionIntervalRef.current)
      clearInterval(instructionIntervalRef.current);
    if (sealIntervalRef.current) clearInterval(sealIntervalRef.current);
  }, []);

  const handleRitualComplete = useCallback(() => {
    setIsActive(false);
    setIsComplete(true);

    // Don't auto-complete - wait for seal gesture
    // The seal phase should have already been shown
  }, []);

  // ══════════════════════════════════════════════════════════════
  // SEAL GESTURE ACTIONS
  // ══════════════════════════════════════════════════════════════

  const startSeal = useCallback(() => {
    if (!isSealPhase || isSealComplete) return;

    setIsSealActive(true);
    setSealProgress(0);

    // Start progress animation (0 → 1 over 1.5 seconds)
    const startTime = Date.now();
    const sealDuration = 1500; // 1.5 seconds long-press

    sealIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / sealDuration, 1);
      setSealProgress(progress);

      if (progress >= 1) {
        completeSeal();
      }
    }, 16); // ~60fps
  }, [isSealPhase, isSealComplete]);

  const cancelSeal = useCallback(() => {
    setIsSealActive(false);
    setSealProgress(0);

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

    // Success haptic
    Haptics.notificationAsync(config.sealSuccessHaptic);

    // Trigger completion callback
    if (onSealComplete) {
      onSealComplete();
    }

    if (onComplete) {
      onComplete();
    }
  }, [config.sealSuccessHaptic, onSealComplete, onComplete]);

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
