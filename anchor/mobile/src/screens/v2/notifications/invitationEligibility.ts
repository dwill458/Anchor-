import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeNotificationState,
  normalizeNotificationState,
  NOTIFICATION_STATE_STORAGE_KEY,
  type NotificationState,
} from '@/services/NotificationState';

export type ReminderInvitationEligibilityInput = {
  /** The notification state as it was BEFORE this completion recorded itself. Null when unknown. */
  state: Pick<
    NotificationState,
    'firstPracticeCompletedAt' | 'reminderInvitationOutcome' | 'personalDailyReminderOptedIn'
  > | null;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  sessionSaved: boolean;
};

/**
 * Whether the reminder invitation follows this practice completion: only the first completed,
 * saved practice of an onboarded, signed-in person who has neither opted in to the daily
 * reminder nor already answered the invitation. Anything unknown means no.
 */
export function shouldShowReminderInvitation(input: ReminderInvitationEligibilityInput): boolean {
  const { state } = input;
  if (!state) return false;
  return (
    state.firstPracticeCompletedAt == null &&
    state.reminderInvitationOutcome == null &&
    state.personalDailyReminderOptedIn !== true &&
    input.isAuthenticated === true &&
    input.hasCompletedOnboarding === true &&
    input.sessionSaved === true
  );
}

/**
 * Read-only snapshot of the persisted notification state (the same storage and normalization the
 * notification controller uses). Resolves null on any failure, never rejects; it writes nothing and
 * schedules nothing.
 */
export async function loadNotificationStateSnapshot(): Promise<NotificationState | null> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
    return normalizeNotificationState(stored ? JSON.parse(stored) : initializeNotificationState());
  } catch {
    return null;
  }
}
