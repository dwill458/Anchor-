import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeNotificationState, NOTIFICATION_STATE_STORAGE_KEY } from '@/services/NotificationState';
import { loadNotificationStateSnapshot, shouldShowReminderInvitation } from '../invitationEligibility';

const fresh = () => initializeNotificationState();
const eligible = {
  isAuthenticated: true,
  hasCompletedOnboarding: true,
  sessionSaved: true,
};

describe('shouldShowReminderInvitation', () => {
  it('shows after the first completed, saved practice of an onboarded account with no reminder', () => {
    expect(shouldShowReminderInvitation({ state: fresh(), ...eligible })).toBe(true);
  });

  it('does not show on a second practice (first practice already recorded)', () => {
    const state = { ...fresh(), firstPracticeCompletedAt: '2026-10-01T10:00:00.000Z' };
    expect(shouldShowReminderInvitation({ state, ...eligible })).toBe(false);
  });

  it('does not show to a guest', () => {
    expect(shouldShowReminderInvitation({ state: fresh(), ...eligible, isAuthenticated: false })).toBe(false);
  });

  it('does not show mid-onboarding', () => {
    expect(shouldShowReminderInvitation({ state: fresh(), ...eligible, hasCompletedOnboarding: false })).toBe(false);
  });

  it('does not show when the daily reminder is already opted in', () => {
    const state = { ...fresh(), personalDailyReminderOptedIn: true };
    expect(shouldShowReminderInvitation({ state, ...eligible })).toBe(false);
  });

  it('does not show once the invitation was dismissed (or accepted) before', () => {
    expect(shouldShowReminderInvitation({ state: { ...fresh(), reminderInvitationOutcome: 'dismissed' }, ...eligible })).toBe(false);
    expect(shouldShowReminderInvitation({ state: { ...fresh(), reminderInvitationOutcome: 'accepted' }, ...eligible })).toBe(false);
  });

  it('does not show for an unsaved session', () => {
    expect(shouldShowReminderInvitation({ state: fresh(), ...eligible, sessionSaved: false })).toBe(false);
  });

  it('does not show when the notification state is unknown', () => {
    expect(shouldShowReminderInvitation({ state: null, ...eligible })).toBe(false);
  });
});

describe('loadNotificationStateSnapshot', () => {
  it('reads and normalizes the stored state', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ ...fresh(), firstPracticeCompletedAt: '2026-10-01T10:00:00.000Z' }),
    );
    const snapshot = await loadNotificationStateSnapshot();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(NOTIFICATION_STATE_STORAGE_KEY);
    expect(snapshot?.firstPracticeCompletedAt).toBe('2026-10-01T10:00:00.000Z');
  });

  it('resolves null (never rejects) when storage fails', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));
    await expect(loadNotificationStateSnapshot()).resolves.toBeNull();
  });
});
