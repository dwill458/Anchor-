import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import type { PerformanceTierOverride } from '@/hooks/usePerformanceTier';

export type ChargeMode = 'focus' | 'ritual';
export type ChargeDurationPreset = '30s' | '1m' | '2m' | '5m' | '10m' | 'custom';
export type FocusSessionMode = 'quick' | 'deep';
export type SessionAudioMode = 'silent' | 'ambient';
export type DailyPracticeGoalPreset = 'once' | 'three' | 'five' | 'custom';
export type ThreadStrengthSensitivity = 'lenient' | 'balanced' | 'strict';
export type RestDayPolicy = 'build' | 'neutral';

export interface DefaultChargeSetting {
  mode: ChargeMode;
  preset: ChargeDurationPreset;
  customMinutes?: number;
}

export type ActivationType = 'visual' | 'mantra' | 'full' | 'breath_visual';
export type ActivationUnit = 'seconds' | 'reps' | 'minutes' | 'breaths';

export type ActivationMode = 'silent' | 'mantra' | 'ambient';

export type GuideMode = boolean;

export interface DefaultActivationSetting {
  type: ActivationType;
  value: number;
  unit: ActivationUnit;
  mode: ActivationMode;
}

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

const clampFocusSessionDuration = (value: number): number =>
  clampNumber(value, 10, 120);

const clampPrimeSessionDuration = (value: number): number =>
  clampNumber(value, 120, 7200);

const normalizeSessionAudioMode = (value: unknown): SessionAudioMode =>
  value === 'ambient' ? 'ambient' : 'silent';

const normalizeFocusSessionMode = (value: unknown): FocusSessionMode =>
  value === 'deep' ? 'deep' : 'quick';

const normalizeDailyPracticeGoalPreset = (
  value: unknown,
  goal: number
): DailyPracticeGoalPreset => {
  if (value === 'once' || value === 'three' || value === 'five' || value === 'custom') {
    return value;
  }

  if (goal === 1) return 'once';
  if (goal === 3) return 'three';
  if (goal === 5) return 'five';
  return 'custom';
};

const normalizeThreadStrengthSensitivity = (value: unknown): ThreadStrengthSensitivity => {
  if (value === 'lenient' || value === 'strict') {
    return value;
  }

  return 'balanced';
};

const normalizeRestDays = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    )
  ).sort((left, right) => left - right);
};

const normalizeRestDayPolicy = (value: unknown): RestDayPolicy =>
  value === 'neutral' ? 'neutral' : 'build';

const deriveFocusSessionDuration = (persistedState: any): number => {
  if (typeof persistedState?.focusSessionDuration === 'number') {
    return clampFocusSessionDuration(persistedState.focusSessionDuration);
  }

  const defaultActivation = persistedState?.defaultActivation;
  if (defaultActivation?.unit === 'minutes' && typeof defaultActivation.value === 'number') {
    return clampFocusSessionDuration(defaultActivation.value * 60);
  }
  if (defaultActivation?.unit === 'seconds' && typeof defaultActivation.value === 'number') {
    return clampFocusSessionDuration(defaultActivation.value);
  }

  return 30;
};

const derivePrimeSessionDuration = (persistedState: any): number => {
  if (typeof persistedState?.primeSessionDuration === 'number') {
    return clampPrimeSessionDuration(persistedState.primeSessionDuration);
  }

  const defaultCharge = persistedState?.defaultCharge;
  if (!defaultCharge) {
    return 120;
  }

  if (defaultCharge.preset === 'custom') {
    return clampPrimeSessionDuration((defaultCharge.customMinutes ?? 5) * 60);
  }

  switch (defaultCharge.preset) {
    case '10m':
      return 600;
    case '5m':
      return 300;
    case '2m':
    case '1m':
    case '30s':
    default:
      return 120;
  }
};

const deriveFocusSessionAudio = (persistedState: any): SessionAudioMode =>
  normalizeSessionAudioMode(
    persistedState?.focusSessionAudio ?? persistedState?.defaultActivation?.mode
  );

const deriveDailyPracticeGoal = (persistedState: any): number =>
  clampNumber(persistedState?.dailyPracticeGoal ?? 3, 1, 20);

const deriveDefaultChargeFromPrimeSession = (
  currentCharge: DefaultChargeSetting,
  durationSeconds: number
): DefaultChargeSetting => {
  if (durationSeconds === 120) {
    return { mode: 'ritual', preset: '2m', customMinutes: undefined };
  }
  if (durationSeconds === 300) {
    return { mode: 'ritual', preset: '5m', customMinutes: undefined };
  }
  if (durationSeconds === 600) {
    return { mode: 'ritual', preset: '10m', customMinutes: undefined };
  }

  return {
    mode: 'ritual',
    preset: 'custom',
    customMinutes: clampNumber(Math.round(durationSeconds / 60), 2, 120),
  };
};

const deriveDefaultActivationFromFocusSession = (
  currentActivation: DefaultActivationSetting,
  durationSeconds: number,
  audioMode: SessionAudioMode
): DefaultActivationSetting => {
  if (durationSeconds > 60) {
    return normalizeDefaultActivation({
      ...currentActivation,
      type: 'visual',
      unit: 'minutes',
      value: Math.round(durationSeconds / 60),
      mode: audioMode,
    });
  }

  return normalizeDefaultActivation({
    ...currentActivation,
    type: 'visual',
    unit: 'seconds',
    value: durationSeconds,
    mode: audioMode,
  });
};

const normalizeDefaultCharge = (setting: DefaultChargeSetting): DefaultChargeSetting => {
  if (setting.preset !== 'custom') {
    return {
      mode: setting.mode,
      preset: setting.preset,
      customMinutes: undefined,
    };
  }

  return {
    mode: setting.mode,
    preset: 'custom',
    customMinutes: clampNumber(setting.customMinutes ?? 5, 1, 120),
  };
};

const normalizeDefaultActivation = (setting: DefaultActivationSetting): DefaultActivationSetting => {
  const mode: ActivationMode = setting.mode ?? 'silent';
  if (setting.unit === 'seconds') {
    return {
      ...setting,
      mode,
      value: clampNumber(setting.value, 10, 60),
    };
  }

  return {
    ...setting,
    mode,
    value: Math.max(1, Math.round(setting.value)),
  };
};

const clampPersistedSettings = (persistedState: any) => {
  if (!persistedState) return persistedState;
  const nextState = { ...persistedState };

  if (persistedState.defaultCharge) {
    nextState.defaultCharge = normalizeDefaultCharge({
      mode: persistedState.defaultCharge.mode ?? 'focus',
      preset: persistedState.defaultCharge.preset ?? '30s',
      customMinutes: persistedState.defaultCharge.customMinutes,
    });
  }

  if (persistedState.defaultActivation) {
    nextState.defaultActivation = normalizeDefaultActivation({
      type: persistedState.defaultActivation.type ?? 'visual',
      unit: persistedState.defaultActivation.unit ?? 'seconds',
      value: persistedState.defaultActivation.value ?? 10,
      mode: persistedState.defaultActivation.mode ?? 'silent',
    });
  }

  return nextState;
};

const getDefaultDebugLoggingEnabled = (): boolean =>
  __DEV__ && process.env.EXPO_PUBLIC_DEBUG_LOGGING === 'true';

const withDeveloperSettingsDefaults = (
  persistedState: any,
  overrides: Record<string, unknown> = {}
) => {
  const clampedState = clampPersistedSettings(persistedState);
  const dailyPracticeGoal = deriveDailyPracticeGoal(clampedState);
  const derivedFocusSessionMode =
    clampedState?.focusSessionMode ??
    (clampedState?.defaultCharge?.mode === 'ritual' ? 'deep' : 'quick');

  return {
    ...clampedState,
    focusSessionMode: normalizeFocusSessionMode(derivedFocusSessionMode),
    focusSessionDuration: deriveFocusSessionDuration(clampedState),
    focusSessionAudio: deriveFocusSessionAudio(clampedState),
    primeSessionDuration: derivePrimeSessionDuration(clampedState),
    primeSessionAudio: normalizeSessionAudioMode(clampedState?.primeSessionAudio),
    dailyPracticeGoal,
    dailyPracticeGoalPreset: normalizeDailyPracticeGoalPreset(
      clampedState?.dailyPracticeGoalPreset,
      dailyPracticeGoal
    ),
    threadStrengthSensitivity: normalizeThreadStrengthSensitivity(
      clampedState?.threadStrengthSensitivity
    ),
    restDays: normalizeRestDays(clampedState?.restDays),
    restDayPolicy: normalizeRestDayPolicy(clampedState?.restDayPolicy),
    developerSkipOnboardingEnabled: persistedState?.developerSkipOnboardingEnabled ?? false,
    developerForceStreakBreakEnabled: persistedState?.developerForceStreakBreakEnabled ?? false,
    developerDeleteWithoutBurnEnabled: persistedState?.developerDeleteWithoutBurnEnabled ?? false,
    developerMasterAccountEnabled: persistedState?.developerMasterAccountEnabled ?? false,
    developerWeeklySummaryPreviewToken: 0,
    debugLoggingEnabled:
      persistedState?.debugLoggingEnabled ?? getDefaultDebugLoggingEnabled(),
    ...overrides,
  };
};

/**
 * Settings state interface
 */
export interface SettingsState {
  // Practice Settings
  defaultCharge: DefaultChargeSetting;
  defaultActivation: DefaultActivationSetting;
  focusSessionMode: FocusSessionMode;
  focusSessionDuration: number;
  focusSessionAudio: SessionAudioMode;
  primeSessionDuration: number;
  primeSessionAudio: SessionAudioMode;

  openDailyAnchorAutomatically: boolean;
  dailyPracticeGoal: number;
  dailyPracticeGoalPreset: DailyPracticeGoalPreset;
  threadStrengthSensitivity: ThreadStrengthSensitivity;
  restDays: number[];
  restDayPolicy: RestDayPolicy;
  arrivePhaseEnabled: boolean;
  reduceIntentionVisibility: boolean;
  weeklySummaryEnabled: boolean;

  // Appearance
  theme: 'zen_architect' | 'dark' | 'light';
  accentColor: string; // Hex color code
  vaultView: 'grid' | 'list';

  // Audio & Haptics
  mantraVoice: 'my_voice' | 'generated';
  generatedVoiceStyle: 'calm' | 'neutral' | 'intense';
  hapticIntensity: number; // 0-100
  soundEffectsEnabled: boolean;
  mantraAudioByDefault: boolean;
  developerModeEnabled: boolean;
  developerMasterAccountEnabled: boolean;
  developerSkipOnboardingEnabled: boolean;
  developerForceStreakBreakEnabled: boolean;
  developerDeleteWithoutBurnEnabled: boolean;
  developerWeeklySummaryPreviewToken: number;
  debugLoggingEnabled: boolean;
  /** Guide Mode — contextual first-time hints. true = on-only + both; false = both only. */
  guideMode: boolean;

  // Dev-only, session-only (not persisted). Forces a specific render tier.
  devPerfTierOverride: PerformanceTierOverride;

  // Actions - Practice Settings
  setDefaultCharge: (setting: DefaultChargeSetting) => void;
  setDefaultActivation: (setting: DefaultActivationSetting) => void;
  setDefaultActivationMode: (mode: ActivationMode) => void;
  setFocusSessionMode: (mode: FocusSessionMode) => void;
  setFocusSessionDuration: (durationSeconds: number) => void;
  setFocusSessionAudio: (mode: SessionAudioMode) => void;
  setPrimeSessionDuration: (durationSeconds: number) => void;
  setPrimeSessionAudio: (mode: SessionAudioMode) => void;
  setGuideMode: (enabled: boolean) => void;
  setOpenDailyAnchorAutomatically: (enabled: boolean) => void;
  setDailyPracticeGoal: (goal: number) => void;
  setDailyPracticeGoalPreset: (preset: DailyPracticeGoalPreset) => void;
  setThreadStrengthSensitivity: (sensitivity: ThreadStrengthSensitivity) => void;
  setRestDays: (days: number[]) => void;
  setRestDayPolicy: (policy: RestDayPolicy) => void;
  setArrivePhaseEnabled: (enabled: boolean) => void;
  setReduceIntentionVisibility: (enabled: boolean) => void;
  setWeeklySummaryEnabled: (enabled: boolean) => void;

  // Actions - Appearance
  setTheme: (theme: 'zen_architect' | 'dark' | 'light') => void;
  setAccentColor: (color: string) => void;
  setVaultView: (view: 'grid' | 'list') => void;

  // Actions - Audio & Haptics
  setMantraVoice: (voice: 'my_voice' | 'generated') => void;
  setGeneratedVoiceStyle: (style: 'calm' | 'neutral' | 'intense') => void;
  setHapticIntensity: (intensity: number) => void;
  setSoundEffectsEnabled: (enabled: boolean) => void;
  setMantraAudioByDefault: (enabled: boolean) => void;
  setDeveloperModeEnabled: (enabled: boolean) => void;
  setDeveloperMasterAccountEnabled: (enabled: boolean) => void;
  setDeveloperSkipOnboardingEnabled: (enabled: boolean) => void;
  setDeveloperForceStreakBreakEnabled: (enabled: boolean) => void;
  setDeveloperDeleteWithoutBurnEnabled: (enabled: boolean) => void;
  triggerDeveloperWeeklySummaryPreview: () => void;
  clearDeveloperWeeklySummaryPreview: () => void;
  setDebugLoggingEnabled: (enabled: boolean) => void;
  setDevPerfTierOverride: (override: PerformanceTierOverride) => void;

  // Utility Actions
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  defaultCharge: {
    mode: 'focus' as ChargeMode,
    preset: '30s' as ChargeDurationPreset,
  },
  defaultActivation: {
    type: 'visual' as ActivationType,
    value: 30,
    unit: 'seconds' as ActivationUnit,
    mode: 'silent' as ActivationMode,
  },
  focusSessionMode: 'quick' as FocusSessionMode,
  focusSessionDuration: 30,
  focusSessionAudio: 'silent' as SessionAudioMode,
  primeSessionDuration: 120,
  primeSessionAudio: 'silent' as SessionAudioMode,
  openDailyAnchorAutomatically: false,
  dailyPracticeGoal: 3,
  dailyPracticeGoalPreset: 'three' as DailyPracticeGoalPreset,
  threadStrengthSensitivity: 'balanced' as ThreadStrengthSensitivity,
  restDays: [] as number[],
  restDayPolicy: 'build' as RestDayPolicy,
  arrivePhaseEnabled: true,
  reduceIntentionVisibility: false,
  weeklySummaryEnabled: true,
  theme: 'zen_architect' as const,
  accentColor: '#D4AF37',
  vaultView: 'grid' as const,
  mantraVoice: 'generated' as const,
  generatedVoiceStyle: 'calm' as const,
  hapticIntensity: 70,
  soundEffectsEnabled: true,
  mantraAudioByDefault: true,
  developerModeEnabled: false,
  developerMasterAccountEnabled: false,
  developerSkipOnboardingEnabled: false,
  developerForceStreakBreakEnabled: false,
  developerDeleteWithoutBurnEnabled: false,
  developerWeeklySummaryPreviewToken: 0,
  debugLoggingEnabled: __DEV__ && process.env.EXPO_PUBLIC_DEBUG_LOGGING === 'true',
  guideMode: true,
  devPerfTierOverride: 'auto' as PerformanceTierOverride,
};

/**
 * Trigger light haptic if enabled
 */
const triggerHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Settings store with persistence
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state with defaults
      ...DEFAULT_SETTINGS,

      // Practice Settings Actions
      setDefaultCharge: (setting) => {
        triggerHaptic();
        const normalized = normalizeDefaultCharge(setting);
        set(() => ({
          defaultCharge: normalized,
          focusSessionMode: normalized.mode === 'ritual' ? 'deep' : 'quick',
          primeSessionDuration: derivePrimeSessionDuration({ defaultCharge: normalized }),
        }));
      },

      setDefaultActivation: (setting) => {
        triggerHaptic();
        const normalized = normalizeDefaultActivation(setting);
        const derivedAudioMode = normalized.mode === 'ambient' ? 'ambient' : 'silent';
        set({
          defaultActivation: normalized,
          focusSessionDuration: deriveFocusSessionDuration({ defaultActivation: normalized }),
          focusSessionAudio: derivedAudioMode,
        });
      },

      setDefaultActivationMode: (mode) => {
        triggerHaptic();
        set((state) => ({
          defaultActivation: { ...state.defaultActivation, mode },
          focusSessionAudio: mode === 'ambient' ? 'ambient' : 'silent',
        }));
      },

      setFocusSessionMode: (mode) => {
        triggerHaptic();
        set({
          focusSessionMode: mode,
        });
      },

      setFocusSessionDuration: (durationSeconds) => {
        triggerHaptic();
        set((state) => {
          const nextDuration = clampFocusSessionDuration(durationSeconds);
          return {
            focusSessionDuration: nextDuration,
            defaultActivation: deriveDefaultActivationFromFocusSession(
              state.defaultActivation,
              nextDuration,
              state.focusSessionAudio
            ),
          };
        });
      },

      setFocusSessionAudio: (mode) => {
        triggerHaptic();
        set((state) => ({
          focusSessionAudio: mode,
          defaultActivation: deriveDefaultActivationFromFocusSession(
            state.defaultActivation,
            state.focusSessionDuration,
            mode
          ),
        }));
      },

      setPrimeSessionDuration: (durationSeconds) => {
        triggerHaptic();
        set((state) => {
          const nextDuration = clampPrimeSessionDuration(durationSeconds);
          return {
            primeSessionDuration: nextDuration,
            defaultCharge: deriveDefaultChargeFromPrimeSession(state.defaultCharge, nextDuration),
          };
        });
      },

      setPrimeSessionAudio: (mode) => {
        triggerHaptic();
        set({
          primeSessionAudio: mode,
        });
      },

      setOpenDailyAnchorAutomatically: (enabled) => {
        triggerHaptic();
        set({
          openDailyAnchorAutomatically: enabled,
        });
      },

      setDailyPracticeGoal: (goal) => {
        triggerHaptic();
        const nextGoal = Math.max(1, Math.min(20, goal));
        set({
          dailyPracticeGoal: nextGoal,
          dailyPracticeGoalPreset: normalizeDailyPracticeGoalPreset(undefined, nextGoal),
        });
      },

      setDailyPracticeGoalPreset: (preset) => {
        triggerHaptic();
        set({
          dailyPracticeGoalPreset: preset,
        });
      },

      setThreadStrengthSensitivity: (sensitivity) => {
        triggerHaptic();
        set({
          threadStrengthSensitivity: sensitivity,
        });
      },

      setRestDays: (days) => {
        triggerHaptic();
        set({
          restDays: normalizeRestDays(days),
        });
      },

      setRestDayPolicy: (policy) => {
        triggerHaptic();
        set({
          restDayPolicy: policy,
        });
      },

      setArrivePhaseEnabled: (enabled) => {
        triggerHaptic();
        set({
          arrivePhaseEnabled: enabled,
        });
      },

      setReduceIntentionVisibility: (enabled) => {
        triggerHaptic();
        set({
          reduceIntentionVisibility: enabled,
        });
      },

      setWeeklySummaryEnabled: (enabled) => {
        triggerHaptic();
        set({
          weeklySummaryEnabled: enabled,
        });
      },

      setTheme: (theme) => {
        triggerHaptic();
        set({
          theme,
        });
      },

      setAccentColor: (color) => {
        triggerHaptic();
        set({
          accentColor: color,
        });
      },

      setVaultView: (view) => {
        triggerHaptic();
        set({
          vaultView: view,
        });
      },

      setMantraVoice: (voice) => {
        triggerHaptic();
        set({
          mantraVoice: voice,
        });
      },

      setGeneratedVoiceStyle: (style) => {
        triggerHaptic();
        set({
          generatedVoiceStyle: style,
        });
      },

      setHapticIntensity: (intensity) => {
        set({
          hapticIntensity: Math.max(0, Math.min(100, intensity)),
        });
      },

      setSoundEffectsEnabled: (enabled) => {
        triggerHaptic();
        set({
          soundEffectsEnabled: enabled,
        });
      },
      setMantraAudioByDefault: (enabled) => {
        triggerHaptic();
        set({
          mantraAudioByDefault: enabled,
        });
      },

      setDeveloperModeEnabled: (enabled) => {
        triggerHaptic();
        set({
          developerModeEnabled: enabled,
        });
      },

      setDeveloperMasterAccountEnabled: (enabled: boolean) => {
        triggerHaptic();
        set({
          developerMasterAccountEnabled: enabled,
        });
      },

      setDeveloperSkipOnboardingEnabled: (enabled: boolean) => {
        triggerHaptic();
        set({
          developerSkipOnboardingEnabled: enabled,
        });
      },

      setDeveloperForceStreakBreakEnabled: (enabled: boolean) => {
        triggerHaptic();
        set({
          developerForceStreakBreakEnabled: enabled,
        });
      },

      setDeveloperDeleteWithoutBurnEnabled: (enabled) => {
        triggerHaptic();
        set({
          developerDeleteWithoutBurnEnabled: enabled,
        });
      },

      triggerDeveloperWeeklySummaryPreview: () => {
        triggerHaptic();
        set({
          developerWeeklySummaryPreviewToken: Date.now(),
        });
      },

      clearDeveloperWeeklySummaryPreview: () => {
        set({
          developerWeeklySummaryPreviewToken: 0,
        });
      },

      setDebugLoggingEnabled: (enabled) => {
        triggerHaptic();
        set({
          debugLoggingEnabled: enabled,
        });
      },

      setGuideMode: (enabled) => {
        triggerHaptic();
        set({ guideMode: enabled });
      },

      setDevPerfTierOverride: (override) => {
        set({ devPerfTierOverride: override });
      },

      // Utility Actions
      resetToDefaults: () => {
        triggerHaptic();
        set({
          ...DEFAULT_SETTINGS,
        });
      },
    }),
    {
      name: 'anchor-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // DEFERRED: version: 10,
      version: 11,
      // Handle migration
      migrate: (persistedState: any, version: number) => {
        if (version === 10) {
          return withDeveloperSettingsDefaults(persistedState, {
            arrivePhaseEnabled: true,
          });
        }
        if (version === 9) {
          return withDeveloperSettingsDefaults(persistedState);
        }
        if (version === 7) {
          return withDeveloperSettingsDefaults(persistedState, {
            developerSkipOnboardingEnabled: false,
            developerForceStreakBreakEnabled: false,
            developerDeleteWithoutBurnEnabled: false,
            developerMasterAccountEnabled: false,
          });
        }
        if (version === 6) {
          return withDeveloperSettingsDefaults(persistedState, {
            debugLoggingEnabled: false,
            developerSkipOnboardingEnabled: false,
            developerForceStreakBreakEnabled: false,
            developerDeleteWithoutBurnEnabled: false,
            developerMasterAccountEnabled: false,
          });
        }
        if (version === 5) {
          return withDeveloperSettingsDefaults(persistedState, {
            guideMode: false,
            debugLoggingEnabled: false,
            developerSkipOnboardingEnabled: false,
            developerForceStreakBreakEnabled: false,
            developerDeleteWithoutBurnEnabled: false,
            developerMasterAccountEnabled: false,
          });
        }
        if (version === 4) {
          const next = withDeveloperSettingsDefaults(persistedState, {
            guideMode: false,
            debugLoggingEnabled: false,
            developerSkipOnboardingEnabled: false,
            developerForceStreakBreakEnabled: false,
            developerDeleteWithoutBurnEnabled: false,
            developerMasterAccountEnabled: false,
          });
          if (next?.defaultActivation && !next.defaultActivation.mode) {
            next.defaultActivation.mode = 'silent';
          }
          return next;
        }
        if (version === 3) {
          return withDeveloperSettingsDefaults(persistedState, {
            debugLoggingEnabled: false,
            developerSkipOnboardingEnabled: false,
            developerForceStreakBreakEnabled: false,
            developerDeleteWithoutBurnEnabled: false,
            developerMasterAccountEnabled: false,
          });
        }
        if (version === 2) {
          return withDeveloperSettingsDefaults(persistedState, {
            debugLoggingEnabled: false,
            developerSkipOnboardingEnabled: false,
            developerForceStreakBreakEnabled: false,
            developerDeleteWithoutBurnEnabled: false,
            developerMasterAccountEnabled: false,
          });
        }
        if (version === 1) {
          return withDeveloperSettingsDefaults(
            {
              ...persistedState,
              openDailyAnchorAutomatically: persistedState.autoOpenDailyAnchor ?? false,
              streakProtectionAlerts: persistedState.streakProtectionEnabled ?? false,
              weeklySummaryEnabled: persistedState.weeklyReflectionEnabled ?? false,
            },
            {
            debugLoggingEnabled: false,
            developerSkipOnboardingEnabled: false,
            developerForceStreakBreakEnabled: false,
              developerDeleteWithoutBurnEnabled: false,
              developerMasterAccountEnabled: false,
            }
          );
        }
        if (version === 0) {
          const defaultCharge = {
            mode: persistedState.defaultChargeMode || 'focus',
            preset: persistedState.defaultChargePreset || '30s',
            customMinutes: persistedState.defaultChargeCustomMinutes,
          };

          const defaultActivation = {
            type: persistedState.defaultActivationType || 'visual',
            value: persistedState.defaultActivationValue || 10,
            unit: persistedState.defaultActivationUnit || 'seconds',
          };

          return withDeveloperSettingsDefaults(
            {
              ...persistedState,
              defaultCharge,
              defaultActivation,
              openDailyAnchorAutomatically: persistedState.autoOpenDailyAnchor ?? false,
              streakProtectionAlerts: persistedState.streakProtectionEnabled ?? false,
              weeklySummaryEnabled: persistedState.weeklyReflectionEnabled ?? false,
            },
            {
            debugLoggingEnabled: false,
            developerSkipOnboardingEnabled: false,
            developerForceStreakBreakEnabled: false,
              developerDeleteWithoutBurnEnabled: false,
              developerMasterAccountEnabled: false,
            }
          );
        }
        return withDeveloperSettingsDefaults(persistedState);
      },
      // Only persist user preference settings
      partialize: (state) => ({
        defaultCharge: state.defaultCharge,
        defaultActivation: state.defaultActivation,
        focusSessionMode: state.focusSessionMode,
        focusSessionDuration: state.focusSessionDuration,
        focusSessionAudio: state.focusSessionAudio,
        primeSessionDuration: state.primeSessionDuration,
        primeSessionAudio: state.primeSessionAudio,
        openDailyAnchorAutomatically: state.openDailyAnchorAutomatically,
        dailyPracticeGoal: state.dailyPracticeGoal,
        dailyPracticeGoalPreset: state.dailyPracticeGoalPreset,
        threadStrengthSensitivity: state.threadStrengthSensitivity,
        restDays: state.restDays,
        restDayPolicy: state.restDayPolicy,
        arrivePhaseEnabled: state.arrivePhaseEnabled,
        reduceIntentionVisibility: state.reduceIntentionVisibility,
        theme: state.theme,
        accentColor: state.accentColor,
        vaultView: state.vaultView,
        mantraVoice: state.mantraVoice,
        generatedVoiceStyle: state.generatedVoiceStyle,
        hapticIntensity: state.hapticIntensity,
        soundEffectsEnabled: state.soundEffectsEnabled,
        mantraAudioByDefault: state.mantraAudioByDefault,
        developerModeEnabled: state.developerModeEnabled,
        developerMasterAccountEnabled: state.developerMasterAccountEnabled,
        developerSkipOnboardingEnabled: state.developerSkipOnboardingEnabled,
        developerForceStreakBreakEnabled: state.developerForceStreakBreakEnabled,
        developerDeleteWithoutBurnEnabled: state.developerDeleteWithoutBurnEnabled,
        debugLoggingEnabled: state.debugLoggingEnabled,
        guideMode: state.guideMode,
      }),
    }
  )
);
