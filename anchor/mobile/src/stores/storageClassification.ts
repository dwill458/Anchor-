export type StorageClass =
  | 'token'
  | 'identity'
  | 'high_sensitivity_telemetry'
  | 'low_sensitivity_preferences';

export interface StoreClassificationMatrix {
  [storeName: string]: Record<string, StorageClass | 'session_only'>;
}

/**
 * Data classification matrix for persisted mobile stores.
 *
 * Classes:
 * - token: credentials/session secrets
 * - identity: user profile and account linkage
 * - high_sensitivity_telemetry: behavioral/practice history, anchor content
 * - low_sensitivity_preferences: UX flags and non-sensitive app settings
 */
export const STORAGE_CLASSIFICATION_MATRIX: StoreClassificationMatrix = {
  authStore: {
    token: 'token',
    user: 'identity',
    isAuthenticated: 'identity',
    hasCompletedOnboarding: 'low_sensitivity_preferences',
    onboardingSegment: 'low_sensitivity_preferences',
    shouldRedirectToCreation: 'low_sensitivity_preferences',
    anchorCount: 'high_sensitivity_telemetry',
    pendingForgeIntent: 'session_only',
    pendingForgeResumeTarget: 'session_only',
    pendingFirstAnchorDraft: 'high_sensitivity_telemetry',
    pendingFirstAnchorMutations: 'high_sensitivity_telemetry',
    pendingFirstAnchorError: 'low_sensitivity_preferences',
    profileData: 'identity',
    profileLastFetched: 'low_sensitivity_preferences',
    wallpaperPromptSeen: 'low_sensitivity_preferences',
  },
  anchorStore: {
    anchors: 'high_sensitivity_telemetry',
    lastSyncedAt: 'high_sensitivity_telemetry',
    currentAnchorId: 'high_sensitivity_telemetry',
    isLoading: 'session_only',
    error: 'session_only',
  },
  sessionStore: {
    lastSession: 'high_sensitivity_telemetry',
    todayPractice: 'high_sensitivity_telemetry',
    weeklyPractice: 'high_sensitivity_telemetry',
    lastGraceDayUsedAt: 'high_sensitivity_telemetry',
    sessionLog: 'high_sensitivity_telemetry',
    threadStrength: 'high_sensitivity_telemetry',
    totalSessionsCount: 'high_sensitivity_telemetry',
    lastPrimedAt: 'high_sensitivity_telemetry',
    weekHistory: 'high_sensitivity_telemetry',
    weekHistoryKey: 'high_sensitivity_telemetry',
    lastDecayDate: 'high_sensitivity_telemetry',
  },
  teachingStore: {
    schemaVersion: 'low_sensitivity_preferences',
    showCounts: 'high_sensitivity_telemetry',
    lastShownAt: 'high_sensitivity_telemetry',
    exhaustedIds: 'high_sensitivity_telemetry',
    pendingMilestones: 'high_sensitivity_telemetry',
    lastVeilCardAt: 'high_sensitivity_telemetry',
    userFlags: 'high_sensitivity_telemetry',
    traceHintSeenCounts: 'high_sensitivity_telemetry',
    traceHintExhaustedIds: 'high_sensitivity_telemetry',
    sessionSeenIds: 'session_only',
    sessionSeenPatterns: 'session_only',
  },
  settingsStore: {
    language: 'low_sensitivity_preferences',
    notificationsEnabled: 'low_sensitivity_preferences',
    reminderTime: 'low_sensitivity_preferences',
    biometricLockEnabled: 'low_sensitivity_preferences',
    hapticsEnabled: 'low_sensitivity_preferences',
    soundEnabled: 'low_sensitivity_preferences',
    colorScheme: 'low_sensitivity_preferences',
  },
};
