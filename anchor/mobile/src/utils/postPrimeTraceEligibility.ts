import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsStore } from '@/stores/settingsStore';

export const POST_PRIME_TRACE_STORAGE_KEY = 'anchor:post_prime_trace:last_attempt_started_at';
const POST_PRIME_TRACE_WINDOW_MS = 24 * 60 * 60 * 1000;

const parseStoredDate = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

export async function isPostPrimeTraceEligible(now: Date = new Date()): Promise<boolean> {
  const isDevMode =
    (__DEV__ && process.env.NODE_ENV !== 'test') ||
    useSettingsStore.getState().developerModeEnabled;
  if (isDevMode) {
    return true;
  }

  const lastAttemptStartedAt = await AsyncStorage.getItem(POST_PRIME_TRACE_STORAGE_KEY);
  const lastAttemptTimestamp = parseStoredDate(lastAttemptStartedAt);

  if (lastAttemptTimestamp == null) {
    return true;
  }

  return now.getTime() - lastAttemptTimestamp >= POST_PRIME_TRACE_WINDOW_MS;
}

export async function markPostPrimeTraceAttemptStarted(
  startedAt: Date = new Date()
): Promise<void> {
  await AsyncStorage.setItem(POST_PRIME_TRACE_STORAGE_KEY, startedAt.toISOString());
}
