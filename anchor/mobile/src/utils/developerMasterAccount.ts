import type { User } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { resolveChartFeatureFlags } from '@/types/chart';

export const DEVELOPER_MASTER_ACCOUNT_ID = 'dev-master-account';
export const DEVELOPER_MASTER_ACCOUNT_TOKEN = process.env.EXPO_PUBLIC_DEV_MASTER_TOKEN ?? '';

export function isDeveloperMasterAccountEnabled(): boolean {
  return __DEV__ && useSettingsStore.getState().developerMasterAccountEnabled;
}

export function createDeveloperMasterUser(overrides: Partial<User> = {}): User {
  return {
    id: DEVELOPER_MASTER_ACCOUNT_ID,
    email: 'dev+master@anchor.local',
    displayName: 'Developer Master',
    hasCompletedOnboarding: true,
    isComped: true,
    subscriptionStatus: 'pro',
    // The synthetic Master Account bypasses /api/auth/me, so provide the
    // server-shaped flags locally while still honoring the build-time gate.
    chartFlags: resolveChartFeatureFlags({
      chart_enabled: true,
      chart_write_enabled: true,
      chart_ai_planner_enabled: true,
      chart_reflections_enabled: true,
      chart_notifications_enabled: true,
      chart_existing_user_intro_enabled: true,
    }),
    totalAnchorsCreated: 0,
    totalActivations: 0,
    currentStreak: 0,
    longestStreak: 0,
    stabilizesTotal: 0,
    stabilizeStreakDays: 0,
    createdAt: new Date(),
    ...overrides,
  };
}
