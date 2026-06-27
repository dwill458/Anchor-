import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { SessionLogEntry } from '@/stores/sessionStore';
import { logger } from '@/utils/logger';

export type ReviewSignal =
  | 'anchor_created'
  | 'focus_session_completed'
  | 'practice_day_completed';

export type ReviewRequestSource = 'focus_session_complete' | 'settings_rate_anchor';

export type ReviewEligibilityContext = {
  isOnboarding?: boolean;
  isAnchorCreation?: boolean;
  isPaywall?: boolean;
  isActiveFocusSession?: boolean;
  isActiveDeepPrimeSession?: boolean;
  recentSessionFailed?: boolean;
  isReturningToHomeAfterFocusSession?: boolean;
  now?: Date;
};

export const REVIEW_STORAGE_KEYS = {
  lastPromptAttemptAt: 'anchor.review.lastPromptAttemptAt',
} as const;

const REVIEW_THROTTLE_DAYS = 90;
const REVIEW_THROTTLE_MS = REVIEW_THROTTLE_DAYS * 24 * 60 * 60 * 1000;
const ANDROID_PACKAGE_NAME =
  Constants.expoConfig?.android?.package ?? 'com.anchorintentions.app';
const IOS_BUNDLE_IDENTIFIER =
  Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.anchorintentions.app';

type ReviewStats = {
  anchorsCreated: number;
  focusSessionsCompleted: number;
  uniquePracticeDays: number;
};

type PracticeEntry = Pick<SessionLogEntry, 'id' | 'type' | 'completedAt'> & {
  localDate?: string;
};

const devLog = (message: string, details?: Record<string, unknown>) => {
  if (__DEV__) {
    logger.info(`[ReviewPrompt] ${message}`, details ?? {});
  }
};

const parsePromptDate = (value: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const localDateFromCompletedAt = (completedAt: string): string | null => {
  const completedAtDate = new Date(completedAt);
  if (Number.isNaN(completedAtDate.getTime())) {
    return null;
  }

  return `${completedAtDate.getFullYear()}-${String(completedAtDate.getMonth() + 1).padStart(2, '0')}-${String(completedAtDate.getDate()).padStart(2, '0')}`;
};

const collectPracticeEntries = (): PracticeEntry[] => {
  const sessionState = useSessionStore.getState();
  const entries = new Map<string, PracticeEntry>();

  sessionState.primingHistory.forEach((entry) => {
    entries.set(entry.id, {
      id: entry.id,
      type: entry.type,
      completedAt: entry.completedAt,
      localDate: entry.localDate,
    });
  });

  sessionState.sessionLog.forEach((entry) => {
    entries.set(entry.id, entry);
  });

  return Array.from(entries.values());
};

const getReviewStats = (): ReviewStats => {
  const anchorsCreated = useAnchorStore.getState().anchors.length;
  const focusEntries = collectPracticeEntries().filter((entry) => entry.type === 'activate');
  const uniquePracticeDays = new Set(
    focusEntries
      .map((entry) => entry.localDate ?? localDateFromCompletedAt(entry.completedAt))
      .filter((date): date is string => Boolean(date))
  ).size;

  return {
    anchorsCreated,
    focusSessionsCompleted: focusEntries.length,
    uniquePracticeDays,
  };
};

const openUrl = async (url: string): Promise<boolean> => {
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    return false;
  }

  await Linking.openURL(url);
  return true;
};

export const recordReviewSignal = async (signal: ReviewSignal): Promise<void> => {
  devLog('signal recorded from existing app stats', { signal });
};

export const shouldRequestReview = async (
  context: ReviewEligibilityContext = {}
): Promise<boolean> => {
  const now = context.now ?? new Date();
  const stats = getReviewStats();
  const lastPromptAttemptAt = parsePromptDate(
    await AsyncStorage.getItem(REVIEW_STORAGE_KEYS.lastPromptAttemptAt)
  );
  const blockers = {
    isOnboarding: context.isOnboarding === true,
    isAnchorCreation: context.isAnchorCreation === true,
    isPaywall: context.isPaywall === true,
    isActiveFocusSession: context.isActiveFocusSession === true,
    isActiveDeepPrimeSession: context.isActiveDeepPrimeSession === true,
    recentSessionFailed: context.recentSessionFailed === true,
    notReturningHomeAfterFocusSession: context.isReturningToHomeAfterFocusSession === false,
  };
  const throttled =
    lastPromptAttemptAt != null &&
    now.getTime() - lastPromptAttemptAt.getTime() < REVIEW_THROTTLE_MS;

  const eligible =
    stats.anchorsCreated >= 1 &&
    stats.focusSessionsCompleted >= 3 &&
    stats.uniquePracticeDays >= 2 &&
    !throttled &&
    !Object.values(blockers).some(Boolean);

  devLog('eligibility evaluated', {
    eligible,
    ...stats,
    throttled,
    lastPromptAttemptAt: lastPromptAttemptAt?.toISOString() ?? null,
    ...blockers,
  });

  return eligible;
};

export const requestReviewIfEligible = async (
  source: ReviewRequestSource,
  context: ReviewEligibilityContext = {}
): Promise<boolean> => {
  if (source !== 'focus_session_complete') {
    devLog('skipped unsupported review request source', { source });
    return false;
  }

  if (context.isReturningToHomeAfterFocusSession !== true) {
    devLog('skipped outside home return trigger', { source });
    return false;
  }

  const eligible = await shouldRequestReview(context);
  if (!eligible) {
    return false;
  }

  const canAsk = await StoreReview.hasAction();
  if (!canAsk) {
    devLog('native review action unavailable', { source });
    return false;
  }

  await AsyncStorage.setItem(
    REVIEW_STORAGE_KEYS.lastPromptAttemptAt,
    (context.now ?? new Date()).toISOString()
  );

  try {
    await StoreReview.requestReview();
    devLog('native review requested', { source });
    return true;
  } catch (error) {
    logger.warn('[ReviewPrompt] Native review request failed', error);
    return false;
  }
};

export const openStoreListing = async (): Promise<boolean> => {
  const configuredStoreUrl = StoreReview.storeUrl();
  if (configuredStoreUrl && (await openUrl(configuredStoreUrl))) {
    return true;
  }

  if (Platform.OS === 'android') {
    const marketUrl = `market://details?id=${ANDROID_PACKAGE_NAME}`;
    if (await openUrl(marketUrl)) {
      return true;
    }

    return openUrl(`https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`);
  }

  if (Platform.OS === 'ios') {
    const response = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(IOS_BUNDLE_IDENTIFIER)}`
    );
    const payload = (await response.json()) as {
      results?: Array<{ trackId?: number; trackViewUrl?: string }>;
    };
    const result = payload.results?.[0];

    if (result?.trackId && (await openUrl(`itms-apps://itunes.apple.com/app/id${result.trackId}`))) {
      return true;
    }

    if (result?.trackViewUrl) {
      return openUrl(result.trackViewUrl);
    }
  }

  return false;
};
