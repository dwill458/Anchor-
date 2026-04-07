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
  id: string; // e.g., 'focus_30s', 'focus_2m', 'ritual_custom', etc.
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
// FOCUS MODE CONFIGS - Single phase, brief focus sessions
// ============================================================================

/** Focus Charge - 30 seconds */
export const FOCUS_30S_CONFIG: RitualConfig = {
  id: 'focus_30s',
  name: 'Focus Charge',
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
      instructionRotationMs: 6000,
      hapticIntervalMs: 5000,
      hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    },
  ],
};

/** Focus Charge - 2 minutes */
export const FOCUS_2M_CONFIG: RitualConfig = {
  id: 'focus_2m',
  name: 'Focus Charge',
  totalDurationSeconds: 120,
  sealDurationSeconds: 3,
  sealSuccessHaptic: Haptics.NotificationFeedbackType.Success,
  phases: [
    {
      number: 1,
      title: 'Focus',
      durationSeconds: 120,
      instructions: [
        'Feel it in your body',
        'This moment is yours',
        'See it as already done',
        'Breathe with intention',
        'You are enough',
      ],
      instructionRotationMs: 18000, // Rotate every 18 seconds
      hapticIntervalMs: 15000, // Haptic pulse every 15 seconds
      hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    },
  ],
};

/** Focus Charge - 5 minutes */
export const FOCUS_5M_CONFIG: RitualConfig = {
  id: 'focus_5m',
  name: 'Focus Charge',
  totalDurationSeconds: 300,
  sealDurationSeconds: 3,
  sealSuccessHaptic: Haptics.NotificationFeedbackType.Success,
  phases: [
    {
      number: 1,
      title: 'Focus',
      durationSeconds: 300,
      instructions: [
        'Feel it in your body',
        'This moment is yours',
        'See it as already done',
        'Breathe with intention',
        'You are enough',
        'Stand in your power',
      ],
      instructionRotationMs: 45000, // Rotate every 45 seconds
      hapticIntervalMs: 30000, // Haptic pulse every 30 seconds
      hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    },
  ],
};

// ============================================================================
// RITUAL MODE CONFIGS - Multi-phase, immersive experiences
// ============================================================================

/** Ritual Charge - 5 minutes (legacy DEEP_CHARGE_CONFIG) */
export const RITUAL_5M_CONFIG: RitualConfig = {
  id: 'ritual_5m',
  name: 'Ritual Charge',
  totalDurationSeconds: 300,
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

/** Ritual Charge - 10 minutes (extended multi-phase experience) */
export const RITUAL_10M_CONFIG: RitualConfig = {
  id: 'ritual_10m',
  name: 'Ritual Charge',
  totalDurationSeconds: 600,
  sealDurationSeconds: 3,
  sealSuccessHaptic: Haptics.NotificationFeedbackType.Success,
  phases: [
    // Phase 1: Breathwork (60s)
    {
      number: 1,
      title: 'Breathwork',
      durationSeconds: 60,
      instructions: [
        'Slow inhale. Longer exhale.',
        'Feel your center.',
        'Steady breath, steady mind.',
        'Synchronize with your heartbeat.',
      ],
      instructionRotationMs: 15000,
      hapticIntervalMs: 15000,
      hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    },

    // Phase 2: Mantra (120s)
    {
      number: 2,
      title: 'Mantra',
      durationSeconds: 120,
      instructions: [
        'Speak it softly. Let it sink in.',
        'Repeat until you believe it.',
        'Your words shape reality.',
        'Feel its resonance in your chest.',
      ],
      instructionRotationMs: 30000,
      hapticIntervalMs: 15000,
      hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    },

    // Phase 3: Visualization (120s)
    {
      number: 3,
      title: 'Visualization',
      durationSeconds: 120,
      instructions: [
        'See the result. Feel it now.',
        'Make it vivid. Make it real.',
        'Every detail matters.',
        'You are already there.',
        'Taste the victory.',
      ],
      instructionRotationMs: 40000,
      hapticIntervalMs: 15000,
      hapticStyle: Haptics.ImpactFeedbackStyle.Light,
    },

    // Phase 4: Transfer (90s)
    {
      number: 4,
      title: 'Transfer',
      durationSeconds: 90,
      instructions: [
        'Push the intention into the symbol.',
        'Channel your focus here.',
        'Anchor it in place.',
        'Feel it lock in.',
      ],
      instructionRotationMs: 30000,
      hapticIntervalMs: 15000,
      hapticStyle: Haptics.ImpactFeedbackStyle.Medium,
    },

    // Phase 5: Seal (150s)
    {
      number: 5,
      title: 'Seal',
      durationSeconds: 150,
      instructions: [
        'Hold steady. Seal the link.',
        'Feel the connection lock in.',
        'This is your anchor now.',
        'The bond is unbreakable.',
        'You are complete.',
      ],
      instructionRotationMs: 40000,
      hapticIntervalMs: 15000,
      hapticStyle: Haptics.ImpactFeedbackStyle.Medium,
    },
  ],
};

// ============================================================================
// LEGACY CONFIGS - Backwards compatibility
// ============================================================================

/** @deprecated Use FOCUS_30S_CONFIG or RITUAL_5M_CONFIG instead */
export const QUICK_CHARGE_CONFIG: RitualConfig = FOCUS_30S_CONFIG;

/** @deprecated Use RITUAL_5M_CONFIG instead */
export const DEEP_CHARGE_CONFIG: RitualConfig = RITUAL_5M_CONFIG;


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a custom ritual config for a given mode and duration
 *
 * For focus mode: Single phase, extended instructions based on duration
 * For ritual mode: Multi-phase scaled to fit the total duration
 */
function generateCustomRitualConfig(
  mode: 'focus' | 'ritual',
  durationSeconds: number
): RitualConfig {
  // Clamp duration to valid range (30s - 30m)
  const clampedDuration = Math.max(30, Math.min(1800, durationSeconds));

  if (mode === 'focus') {
    // Focus mode: Single phase, simple instructions
    const instructionPool = [
      'Feel it in your body',
      'This moment is yours',
      'See it as already done',
      'Breathe with intention',
      'You are enough',
      'Stand in your power',
      'Trust the process',
      'Release and receive',
    ];

    return {
      id: `focus_custom_${clampedDuration}s`,
      name: 'Focus Charge',
      totalDurationSeconds: clampedDuration,
      sealDurationSeconds: 3,
      sealSuccessHaptic: Haptics.NotificationFeedbackType.Success,
      phases: [
        {
          number: 1,
          title: 'Focus',
          durationSeconds: clampedDuration,
          instructions: instructionPool,
          instructionRotationMs: Math.max(
            6000,
            Math.floor((clampedDuration * 1000) / 6)
          ), // Rotate ~6 times
          hapticIntervalMs: Math.max(
            5000,
            Math.floor((clampedDuration * 1000) / 5)
          ), // ~5 haptic pulses
          hapticStyle: Haptics.ImpactFeedbackStyle.Light,
        },
      ],
    };
  } else {
    // Ritual mode: Multi-phase scaled to duration
    // Base ratio: 30s breathwork, 60s mantra, 90s visualization, 30s transfer, 90s seal
    // Total base: 300s (5 minutes)
    const ratio = clampedDuration / 300;

    const phases: RitualPhase[] = [
      {
        number: 1,
        title: 'Breathwork',
        durationSeconds: Math.round(30 * ratio),
        instructions: [
          'Slow inhale. Longer exhale.',
          'Feel your center.',
          'Steady breath, steady mind.',
          'Synchronize with your heartbeat.',
        ],
        instructionRotationMs: Math.max(10000, Math.round(10000 * ratio)),
        hapticIntervalMs: Math.max(10000, Math.round(10000 * ratio)),
        hapticStyle: Haptics.ImpactFeedbackStyle.Light,
      },
      {
        number: 2,
        title: 'Mantra',
        durationSeconds: Math.round(60 * ratio),
        instructions: [
          'Speak it softly. Let it sink in.',
          'Repeat until you believe it.',
          'Your words shape reality.',
          'Feel its resonance.',
        ],
        instructionRotationMs: Math.max(10000, Math.round(20000 * ratio)),
        hapticIntervalMs: Math.max(10000, Math.round(10000 * ratio)),
        hapticStyle: Haptics.ImpactFeedbackStyle.Light,
      },
      {
        number: 3,
        title: 'Visualization',
        durationSeconds: Math.round(90 * ratio),
        instructions: [
          'See the result. Feel it now.',
          'Make it vivid. Make it real.',
          'Every detail matters.',
          'You are already there.',
        ],
        instructionRotationMs: Math.max(10000, Math.round(30000 * ratio)),
        hapticIntervalMs: Math.max(10000, Math.round(10000 * ratio)),
        hapticStyle: Haptics.ImpactFeedbackStyle.Light,
      },
      {
        number: 4,
        title: 'Transfer',
        durationSeconds: Math.round(30 * ratio),
        instructions: [
          'Push the intention into the symbol.',
          'Channel your focus here.',
          'Anchor it in place.',
          'Feel it lock in.',
        ],
        instructionRotationMs: Math.max(10000, Math.round(10000 * ratio)),
        hapticIntervalMs: Math.max(10000, Math.round(10000 * ratio)),
        hapticStyle: Haptics.ImpactFeedbackStyle.Medium,
      },
      {
        number: 5,
        title: 'Seal',
        durationSeconds: Math.round(90 * ratio),
        instructions: [
          'Hold steady. Seal the link.',
          'Feel the connection lock in.',
          'This is your anchor now.',
          'The bond is unbreakable.',
        ],
        instructionRotationMs: Math.max(10000, Math.round(30000 * ratio)),
        hapticIntervalMs: Math.max(10000, Math.round(10000 * ratio)),
        hapticStyle: Haptics.ImpactFeedbackStyle.Medium,
      },
    ];

    return {
      id: `ritual_custom_${clampedDuration}s`,
      name: 'Ritual Charge',
      totalDurationSeconds: clampedDuration,
      sealDurationSeconds: 3,
      sealSuccessHaptic: Haptics.NotificationFeedbackType.Success,
      phases,
    };
  }
}

/**
 * Get ritual config by type and optional custom duration
 *
 * @param ritualType - 'focus' | 'ritual' (or legacy 'quick' | 'deep')
 * @param durationSeconds - Optional custom duration. If provided, generates dynamic config
 * @returns RitualConfig for the specified type and duration
 */
export function getRitualConfig(
  ritualType: 'focus' | 'ritual' | 'quick' | 'deep',
  durationSeconds?: number
): RitualConfig {
  // Handle legacy quick/deep types
  if (ritualType === 'quick') {
    return durationSeconds
      ? generateCustomRitualConfig('focus', durationSeconds)
      : FOCUS_30S_CONFIG;
  }
  if (ritualType === 'deep') {
    return durationSeconds
      ? generateCustomRitualConfig('ritual', durationSeconds)
      : RITUAL_5M_CONFIG;
  }

  // Handle custom durations
  if (durationSeconds) {
    return generateCustomRitualConfig(ritualType, durationSeconds);
  }

  // Return predefined configs based on mode
  if (ritualType === 'focus') {
    return FOCUS_2M_CONFIG; // Default focus duration
  } else {
    return RITUAL_5M_CONFIG; // Default ritual duration
  }
}

/**
 * Calculate which phase user is currently in based on elapsed time
 * Works with both legacy and new ritual configs
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
 * Format duration in seconds to readable display format (MM:SS or Xm)
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) {
    return `${mins}m`;
  }
  return `${mins}m ${secs}s`;
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
