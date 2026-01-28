/**
 * Anchor App - Ritual Configurations
 *
 * Defines phase structures, durations, and copy for Quick + Deep charge rituals.
 * Zen Architect theme: concise, ritual-like, mainstream-friendly.
 */

import * as Haptics from 'expo-haptics';

export interface RitualPhase {
  /** Phase number (1-indexed for display) */
  number: number;
  /** Phase title shown to user */
  title: string;
  /** Duration in seconds */
  durationSeconds: number;
  /** Array of instruction texts that rotate during this phase */
  instructions: string[];
  /** How often instructions rotate (ms) */
  instructionRotationMs: number;
  /** Haptic feedback interval (ms) */
  hapticIntervalMs: number;
  /** Haptic style for regular pulses */
  hapticStyle: Haptics.ImpactFeedbackStyle;
}

export interface RitualConfig {
  /** Ritual identifier */
  id: 'quick' | 'deep';
  /** Display name */
  name: string;
  /** Total duration (sum of all phases) */
  totalDurationSeconds: number;
  /** Array of phases */
  phases: RitualPhase[];
  /** Duration of seal gesture at the end (seconds) */
  sealDurationSeconds: number;
  /** Success haptic after seal completes */
  sealSuccessHaptic: Haptics.NotificationFeedbackType;
}

// ============================================================================
// QUICK CHARGE (30 seconds, single phase)
// ============================================================================

export const QUICK_CHARGE_CONFIG: RitualConfig = {
  id: 'quick',
  name: 'Quick Charge',
  totalDurationSeconds: 30,
  sealDurationSeconds: 3,
  sealSuccessHaptic: Haptics.NotificationFeedbackType.Success,
  phases: [
    {
      number: 1,
      title: 'Focus',
      durationSeconds: 30,
      instructions: [
        'Feel it in your body',
        'This moment is yours',
        'See it as already done',
      ],
      instructionRotationMs: 6000, // Rotate every 6 seconds (5 rotations total)
      hapticIntervalMs: 5000, // Haptic pulse every 5 seconds
      hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    },
  ],
};

// ============================================================================
// DEEP CHARGE (5 minutes, 5 phases)
// ============================================================================

export const DEEP_CHARGE_CONFIG: RitualConfig = {
  id: 'deep',
  name: 'Deep Charge',
  totalDurationSeconds: 300, // 5 minutes
  sealDurationSeconds: 3,
  sealSuccessHaptic: Haptics.NotificationFeedbackType.Success,
  phases: [
    // Phase 1: Breathwork (30s)
    {
      number: 1,
      title: 'Breathwork',
      durationSeconds: 30,
      instructions: [
        'Slow inhale. Longer exhale.',
        'Feel your center.',
        'Steady breath, steady mind.',
      ],
      instructionRotationMs: 10000,
      hapticIntervalMs: 10000,
      hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    },

    // Phase 2: Mantra (60s)
    {
      number: 2,
      title: 'Mantra',
      durationSeconds: 60,
      instructions: [
        'Speak it softly. Let it sink in.',
        'Repeat until you believe it.',
        'Your words shape reality.',
      ],
      instructionRotationMs: 20000,
      hapticIntervalMs: 10000,
      hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    },

    // Phase 3: Visualization (90s)
    {
      number: 3,
      title: 'Visualization',
      durationSeconds: 90,
      instructions: [
        'See the result. Feel it now.',
        'Make it vivid. Make it real.',
        'Every detail matters.',
      ],
      instructionRotationMs: 30000,
      hapticIntervalMs: 10000,
      hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    },

    // Phase 4: Transfer (30s)
    {
      number: 4,
      title: 'Transfer',
      durationSeconds: 30,
      instructions: [
        'Push the intention into the symbol.',
        'Channel your focus here.',
        'Anchor it in place.',
      ],
      instructionRotationMs: 10000,
      hapticIntervalMs: 10000,
      hapticStyle: Haptics.ImpactFeedbackStyle.Medium,
    },

    // Phase 5: Seal (90s)
    {
      number: 5,
      title: 'Seal',
      durationSeconds: 90,
      instructions: [
        'Hold steady. Seal the link.',
        'Feel the connection lock in.',
        'This is your anchor now.',
      ],
      instructionRotationMs: 30000,
      hapticIntervalMs: 10000,
      hapticStyle: Haptics.ImpactFeedbackStyle.Medium,
    },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get ritual config by ID
 */
export function getRitualConfig(ritualId: 'quick' | 'deep'): RitualConfig {
  return ritualId === 'quick' ? QUICK_CHARGE_CONFIG : DEEP_CHARGE_CONFIG;
}

/**
 * Calculate which phase user is currently in based on elapsed time
 */
export function getCurrentPhase(
  config: RitualConfig,
  elapsedSeconds: number
): { phase: RitualPhase; phaseIndex: number; phaseElapsed: number } | null {
  let accumulatedTime = 0;

  for (let i = 0; i < config.phases.length; i++) {
    const phase = config.phases[i];
    const phaseStart = accumulatedTime;
    const phaseEnd = accumulatedTime + phase.durationSeconds;

    if (elapsedSeconds >= phaseStart && elapsedSeconds < phaseEnd) {
      return {
        phase,
        phaseIndex: i,
        phaseElapsed: elapsedSeconds - phaseStart,
      };
    }

    accumulatedTime += phase.durationSeconds;
  }

  return null; // Ritual complete
}

/**
 * Calculate progress percentage (0-1) for charging ring animation
 */
export function calculateProgress(
  totalDurationSeconds: number,
  elapsedSeconds: number
): number {
  if (elapsedSeconds >= totalDurationSeconds) return 1;
  return Math.min(Math.max(elapsedSeconds / totalDurationSeconds, 0), 1);
}

/**
 * Format seconds into MM:SS display
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
