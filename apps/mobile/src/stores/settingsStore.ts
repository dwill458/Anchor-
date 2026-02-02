/**
 * Anchor App - Settings Store
 *
 * Global state management for user settings and preferences using Zustand.
 * Handles all settings across Practice, Notifications, Appearance, Audio & Haptics,
 * and Data & Privacy sections.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  autoOpenDailyAnchor: boolean;
  dailyPracticeGoal: number;
  reduceIntentionVisibility: boolean;

  // Notifications
  dailyReminderEnabled: boolean;
  dailyReminderTime: string; // Format: "HH:MM"
  streakProtectionEnabled: boolean;
  weeklyReflectionEnabled: boolean;

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
  setAutoOpenDailyAnchor: (enabled: boolean) => void;
  setDailyPracticeGoal: (goal: number) => void;
  setReduceIntentionVisibility: (enabled: boolean) => void;

  // Actions - Notifications
  setDailyReminderEnabled: (enabled: boolean) => void;
  setDailyReminderTime: (time: string) => void;
  setStreakProtectionEnabled: (enabled: boolean) => void;
  setWeeklyReflectionEnabled: (enabled: boolean) => void;

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
  autoOpenDailyAnchor: false,
  dailyPracticeGoal: 3,
  reduceIntentionVisibility: false,
  dailyReminderEnabled: false,
  dailyReminderTime: '09:00',
  streakProtectionEnabled: false,
  weeklyReflectionEnabled: false,
  theme: 'zen_architect' as const,
  accentColor: '#D4AF37',
  vaultView: 'grid' as const,
  mantraVoice: 'generated' as const,
  generatedVoiceStyle: 'calm' as const,
  hapticIntensity: 70,
  soundEffectsEnabled: true,
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
      setDefaultCharge: (setting) =>
        set({
          defaultCharge: setting,
        }),

      setDefaultActivation: (setting) =>
        set({
          defaultActivation: setting,
        }),

      setAutoOpenDailyAnchor: (enabled) =>
        set({
          autoOpenDailyAnchor: enabled,
        }),

      setDailyPracticeGoal: (goal) =>
        set({
          dailyPracticeGoal: Math.max(1, Math.min(10, goal)),
        }),

      setReduceIntentionVisibility: (enabled) =>
        set({
          reduceIntentionVisibility: enabled,
        }),

      // Notifications Actions
      setDailyReminderEnabled: (enabled) =>
        set({
          dailyReminderEnabled: enabled,
        }),

      setDailyReminderTime: (time) =>
        set({
          dailyReminderTime: time,
        }),

      setStreakProtectionEnabled: (enabled) =>
        set({
          streakProtectionEnabled: enabled,
        }),

      setWeeklyReflectionEnabled: (enabled) =>
        set({
          weeklyReflectionEnabled: enabled,
        }),

      // Appearance Actions
      setTheme: (theme) =>
        set({
          theme,
        }),

      setAccentColor: (color) =>
        set({
          accentColor: color,
        }),

      setVaultView: (view) =>
        set({
          vaultView: view,
        }),

      // Audio & Haptics Actions
      setMantraVoice: (voice) =>
        set({
          mantraVoice: voice,
        }),

      setGeneratedVoiceStyle: (style) =>
        set({
          generatedVoiceStyle: style,
        }),

      setHapticIntensity: (intensity) =>
        set({
          hapticIntensity: Math.max(0, Math.min(100, intensity)),
        }),

      setSoundEffectsEnabled: (enabled) =>
        set({
          soundEffectsEnabled: enabled,
        }),

      // Utility Actions
      resetToDefaults: () =>
        set({
          ...DEFAULT_SETTINGS,
        }),
    }),
    {
      name: 'anchor-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Handle migration from old flat structure to nested structure
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Map old flat properties to new nested objects if they exist
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
          };
        }
        return persistedState;
      },
      // Only persist user preference settings
      partialize: (state) => ({
        defaultCharge: state.defaultCharge,
        defaultActivation: state.defaultActivation,
        autoOpenDailyAnchor: state.autoOpenDailyAnchor,
        dailyPracticeGoal: state.dailyPracticeGoal,
        reduceIntentionVisibility: state.reduceIntentionVisibility,
        dailyReminderEnabled: state.dailyReminderEnabled,
        dailyReminderTime: state.dailyReminderTime,
        streakProtectionEnabled: state.streakProtectionEnabled,
        weeklyReflectionEnabled: state.weeklyReflectionEnabled,
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
