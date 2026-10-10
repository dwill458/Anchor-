import {
  calculateMinutesSinceWakeTime,
  getMonday12AMLocal,
  initializeNotificationState,
  momentumPatch,
  normalizeNotificationState,
  selectMomentumOn,
} from '../NotificationState';

describe('NotificationState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes notification state with expected defaults', () => {
    jest.setSystemTime(new Date('2026-04-23T14:30:00.000Z'));

    const state = initializeNotificationState();

    expect(state).toMatchObject({
      primed_today: false,
      missed_yesterday: false,
      miss_streak: 0,
      total_primes_this_week: 0,
      current_primes: 0,
      goal_primes: 3,
      active_hours_start: 8,
      active_hours_end: 21,
      notification_enabled: true,
      personalDailyReminderOptedIn: false,
      active_session: false,
      threadStrength: 50,
      dailyPrimeEnabled: false,
      dailyPrimeTime: '21:00',
      threadStrengthAlertsEnabled: false,
      threadStrengthThreshold: 70,
      unfinishedAnchorRemindersEnabled: false,
      weeklyRecapEnabled: false,
      notificationTone: 'encouraging',
      notificationPermissionStatus: 'undetermined',
    });
    expect(typeof state.timezone).toBe('string');
    expect(new Date(state.last_app_open_at).toISOString()).toBe('2026-04-23T14:30:00.000Z');
  });

  it('preserves clearly established explicit opt-in and opt-out preferences', () => {
    // Explicit affirmative opt-in preserved
    const stateA = normalizeNotificationState({
      personalDailyReminderOptedIn: true,
      dailyPrimeEnabled: true,
      dailyPrimeTime: '20:30',
    });
    expect(stateA.personalDailyReminderOptedIn).toBe(true);
    expect(stateA.dailyPrimeEnabled).toBe(true);

    // Explicit opt-out preserved
    const stateB = normalizeNotificationState({
      personalDailyReminderOptedIn: false,
      dailyPrimeEnabled: false,
    });
    expect(stateB.personalDailyReminderOptedIn).toBe(false);
    expect(stateB.dailyPrimeEnabled).toBe(false);

    // Explicit false opt-in overrides legacy dailyPrimeEnabled true
    const stateC = normalizeNotificationState({
      personalDailyReminderOptedIn: false,
      dailyPrimeEnabled: true,
      notification_enabled: true,
    });
    expect(stateC.personalDailyReminderOptedIn).toBe(false);
  });

  it('rejects prompt display, dismissal, and ambiguous legacy defaults as explicit opt-in', () => {
    // Clean install (null / empty raw) starts with reminders OFF
    const cleanInstall = normalizeNotificationState(null);
    expect(cleanInstall.personalDailyReminderOptedIn).toBe(false);
    expect(cleanInstall.dailyPrimeEnabled).toBe(false);

    // Prompt shown timestamp (notificationPromptShownAt) does NOT constitute consent
    const promptShown = normalizeNotificationState({
      notification_enabled: true,
      dailyPrimeEnabled: true,
      notificationPromptShownAt: '2026-03-01T10:00:00.000Z',
    });
    expect(promptShown.personalDailyReminderOptedIn).toBe(false);
    expect(promptShown.dailyPrimeEnabled).toBe(false);

    // Prompt dismissal / skip (firstAnchorReminderPromptCompleted) does NOT constitute consent
    const promptDismissed = normalizeNotificationState({
      notification_enabled: true,
      dailyPrimeEnabled: true,
      firstAnchorReminderPromptCompleted: true,
    });
    expect(promptDismissed.personalDailyReminderOptedIn).toBe(false);
    expect(promptDismissed.dailyPrimeEnabled).toBe(false);

    // Fallback prompt dismissal (fallbackReminderPromptCompleted) does NOT constitute consent
    const fallbackDismissed = normalizeNotificationState({
      notification_enabled: true,
      dailyPrimeEnabled: true,
      fallbackReminderPromptCompleted: true,
    });
    expect(fallbackDismissed.personalDailyReminderOptedIn).toBe(false);
    expect(fallbackDismissed.dailyPrimeEnabled).toBe(false);

    // Older Android device (notification permission granted by OS on install, but ambiguous user choice)
    const olderAndroidLegacy = normalizeNotificationState({
      notification_enabled: true,
      dailyPrimeEnabled: true,
      notificationPermissionStatus: 'granted',
    });
    expect(olderAndroidLegacy.personalDailyReminderOptedIn).toBe(false);
    expect(olderAndroidLegacy.dailyPrimeEnabled).toBe(false);
  });

  it('defaults the Pass 2 fields without implying consent', () => {
    const state = normalizeNotificationState({});
    expect(state).toMatchObject({
      firstPracticeCompletedAt: null,
      reminderInvitationShownAt: null,
      reminderInvitationOutcome: null,
      visionRemindersEnabled: false,
      chartRemindersEnabled: false,
      momentumCheckinsEnabled: false,
      threadStrengthAlertsEnabled: false,
      unfinishedAnchorRemindersEnabled: false,
      personalDailyReminderOptedIn: false,
    });
  });

  it('preserves persisted legacy alert preferences instead of applying the new defaults', () => {
    const state = normalizeNotificationState({
      personalDailyReminderOptedIn: true,
      dailyPrimeEnabled: true,
      threadStrengthAlertsEnabled: true,
      unfinishedAnchorRemindersEnabled: true,
    });
    expect(state.threadStrengthAlertsEnabled).toBe(true);
    expect(state.unfinishedAnchorRemindersEnabled).toBe(true);
  });

  it('never opts in because the invitation was shown or dismissed', () => {
    const state = normalizeNotificationState({
      reminderInvitationShownAt: '2026-10-09T10:00:00.000Z',
      reminderInvitationOutcome: 'dismissed',
    });
    expect(state.personalDailyReminderOptedIn).toBe(false);
    expect(state.dailyPrimeEnabled).toBe(false);
  });

  it('treats Momentum as on when any of its three flags is on, and patches all together', () => {
    const base = initializeNotificationState();
    expect(selectMomentumOn(base)).toBe(false);
    expect(selectMomentumOn({ ...base, momentumCheckinsEnabled: true })).toBe(true);
    expect(selectMomentumOn({ ...base, threadStrengthAlertsEnabled: true })).toBe(true);
    expect(selectMomentumOn({ ...base, unfinishedAnchorRemindersEnabled: true })).toBe(true);

    expect(momentumPatch(true)).toEqual({
      momentumCheckinsEnabled: true,
      threadStrengthAlertsEnabled: true,
      unfinishedAnchorRemindersEnabled: true,
    });
    const allOn = {
      ...base,
      momentumCheckinsEnabled: true,
      threadStrengthAlertsEnabled: true,
      unfinishedAnchorRemindersEnabled: true,
    };
    expect(selectMomentumOn({ ...allOn, ...momentumPatch(false) })).toBe(false);
  });

  it('returns the current local monday at midnight', () => {
    jest.setSystemTime(new Date('2026-04-23T14:30:00.000Z'));

    const monday = new Date(getMonday12AMLocal());

    expect(monday.getDay()).toBe(1);
    expect(monday.getHours()).toBe(0);
    expect(monday.getMinutes()).toBe(0);
    expect(monday.getSeconds()).toBe(0);
    expect(monday.getMilliseconds()).toBe(0);
  });

  it('computes minutes since wake time and floors before wake to zero', () => {
    // Use a local timestamp so the expectation is stable across machine timezones.
    jest.setSystemTime(new Date('2026-04-23T10:45:00.000'));
    expect(calculateMinutesSinceWakeTime(8)).toBe(165);
    expect(calculateMinutesSinceWakeTime(16)).toBe(0);
  });
});
