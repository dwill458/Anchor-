const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

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
  total_primes_all_time: number;
  alchemist_milestones_count: number;
  sovereign_rank: boolean;
  active_session: boolean;
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
  goal_primes: 22,
  has_reached_goal_today: false,
  has_entered_burn_flow: false,
  sigil_in_vault: false,
  active_hours_start: 8,
  active_hours_end: 21,
  timezone: DEFAULT_TIMEZONE,
  notification_enabled: true,
  total_primes_all_time: 0,
  alchemist_milestones_count: 0,
  sovereign_rank: false,
  active_session: false,
});

export const isSameDay = (d1: Date, d2: Date): boolean =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

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
