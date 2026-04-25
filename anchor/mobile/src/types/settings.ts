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
  hapticFeedback: 'none' | 'light' | 'medium' | 'strong';
  soundEffectsEnabled: boolean;
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
  hapticFeedback: 'strong',
  soundEffectsEnabled: true,
};
