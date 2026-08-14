import type {
  LastNotificationSentAt,
  NotificationPermissionStatus,
  NotificationTone,
  UnfinishedAnchorReminderMap,
} from '@/services/notifications/notificationTypes';

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export const DEFAULT_NOTIFICATION_GOAL_PRIMES = 3;
export const NOTIFICATION_STATE_STORAGE_KEY = '@anchor_notification_state';

export interface NotificationState {
  primed_today: boolean;
  last_prime_at: string | null;
  missed_yesterday: boolean;
  miss_streak: number;
  app_opened_in_last_5_days: boolean;
  last_app_open_at: string;
  total_primes_this_week: number;
  week_started_at: string;
  current_primes: number;
  goal_primes: number;
  has_reached_goal_today: boolean;
  has_entered_burn_flow: boolean;
  sigil_in_vault: boolean;
  active_hours_start: number;
  active_hours_end: number;
  timezone: string;
  notification_enabled: boolean;
  active_session: boolean;
  weaver_enabled: boolean;
  threadStrength: number;
  dailyPrimeEnabled: boolean;
  dailyPrimeTime: string;
  threadStrengthAlertsEnabled: boolean;
  threadStrengthThreshold: number;
  unfinishedAnchorRemindersEnabled: boolean;
  weeklyRecapEnabled: boolean;
  notificationTone: NotificationTone;
  lastNotificationSentAt: LastNotificationSentAt;
  lastTemplateIdByCategory: Partial<Record<string, string>>;
  notificationPermissionStatus: NotificationPermissionStatus;
  unfinishedAnchorReminders: UnfinishedAnchorReminderMap;
  softAskShownAt: string | null;
  softAskDismissedAt: string | null;
  // Daily Prime reminder prompt (post first-anchor / fallback moment)
  notificationPromptShownAt: string | null;
  firstAnchorReminderPromptCompleted: boolean;
  fallbackReminderPromptCompleted: boolean;
}

export const getMonday12AMLocal = (): string => {
  const now = new Date();
  const monday = new Date(now);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
};

export const initializeNotificationState = (): NotificationState => ({
  primed_today: false,
  last_prime_at: null,
  missed_yesterday: false,
  miss_streak: 0,
  app_opened_in_last_5_days: true,
  last_app_open_at: new Date().toISOString(),
  total_primes_this_week: 0,
  week_started_at: getMonday12AMLocal(),
  current_primes: 0,
  goal_primes: DEFAULT_NOTIFICATION_GOAL_PRIMES,
  has_reached_goal_today: false,
  has_entered_burn_flow: false,
  sigil_in_vault: false,
  active_hours_start: 8,
  active_hours_end: 21,
  timezone: DEFAULT_TIMEZONE,
  notification_enabled: true,
  active_session: false,
  weaver_enabled: true,
  threadStrength: 50,
  dailyPrimeEnabled: true,
  dailyPrimeTime: '21:00',
  threadStrengthAlertsEnabled: true,
  threadStrengthThreshold: 70,
  unfinishedAnchorRemindersEnabled: true,
  weeklyRecapEnabled: false,
  notificationTone: 'encouraging',
  lastNotificationSentAt: {},
  lastTemplateIdByCategory: {},
  notificationPermissionStatus: 'undetermined',
  unfinishedAnchorReminders: {},
  softAskShownAt: null,
  softAskDismissedAt: null,
  notificationPromptShownAt: null,
  firstAnchorReminderPromptCompleted: false,
  fallbackReminderPromptCompleted: false,
});

export const normalizeNotificationState = (
  raw: Partial<NotificationState> | null | undefined
): NotificationState => {
  const defaults = initializeNotificationState();
  const state = { ...defaults, ...(raw ?? {}) };

  state.dailyPrimeTime =
    typeof state.dailyPrimeTime === 'string' && /^([0-1]?\d|2[0-3]):([0-5]\d)$/.test(state.dailyPrimeTime)
      ? state.dailyPrimeTime
      : `${String(state.active_hours_end ?? 21).padStart(2, '0')}:00`;
  state.threadStrengthThreshold =
    typeof state.threadStrengthThreshold === 'number' && Number.isFinite(state.threadStrengthThreshold)
      ? Math.min(100, Math.max(0, Math.round(state.threadStrengthThreshold)))
      : 70;
  state.notificationTone =
    state.notificationTone === 'direct' ||
    state.notificationTone === 'reflective' ||
    state.notificationTone === 'performance'
      ? state.notificationTone
      : 'encouraging';
  state.notificationPermissionStatus =
    state.notificationPermissionStatus === 'granted' ||
    state.notificationPermissionStatus === 'denied'
      ? state.notificationPermissionStatus
      : 'undetermined';
  state.lastNotificationSentAt =
    state.lastNotificationSentAt && typeof state.lastNotificationSentAt === 'object'
      ? state.lastNotificationSentAt
      : {};
  state.lastTemplateIdByCategory =
    state.lastTemplateIdByCategory && typeof state.lastTemplateIdByCategory === 'object'
      ? state.lastTemplateIdByCategory
      : {};
  state.unfinishedAnchorReminders =
    state.unfinishedAnchorReminders && typeof state.unfinishedAnchorReminders === 'object'
      ? state.unfinishedAnchorReminders
      : {};

  return state;
};

export const isSameDay = (d1: Date | null, d2: Date | null): boolean => {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export const isSameWeek = (now: Date, weekStarted: string): boolean => {
  const weekStart = new Date(weekStarted).getTime();
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
  return now.getTime() >= weekStart && now.getTime() < weekEnd;
};

export const daysBetween = (date1: string | null, date2: Date): number => {
  if (!date1) return 999;
  return Math.floor(
    (date2.getTime() - new Date(date1).getTime()) / (1000 * 60 * 60 * 24)
  );
};

export const calculateMinutesSinceWakeTime = (wakeHour: number): number => {
  const now = new Date();
  const wakeTime = new Date(now);
  wakeTime.setHours(wakeHour, 0, 0, 0);
  if (now < wakeTime) return 0;
  return Math.floor((now.getTime() - wakeTime.getTime()) / (1000 * 60));
};
