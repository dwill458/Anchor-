export type PrimingMode = 'quick' | 'deep';
export type PrimingDuration = 30 | 120 | 300;
export type FocusDuration = 10 | 30 | 60 | number;
export type FocusDefaultMode = 'silent' | 'ambient';
export type FocusBurstGoal = 1 | 3 | 5 | 7 | number;
export type SubscriptionTier = 'free' | 'pro' | 'trial' | 'expired';

export interface AnchorSettings {
  primingMode: PrimingMode;
  primingDuration: PrimingDuration;
  openDailyAnchorAutomatically: boolean;
  practiceGuidanceEnabled: boolean;
  focusDuration: FocusDuration;
  focusDefaultMode: FocusDefaultMode;
  focusBurstGoal: FocusBurstGoal;
  reduceIntentionVisibility: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  streakProtectionAlertsEnabled: boolean;
  weeklySummaryEnabled: boolean;
  hapticFeedback: 'none' | 'light' | 'medium' | 'strong';
  soundEffectsEnabled: boolean;
  dev_developerModeEnabled: boolean;
  dev_overridesEnabled: boolean;
  dev_simulatedTier: SubscriptionTier;
  dev_masterAccount: boolean;
  dev_skipOnboarding: boolean;
  dev_allowDirectAnchorDelete: boolean;
  dev_debugLogging: boolean;
  dev_forceStreakBreak: boolean;
}

export const DEFAULT_SETTINGS: AnchorSettings = {
  primingMode: 'quick',
  primingDuration: 30,
  openDailyAnchorAutomatically: false,
  practiceGuidanceEnabled: true,
  focusDuration: 10,
  focusDefaultMode: 'silent',
  focusBurstGoal: 3,
  reduceIntentionVisibility: false,
  dailyReminderEnabled: false,
  dailyReminderTime: '09:00',
  streakProtectionAlertsEnabled: false,
  weeklySummaryEnabled: false,
  hapticFeedback: 'strong',
  soundEffectsEnabled: true,
  dev_developerModeEnabled: true,
  dev_overridesEnabled: true,
  dev_simulatedTier: 'pro',
  dev_masterAccount: false,
  dev_skipOnboarding: false,
  dev_allowDirectAnchorDelete: false,
  dev_debugLogging: false,
  dev_forceStreakBreak: false,
};
