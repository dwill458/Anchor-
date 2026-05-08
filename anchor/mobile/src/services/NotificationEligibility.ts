import type { NotificationState } from '@/services/NotificationState';
import { calculateMinutesSinceWakeTime } from '@/services/NotificationState';

export type NotificationType = 'MICRO_PRIME' | 'WEAVER' | 'MIRROR' | 'ALCHEMIST' | null;

export const NotificationEligibility = {
  microPrime: (state: NotificationState): boolean => {
    const activeMinutes = (state.active_hours_end - state.active_hours_start) * 60;
    const eightyPercent = activeMinutes * 0.8;
    const elapsed = calculateMinutesSinceWakeTime(state.active_hours_start);

    return (
      elapsed >= eightyPercent &&
      !state.primed_today &&
      !state.active_session &&
      !state.has_reached_goal_today &&
      state.notification_enabled
    );
  },

  weaver: (state: NotificationState): boolean => {
    const isStruggler =
      state.miss_streak < 3 || state.app_opened_in_last_5_days;

    return (
      state.missed_yesterday &&
      isStruggler &&
      !state.primed_today &&
      state.notification_enabled &&
      state.weaver_enabled !== false
    );
  },

  mirror: (state: NotificationState): boolean => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const isMondayMorning = day === 1 && hour >= 6 && hour < 12;
    const isSundayEvening = day === 0 && hour >= 18;

    return (
      (isMondayMorning || isSundayEvening) &&
      state.total_primes_this_week >= 1 &&
      !state.active_session &&
      state.notification_enabled
    );
  },

  alchemist: (state: NotificationState): boolean => {
    return (
      state.current_primes >= state.goal_primes &&
      !state.has_entered_burn_flow &&
      !state.sigil_in_vault &&
      state.notification_enabled
    );
  },
};
