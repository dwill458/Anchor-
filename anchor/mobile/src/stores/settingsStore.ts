import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export type ChargeMode = 'focus' | 'ritual';
export type ChargeDurationPreset = '30s' | '1m' | '2m' | '5m' | '10m' | 'custom';

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
    customMinutes: clampNumber(setting.customMinutes ?? 5, 1, 30),
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
) => ({
  ...clampPersistedSettings(persistedState),
  developerSkipOnboardingEnabled: persistedState?.developerSkipOnboardingEnabled ?? false,
  developerForceStreakBreakEnabled: persistedState?.developerForceStreakBreakEnabled ?? false,
  developerDeleteWithoutBurnEnabled: persistedState?.developerDeleteWithoutBurnEnabled ?? false,
  developerMasterAccountEnabled: persistedState?.developerMasterAccountEnabled ?? false,
  developerWeeklySummaryPreviewToken: 0,
  debugLoggingEnabled:
    persistedState?.debugLoggingEnabled ?? getDefaultDebugLoggingEnabled(),
  ...overrides,
});

/**
 * Settings state interface
 */
export interface SettingsState {
  // Practice Settings
  defaultCharge: DefaultChargeSetting;
  defaultActivation: DefaultActivationSetting;

  openDailyAnchorAutomatically: boolean;
  dailyPracticeGoal: number;
  reduceIntentionVisibility: boolean;

  // Notifications
  dailyReminderEnabled: boolean;
  dailyReminderTime: string; // Format: "HH:MM"
  streakProtectionAlerts: boolean;
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

  // Actions - Practice Settings
  setDefaultCharge: (setting: DefaultChargeSetting) => void;
  setDefaultActivation: (setting: DefaultActivationSetting) => void;
  setDefaultActivationMode: (mode: ActivationMode) => void;
  setGuideMode: (enabled: boolean) => void;
  setOpenDailyAnchorAutomatically: (enabled: boolean) => void;
  setDailyPracticeGoal: (goal: number) => void;
  setReduceIntentionVisibility: (enabled: boolean) => void;

  // Actions - Notifications
  setDailyReminderEnabled: (enabled: boolean) => void;
  setDailyReminderTime: (time: string) => void;
  setStreakProtectionAlerts: (enabled: boolean) => void;
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
  openDailyAnchorAutomatically: false,
  dailyPracticeGoal: 3,
  reduceIntentionVisibility: false,
  dailyReminderEnabled: false,
  dailyReminderTime: '09:00',
  streakProtectionAlerts: false,
  weeklySummaryEnabled: false,
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
        set({
          defaultCharge: normalizeDefaultCharge(setting),
        });
      },

      setDefaultActivation: (setting) => {
        triggerHaptic();
        set({
          defaultActivation: normalizeDefaultActivation(setting),
        });
      },

      setDefaultActivationMode: (mode) => {
        triggerHaptic();
        set((state) => ({
          defaultActivation: { ...state.defaultActivation, mode },
        }));
      },

      setOpenDailyAnchorAutomatically: (enabled) => {
        triggerHaptic();
        set({
          openDailyAnchorAutomatically: enabled,
        });
      },

      setDailyPracticeGoal: (goal) => {
        triggerHaptic();
        set({
          dailyPracticeGoal: Math.max(1, Math.min(20, goal)),
        });
      },

      setReduceIntentionVisibility: (enabled) => {
        triggerHaptic();
        set({
          reduceIntentionVisibility: enabled,
        });
      },

      // Notifications Actions
      setDailyReminderEnabled: (enabled) => {
        triggerHaptic();
        set({
          dailyReminderEnabled: enabled,
        });
      },

      setDailyReminderTime: (time) => {
        triggerHaptic();
        set({
          dailyReminderTime: time,
        });
      },

      setStreakProtectionAlerts: (enabled) => {
        triggerHaptic();
        set({
          streakProtectionAlerts: enabled,
        });
      },

      setWeeklySummaryEnabled: (enabled) => {
        triggerHaptic();
        set({
          weeklySummaryEnabled: enabled,
        });
      },

      // Appearance Actions
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

      // Audio & Haptics Actions
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
      version: 9,
      // Handle migration
      migrate: (persistedState: any, version: number) => {
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
        openDailyAnchorAutomatically: state.openDailyAnchorAutomatically,
        dailyPracticeGoal: state.dailyPracticeGoal,
        reduceIntentionVisibility: state.reduceIntentionVisibility,
        dailyReminderEnabled: state.dailyReminderEnabled,
        dailyReminderTime: state.dailyReminderTime,
        streakProtectionAlerts: state.streakProtectionAlerts,
        weeklySummaryEnabled: state.weeklySummaryEnabled,
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
