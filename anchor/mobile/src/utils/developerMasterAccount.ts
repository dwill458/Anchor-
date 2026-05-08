import type { User } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';

export const DEVELOPER_MASTER_ACCOUNT_ID = 'dev-master-account';
export const DEVELOPER_MASTER_ACCOUNT_TOKEN = 'mock-dev-master-token';

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
