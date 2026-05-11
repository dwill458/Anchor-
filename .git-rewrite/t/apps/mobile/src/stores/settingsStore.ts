import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export type ChargeMode = 'focus' | 'ritual';
export type ChargeDurationPreset = '30s' | '2m' | '5m' | '10m' | 'custom';

export interface DefaultChargeSetting {
  mode: ChargeMode;
  preset: ChargeDurationPreset;
  customMinutes?: number;
}

export type ActivationType = 'visual' | 'mantra' | 'full' | 'breath_visual';
export type ActivationUnit = 'seconds' | 'reps' | 'minutes' | 'breaths';

export interface DefaultActivationSetting {
  type: ActivationType;
  value: number;
  unit: ActivationUnit;
}

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

  // Actions - Practice Settings
  setDefaultCharge: (setting: DefaultChargeSetting) => void;
  setDefaultActivation: (setting: DefaultActivationSetting) => void;
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

  // Utility Actions
  resetToDefaults: () => void;
}

/**
 * Default settings values
 */
const DEFAULT_SETTINGS = {
  defaultCharge: {
    mode: 'focus' as ChargeMode,
    preset: '30s' as ChargeDurationPreset,
  },
  defaultActivation: {
    type: 'visual' as ActivationType,
    value: 10,
    unit: 'seconds' as ActivationUnit,
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
          defaultCharge: setting,
        });
      },

      setDefaultActivation: (setting) => {
        triggerHaptic();
        set({
          defaultActivation: setting,
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
      version: 2,
      // Handle migration
      migrate: (persistedState: any, version: number) => {
        if (version === 1) {
          // Migration from version 1 to 2 (renaming fields)
          return {
            ...persistedState,
            openDailyAnchorAutomatically: persistedState.autoOpenDailyAnchor ?? false,
            streakProtectionAlerts: persistedState.streakProtectionEnabled ?? false,
            weeklySummaryEnabled: persistedState.weeklyReflectionEnabled ?? false,
          };
        }
        if (version === 0) {
          // Legacy migration
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

          return {
            ...persistedState,
            defaultCharge,
            defaultActivation,
            openDailyAnchorAutomatically: persistedState.autoOpenDailyAnchor ?? false,
            streakProtectionAlerts: persistedState.streakProtectionEnabled ?? false,
            weeklySummaryEnabled: persistedState.weeklyReflectionEnabled ?? false,
          };
        }
        return persistedState;
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
      }),
    }
  )
);
