import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import type { PerformanceTierOverride } from '@/hooks/usePerformanceTier';
import {
  DEFAULT_SESSION_AUDIO_DEFAULTS,
  migrateLegacySessionAudioDefaults,
  normalizeSessionAudioDefaults,
  normalizeSessionAudioDefaultsByType,
  type SessionAudioDefaults,
  type SessionAudioDefaultsByType,
  type SessionAudioSessionType,
} from '@/types/sessionAudio';

export type ChargeMode = 'focus' | 'ritual';
export type ChargeDurationPreset = '30s' | '1m' | '2m' | '5m' | '10m' | 'custom';
export type FocusSessionMode = 'quick' | 'deep';
export type SessionAudioMode = 'silent' | 'ambient';
export type DailyPracticeGoalPreset = 'once' | 'three' | 'five' | 'custom';
export type ThreadStrengthSensitivity = 'lenient' | 'balanced' | 'strict';
export type RestDayPolicy = 'build' | 'neutral';
export type ReduceMotionPreference = 'system' | 'on' | 'off';
export type LastSessionDurationByMode = {
  focus: number;
  deep_prime: number;
  visualize: 60 | 180 | 300;
};

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

const clampVisualizeSessionDuration = (value: unknown): 60 | 180 | 300 => {
  const numeric = Number(value);
  if (numeric === 60 || numeric === 300) return numeric;
  return 180;
};

const normalizeSessionAudioMode = (value: unknown): SessionAudioMode =>
  value === 'ambient' ? 'ambient' : 'silent';

const normalizeFocusSessionMode = (value: unknown): FocusSessionMode =>
  value === 'deep' ? 'deep' : 'quick';

const normalizeWeeklySummaryTime = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '19:00';
  }

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    return '19:00';
  }

  return `${match[1]}:${match[2]}`;
};

const normalizeWeeklySummaryDay = (value: unknown): number => {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    return 0;
  }

  return day;
};

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

const normalizeReduceMotionPreference = (value: unknown): ReduceMotionPreference =>
  value === 'on' ? 'on' : 'off';

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
  const mode: ActivationMode = setting.mode ?? 'ambient';
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
      mode: persistedState.defaultActivation.mode ?? 'ambient',
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
  const sessionAudioDefaults = migrateLegacySessionAudioDefaults(clampedState);
  const sessionAudioDefaultsOwnerUserId =
    typeof clampedState?.sessionAudioDefaultsOwnerUserId === 'string'
      ? clampedState.sessionAudioDefaultsOwnerUserId
      : null;
  const sessionAudioDefaultsUpdatedAt =
    typeof clampedState?.sessionAudioDefaultsUpdatedAt === 'string' &&
    Number.isFinite(Date.parse(clampedState.sessionAudioDefaultsUpdatedAt))
      ? new Date(clampedState.sessionAudioDefaultsUpdatedAt).toISOString()
      : null;

  return {
    ...clampedState,
    focusSessionMode: normalizeFocusSessionMode(derivedFocusSessionMode),
    focusSessionDuration: deriveFocusSessionDuration(clampedState),
    focusSessionAudio: deriveFocusSessionAudio(clampedState),
    primeSessionDuration: derivePrimeSessionDuration(clampedState),
    primeSessionAudio: normalizeSessionAudioMode(clampedState?.primeSessionAudio),
    visualizeSessionDuration: clampVisualizeSessionDuration(
      clampedState?.visualizeSessionDuration
    ),
    lastSessionDurationByMode: {
      focus: deriveFocusSessionDuration({
        focusSessionDuration: clampedState?.lastSessionDurationByMode?.focus ??
          clampedState?.focusSessionDuration,
      }),
      deep_prime: derivePrimeSessionDuration({
        primeSessionDuration: clampedState?.lastSessionDurationByMode?.deep_prime ??
          clampedState?.primeSessionDuration,
      }),
      visualize: clampVisualizeSessionDuration(
        clampedState?.lastSessionDurationByMode?.visualize ??
          clampedState?.visualizeSessionDuration
      ),
    },
    lastSessionDurationOwnerUserId:
      typeof clampedState?.lastSessionDurationOwnerUserId === 'string'
        ? clampedState.lastSessionDurationOwnerUserId
        : null,
    sessionAudioDefaults,
    sessionAudioDefaultsOwnerUserId,
    sessionAudioDefaultsOwnerInitialized:
      clampedState?.sessionAudioDefaultsOwnerInitialized === true ||
      sessionAudioDefaultsOwnerUserId != null,
    sessionAudioDefaultsUpdatedAt,
    dailyPracticeGoal,
    dailyPracticeGoalPreset: normalizeDailyPracticeGoalPreset(
      clampedState?.dailyPracticeGoalPreset,
      dailyPracticeGoal
    ),
    weeklySummaryTime: normalizeWeeklySummaryTime(clampedState?.weeklySummaryTime),
    weeklySummaryDay: normalizeWeeklySummaryDay(clampedState?.weeklySummaryDay),
    threadStrengthSensitivity: normalizeThreadStrengthSensitivity(
      clampedState?.threadStrengthSensitivity
    ),
    restDays: normalizeRestDays(clampedState?.restDays),
    restDayPolicy: normalizeRestDayPolicy(clampedState?.restDayPolicy),
    reduceMotion: normalizeReduceMotionPreference(clampedState?.reduceMotion),
    developerSkipOnboardingEnabled: persistedState?.developerSkipOnboardingEnabled ?? false,
    developerFlowTestingEnabled: persistedState?.developerFlowTestingEnabled ?? false,
    developerForceStreakBreakEnabled: persistedState?.developerForceStreakBreakEnabled ?? false,
    developerDeleteWithoutBurnEnabled: persistedState?.developerDeleteWithoutBurnEnabled ?? false,
    developerMasterAccountEnabled: persistedState?.developerMasterAccountEnabled ?? false,
    developerWeeklySummaryPreviewToken: 0,
    debugLoggingEnabled:
      persistedState?.debugLoggingEnabled ?? getDefaultDebugLoggingEnabled(),
    analyticsEnabled: persistedState?.analyticsEnabled ?? true,
    traceDefaultEnabled: persistedState?.traceDefaultEnabled ?? true,
    traceSkipStreak:
      typeof persistedState?.traceSkipStreak === 'number'
        ? Math.max(0, Math.round(persistedState.traceSkipStreak))
        : 0,
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
  /** @deprecated Migration mirror only; active consumers use sessionAudioDefaults. */
  focusSessionAudio: SessionAudioMode;
  primeSessionDuration: number;
  visualizeSessionDuration: 60 | 180 | 300;
  lastSessionDurationByMode: LastSessionDurationByMode;
  lastSessionDurationOwnerUserId: string | null;
  /** @deprecated Migration mirror only; active consumers use sessionAudioDefaults. */
  primeSessionAudio: SessionAudioMode;
  sessionAudioDefaults: SessionAudioDefaultsByType;
  sessionAudioDefaultsOwnerUserId: string | null;
  sessionAudioDefaultsOwnerInitialized: boolean;
  sessionAudioDefaultsUpdatedAt: string | null;

  openDailyAnchorAutomatically: boolean;
  dailyPracticeGoal: number;
  dailyPracticeGoalPreset: DailyPracticeGoalPreset;
  threadStrengthSensitivity: ThreadStrengthSensitivity;
  restDays: number[];
  restDayPolicy: RestDayPolicy;
  arrivePhaseEnabled: boolean;
  reduceIntentionVisibility: boolean;
  weeklySummaryEnabled: boolean;
  weeklySummaryDay: number;
  weeklySummaryTime: string;

  // Appearance
  theme: 'zen_architect' | 'dark' | 'light';
  accentColor: string; // Hex color code
  vaultView: 'grid' | 'list';
  /** Ambient-animation preference. New installs default to 'off'; 'system' is legacy-only. */
  reduceMotion: ReduceMotionPreference;

  // Audio & Haptics
  mantraVoice: 'my_voice' | 'generated';
  generatedVoiceStyle: 'calm' | 'neutral' | 'intense';
  hapticIntensity: number; // 0-100
  soundEffectsEnabled: boolean;
  mantraAudioByDefault: boolean;
  developerModeEnabled: boolean;
  developerMasterAccountEnabled: boolean;
  developerSkipOnboardingEnabled: boolean;
  developerFlowTestingEnabled: boolean;
  developerForceStreakBreakEnabled: boolean;
  developerDeleteWithoutBurnEnabled: boolean;
  developerWeeklySummaryPreviewToken: number;
  debugLoggingEnabled: boolean;
  analyticsEnabled: boolean;
  traceDefaultEnabled: boolean;
  traceSkipStreak: number;
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
  /** @deprecated Use setSessionAudioDefaults. */
  setFocusSessionAudio: (mode: SessionAudioMode) => void;
  setPrimeSessionDuration: (durationSeconds: number) => void;
  setVisualizeSessionDuration: (durationSeconds: number) => void;
  setLastSessionDuration: (
    mode: keyof LastSessionDurationByMode,
    durationSeconds: number
  ) => void;
  /** @deprecated Use setSessionAudioDefaults. */
  setPrimeSessionAudio: (mode: SessionAudioMode) => void;
  setSessionAudioDefaults: (
    sessionType: SessionAudioSessionType,
    defaults: SessionAudioDefaults,
    ownerUserId?: string | null
  ) => void;
  setSessionAudioDefaultsByType: (
    defaults: SessionAudioDefaultsByType,
    ownerUserId?: string | null
  ) => void;
  bindSessionAudioDefaultsOwner: (ownerUserId: string | null) => void;
  applyRemoteSessionAudioDefaults: (params: {
    ownerUserId: string;
    defaults: SessionAudioDefaultsByType;
    updatedAt?: Date | string | null;
  }) => 'applied' | 'local_newer' | 'wrong_account';
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
  setWeeklySummaryDay: (day: number) => void;
  setWeeklySummaryTime: (time: string) => void;

  // Actions - Appearance
  setTheme: (theme: 'zen_architect' | 'dark' | 'light') => void;
  setAccentColor: (color: string) => void;
  setVaultView: (view: 'grid' | 'list') => void;
  setReduceMotion: (preference: ReduceMotionPreference) => void;

  // Actions - Audio & Haptics
  setMantraVoice: (voice: 'my_voice' | 'generated') => void;
  setGeneratedVoiceStyle: (style: 'calm' | 'neutral' | 'intense') => void;
  setHapticIntensity: (intensity: number) => void;
  setSoundEffectsEnabled: (enabled: boolean) => void;
  setMantraAudioByDefault: (enabled: boolean) => void;
  setDeveloperModeEnabled: (enabled: boolean) => void;
  setDeveloperMasterAccountEnabled: (enabled: boolean) => void;
  setDeveloperSkipOnboardingEnabled: (enabled: boolean) => void;
  setDeveloperFlowTestingEnabled: (enabled: boolean) => void;
  setDeveloperForceStreakBreakEnabled: (enabled: boolean) => void;
  setDeveloperDeleteWithoutBurnEnabled: (enabled: boolean) => void;
  triggerDeveloperWeeklySummaryPreview: () => void;
  clearDeveloperWeeklySummaryPreview: () => void;
  setDebugLoggingEnabled: (enabled: boolean) => void;
  setAnalyticsEnabled: (enabled: boolean) => void;
  setTraceDefaultEnabled: (enabled: boolean) => void;
  recordTraceSkipped: () => number;
  resetTraceSkipStreak: () => void;
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
    mode: 'ambient' as ActivationMode,
  },
  focusSessionMode: 'quick' as FocusSessionMode,
  focusSessionDuration: 30,
  focusSessionAudio: 'ambient' as SessionAudioMode,
  primeSessionDuration: 120,
  visualizeSessionDuration: 180 as const,
  lastSessionDurationByMode: {
    focus: 30,
    deep_prime: 120,
    visualize: 180,
  } as LastSessionDurationByMode,
  lastSessionDurationOwnerUserId: null as string | null,
  primeSessionAudio: 'ambient' as SessionAudioMode,
  sessionAudioDefaults: normalizeSessionAudioDefaultsByType(DEFAULT_SESSION_AUDIO_DEFAULTS),
  sessionAudioDefaultsOwnerUserId: null as string | null,
  sessionAudioDefaultsOwnerInitialized: false,
  sessionAudioDefaultsUpdatedAt: null as string | null,
  openDailyAnchorAutomatically: false,
  dailyPracticeGoal: 3,
  dailyPracticeGoalPreset: 'three' as DailyPracticeGoalPreset,
  threadStrengthSensitivity: 'balanced' as ThreadStrengthSensitivity,
  restDays: [] as number[],
  restDayPolicy: 'build' as RestDayPolicy,
  arrivePhaseEnabled: true,
  reduceIntentionVisibility: false,
  weeklySummaryEnabled: true,
  weeklySummaryDay: 0,
  weeklySummaryTime: '19:00',
  theme: 'zen_architect' as const,
  accentColor: '#D4AF37',
  vaultView: 'grid' as const,
  reduceMotion: 'off' as ReduceMotionPreference,
  mantraVoice: 'generated' as const,
  generatedVoiceStyle: 'calm' as const,
  hapticIntensity: 70,
  soundEffectsEnabled: true,
  mantraAudioByDefault: true,
  developerModeEnabled: false,
  developerMasterAccountEnabled: false,
  developerSkipOnboardingEnabled: false,
  developerFlowTestingEnabled: false,
  developerForceStreakBreakEnabled: false,
  developerDeleteWithoutBurnEnabled: false,
  developerWeeklySummaryPreviewToken: 0,
  debugLoggingEnabled: __DEV__ && process.env.EXPO_PUBLIC_DEBUG_LOGGING === 'true',
  analyticsEnabled: true,
  traceDefaultEnabled: true,
  traceSkipStreak: 0,
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
    (set, get) => ({
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

      setVisualizeSessionDuration: (durationSeconds) => {
        triggerHaptic();
        set({ visualizeSessionDuration: clampVisualizeSessionDuration(durationSeconds) });
      },

      setLastSessionDuration: (mode, durationSeconds) => {
        set((state) => ({
          lastSessionDurationByMode: {
            ...state.lastSessionDurationByMode,
            [mode]:
              mode === 'focus'
                ? clampFocusSessionDuration(durationSeconds)
                : mode === 'deep_prime'
                  ? clampPrimeSessionDuration(durationSeconds)
                  : clampVisualizeSessionDuration(durationSeconds),
          },
          lastSessionDurationOwnerUserId: state.sessionAudioDefaultsOwnerUserId,
        }));
      },

      setPrimeSessionAudio: (mode) => {
        triggerHaptic();
        set({
          primeSessionAudio: mode,
        });
      },

      setSessionAudioDefaults: (sessionType, defaults, ownerUserId) => {
        triggerHaptic();
        set((state) => ({
          sessionAudioDefaults: {
            ...state.sessionAudioDefaults,
            [sessionType]: normalizeSessionAudioDefaults(
              defaults,
              state.sessionAudioDefaults[sessionType]
            ),
          },
          sessionAudioDefaultsOwnerUserId:
            ownerUserId === undefined ? state.sessionAudioDefaultsOwnerUserId : ownerUserId,
          sessionAudioDefaultsOwnerInitialized:
            ownerUserId === undefined
              ? state.sessionAudioDefaultsOwnerInitialized
              : true,
          sessionAudioDefaultsUpdatedAt: new Date().toISOString(),
        }));
      },

      setSessionAudioDefaultsByType: (defaults, ownerUserId) => {
        triggerHaptic();
        set((state) => ({
          sessionAudioDefaults: normalizeSessionAudioDefaultsByType(
            defaults,
            state.sessionAudioDefaults
          ),
          sessionAudioDefaultsOwnerUserId:
            ownerUserId === undefined ? state.sessionAudioDefaultsOwnerUserId : ownerUserId,
          sessionAudioDefaultsOwnerInitialized:
            ownerUserId === undefined
              ? state.sessionAudioDefaultsOwnerInitialized
              : true,
          sessionAudioDefaultsUpdatedAt: new Date().toISOString(),
        }));
      },

      bindSessionAudioDefaultsOwner: (ownerUserId) => {
        const current = get();
        if (
          current.sessionAudioDefaultsOwnerInitialized &&
          current.sessionAudioDefaultsOwnerUserId === ownerUserId &&
          current.lastSessionDurationOwnerUserId === ownerUserId
        ) {
          return;
        }

        if (!current.sessionAudioDefaultsOwnerInitialized && ownerUserId != null) {
          set({
            sessionAudioDefaultsOwnerUserId: ownerUserId,
            sessionAudioDefaultsOwnerInitialized: true,
            lastSessionDurationByMode: {
              focus: DEFAULT_SETTINGS.focusSessionDuration,
              deep_prime: DEFAULT_SETTINGS.primeSessionDuration,
              visualize: DEFAULT_SETTINGS.visualizeSessionDuration,
            },
            lastSessionDurationOwnerUserId: ownerUserId,
          });
          return;
        }

        set({
          sessionAudioDefaults: normalizeSessionAudioDefaultsByType(
            DEFAULT_SESSION_AUDIO_DEFAULTS
          ),
          sessionAudioDefaultsOwnerUserId: ownerUserId,
          sessionAudioDefaultsOwnerInitialized: true,
          sessionAudioDefaultsUpdatedAt: null,
          lastSessionDurationByMode: {
            focus: DEFAULT_SETTINGS.focusSessionDuration,
            deep_prime: DEFAULT_SETTINGS.primeSessionDuration,
            visualize: DEFAULT_SETTINGS.visualizeSessionDuration,
          },
          lastSessionDurationOwnerUserId: ownerUserId,
        });
      },

      applyRemoteSessionAudioDefaults: ({ ownerUserId, defaults, updatedAt }) => {
        const current = get();
        if (
          current.sessionAudioDefaultsOwnerInitialized &&
          current.sessionAudioDefaultsOwnerUserId !== ownerUserId
        ) {
          return 'wrong_account';
        }

        const localTimestamp = current.sessionAudioDefaultsUpdatedAt
          ? Date.parse(current.sessionAudioDefaultsUpdatedAt)
          : 0;
        const remoteTimestamp = updatedAt ? new Date(updatedAt).getTime() : 0;
        if (
          current.sessionAudioDefaultsOwnerUserId === ownerUserId &&
          Number.isFinite(localTimestamp) &&
          localTimestamp > 0 &&
          (!Number.isFinite(remoteTimestamp) || localTimestamp > remoteTimestamp)
        ) {
          return 'local_newer';
        }

        set({
          sessionAudioDefaults: normalizeSessionAudioDefaultsByType(defaults),
          sessionAudioDefaultsOwnerUserId: ownerUserId,
          sessionAudioDefaultsOwnerInitialized: true,
          sessionAudioDefaultsUpdatedAt:
            Number.isFinite(remoteTimestamp) && remoteTimestamp > 0
              ? new Date(remoteTimestamp).toISOString()
              : null,
        });
        return 'applied';
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

      setWeeklySummaryDay: (day) => {
        triggerHaptic();
        set({
          weeklySummaryDay: normalizeWeeklySummaryDay(day),
        });
      },

      setWeeklySummaryTime: (time) => {
        triggerHaptic();
        set({
          weeklySummaryTime: normalizeWeeklySummaryTime(time),
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

      setReduceMotion: (preference) => {
        triggerHaptic();
        set({
          reduceMotion: normalizeReduceMotionPreference(preference),
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

      setDeveloperFlowTestingEnabled: (enabled: boolean) => {
        triggerHaptic();
        set({
          developerFlowTestingEnabled: enabled,
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

      setAnalyticsEnabled: (enabled) => {
        triggerHaptic();
        set({
          analyticsEnabled: enabled,
        });
      },

      setTraceDefaultEnabled: (enabled) => {
        triggerHaptic();
        set({
          traceDefaultEnabled: enabled,
        });
      },

      recordTraceSkipped: () => {
        let nextStreak = 0;
        set((state) => {
          nextStreak = Math.max(0, state.traceSkipStreak ?? 0) + 1;
          return {
            traceSkipStreak: nextStreak,
          };
        });
        return nextStreak;
      },

      resetTraceSkipStreak: () => {
        set({
          traceSkipStreak: 0,
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
      // DEFERRED: version: 10, — restore post-launch
      version: 15,
      // Handle migration
      migrate: (persistedState: any, version: number) => {
        if (version === 11) {
          return withDeveloperSettingsDefaults(persistedState);
        }
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
            developerFlowTestingEnabled: false,
            developerForceStreakBreakEnabled: false,
            developerDeleteWithoutBurnEnabled: false,
            developerMasterAccountEnabled: false,
          });
        }
        if (version === 6) {
          return withDeveloperSettingsDefaults(persistedState, {
            debugLoggingEnabled: false,
            developerSkipOnboardingEnabled: false,
            developerFlowTestingEnabled: false,
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
            developerFlowTestingEnabled: false,
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
            developerFlowTestingEnabled: false,
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
            developerFlowTestingEnabled: false,
            developerForceStreakBreakEnabled: false,
            developerDeleteWithoutBurnEnabled: false,
            developerMasterAccountEnabled: false,
          });
        }
        if (version === 2) {
          return withDeveloperSettingsDefaults(persistedState, {
            debugLoggingEnabled: false,
            developerSkipOnboardingEnabled: false,
            developerFlowTestingEnabled: false,
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
              weeklySummaryEnabled: persistedState.weeklyReflectionEnabled ?? false,
            },
            {
            debugLoggingEnabled: false,
            developerSkipOnboardingEnabled: false,
            developerFlowTestingEnabled: false,
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
              weeklySummaryEnabled: persistedState.weeklyReflectionEnabled ?? false,
            },
            {
            debugLoggingEnabled: false,
            developerSkipOnboardingEnabled: false,
            developerFlowTestingEnabled: false,
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
        visualizeSessionDuration: state.visualizeSessionDuration,
        lastSessionDurationByMode: state.lastSessionDurationByMode,
        lastSessionDurationOwnerUserId: state.lastSessionDurationOwnerUserId,
        primeSessionAudio: state.primeSessionAudio,
        sessionAudioDefaults: state.sessionAudioDefaults,
        sessionAudioDefaultsOwnerUserId: state.sessionAudioDefaultsOwnerUserId,
        sessionAudioDefaultsOwnerInitialized: state.sessionAudioDefaultsOwnerInitialized,
        sessionAudioDefaultsUpdatedAt: state.sessionAudioDefaultsUpdatedAt,
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
        reduceMotion: state.reduceMotion,
        mantraVoice: state.mantraVoice,
        generatedVoiceStyle: state.generatedVoiceStyle,
        hapticIntensity: state.hapticIntensity,
        soundEffectsEnabled: state.soundEffectsEnabled,
        mantraAudioByDefault: state.mantraAudioByDefault,
        weeklySummaryDay: state.weeklySummaryDay,
        weeklySummaryTime: state.weeklySummaryTime,
        developerModeEnabled: state.developerModeEnabled,
        developerMasterAccountEnabled: state.developerMasterAccountEnabled,
        developerSkipOnboardingEnabled: state.developerSkipOnboardingEnabled,
        developerFlowTestingEnabled: state.developerFlowTestingEnabled,
        developerForceStreakBreakEnabled: state.developerForceStreakBreakEnabled,
        developerDeleteWithoutBurnEnabled: state.developerDeleteWithoutBurnEnabled,
        debugLoggingEnabled: state.debugLoggingEnabled,
        analyticsEnabled: state.analyticsEnabled,
        traceDefaultEnabled: state.traceDefaultEnabled,
        traceSkipStreak: state.traceSkipStreak,
        guideMode: state.guideMode,
      }),
    }
  )
);
