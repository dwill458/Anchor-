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
import type { HapticStrength, MantraVoice, VoiceStyle } from '@/types';

/**
 * Settings state interface
 */
export interface SettingsState {
  // Practice Settings
  defaultChargeType: 'quick' | 'deep'; // DEPRECATED: use defaultChargeMode + defaultChargeDuration
  defaultChargeMode: 'focus' | 'ritual';
  defaultChargeDuration: number; // in seconds
  defaultActivationType: 'visual' | 'mantra' | 'full';
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
  mantraVoice: MantraVoice;
  voiceStyle: VoiceStyle;
  hapticStrength: HapticStrength;
  soundEffectsEnabled: boolean;

  // Actions - Practice Settings
  setDefaultChargeType: (type: 'quick' | 'deep') => void;
  setDefaultChargeMode: (mode: 'focus' | 'ritual') => void;
  setDefaultChargeDuration: (duration: number) => void;
  setDefaultActivationType: (type: 'visual' | 'mantra' | 'full') => void;
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
  setMantraVoice: (voice: MantraVoice) => void;
  setVoiceStyle: (style: VoiceStyle) => void;
  setHapticStrength: (strength: HapticStrength) => void;
  setSoundEffectsEnabled: (enabled: boolean) => void;

  // Utility Actions
  resetToDefaults: () => void;
}

/**
 * Default settings values
 */
const DEFAULT_SETTINGS = {
  defaultChargeType: 'quick' as const,
  defaultChargeMode: 'focus' as const,
  defaultChargeDuration: 120, // 2 minutes
  defaultActivationType: 'visual' as const,
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
  mantraVoice: 'voice_one' as const,
  voiceStyle: 'calm' as const,
  hapticStrength: 'medium' as const,
  soundEffectsEnabled: true,
};

export const MANTRA_VOICE_OPTIONS: Array<{ label: string; value: MantraVoice }> = [
  { label: 'Voice One', value: 'voice_one' },
  { label: 'Silent', value: 'silent' },
];

export const VOICE_STYLE_OPTIONS: Array<{ label: string; value: VoiceStyle }> = [
  { label: 'Calm', value: 'calm' },
  { label: 'Focused', value: 'focused' },
  { label: 'Intense', value: 'intense' },
];

export const HAPTIC_STRENGTH_OPTIONS: Array<{ label: string; value: HapticStrength }> = [
  { label: 'Off', value: 'off' },
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

const getOptionLabel = <T extends string>(
  options: Array<{ label: string; value: T }>,
  value: T | string,
  fallback: string
): string => options.find((option) => option.value === value)?.label ?? fallback;

export const getMantraVoiceLabel = (value: MantraVoice | string): string =>
  getOptionLabel(MANTRA_VOICE_OPTIONS, value, 'Voice One');

export const getVoiceStyleLabel = (value: VoiceStyle | string): string =>
  getOptionLabel(VOICE_STYLE_OPTIONS, value, 'Calm');

export const getHapticStrengthLabel = (value: HapticStrength | string): string =>
  getOptionLabel(HAPTIC_STRENGTH_OPTIONS, value, 'Medium');

const normalizeMantraVoice = (value: unknown): MantraVoice => {
  if (value === 'voice_one' || value === 'silent') return value;
  if (value === 'my_voice' || value === 'generated') return 'voice_one';
  return DEFAULT_SETTINGS.mantraVoice;
};

const normalizeVoiceStyle = (value: unknown): VoiceStyle => {
  if (value === 'calm' || value === 'focused' || value === 'intense') return value;
  if (value === 'neutral') return 'calm';
  return DEFAULT_SETTINGS.voiceStyle;
};

const normalizeHapticStrength = (value: unknown): HapticStrength => {
  if (value === 'off' || value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }

  if (typeof value === 'number') {
    if (value <= 0) return 'off';
    if (value <= 40) return 'low';
    if (value <= 75) return 'medium';
    return 'high';
  }

  return DEFAULT_SETTINGS.hapticStrength;
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
      setDefaultChargeType: (type) =>
        set({
          defaultChargeType: type,
        }),

      setDefaultChargeMode: (mode) =>
        set({
          defaultChargeMode: mode,
        }),

      setDefaultChargeDuration: (duration) =>
        set({
          defaultChargeDuration: Math.max(30, Math.min(1800, duration)), // 30s - 30m
        }),

      setDefaultActivationType: (type) =>
        set({
          defaultActivationType: type,
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

      setVoiceStyle: (style) =>
        set({
          voiceStyle: style,
        }),

      setHapticStrength: (strength) =>
        set({
          hapticStrength: strength,
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
      version: 2,
      migrate: (persistedState) => {
        const state = (persistedState || {}) as Partial<SettingsState> & {
          generatedVoiceStyle?: unknown;
          hapticIntensity?: unknown;
        };

        return {
          ...DEFAULT_SETTINGS,
          ...state,
          mantraVoice: normalizeMantraVoice(state.mantraVoice),
          voiceStyle: normalizeVoiceStyle(
            (state as Partial<SettingsState>).voiceStyle ?? state.generatedVoiceStyle
          ),
          hapticStrength: normalizeHapticStrength(
            (state as Partial<SettingsState>).hapticStrength ?? state.hapticIntensity
          ),
          soundEffectsEnabled:
            typeof state.soundEffectsEnabled === 'boolean'
              ? state.soundEffectsEnabled
              : DEFAULT_SETTINGS.soundEffectsEnabled,
        };
      },
      // Only persist user preference settings
      partialize: (state) => ({
        defaultChargeType: state.defaultChargeType,
        defaultChargeMode: state.defaultChargeMode,
        defaultChargeDuration: state.defaultChargeDuration,
        defaultActivationType: state.defaultActivationType,
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
        voiceStyle: state.voiceStyle,
        hapticStrength: state.hapticStrength,
        soundEffectsEnabled: state.soundEffectsEnabled,
      }),
    }
  )
);
