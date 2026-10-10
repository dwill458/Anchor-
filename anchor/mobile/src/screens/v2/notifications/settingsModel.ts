import type { NotificationState } from '@/services/NotificationState';
import { selectMomentumOn } from '@/services/NotificationState';
import { formatDisplay } from '@/utils/reminderTime';

export type SettingsModelInput = Pick<
  NotificationState,
  | 'notification_enabled'
  | 'notificationPermissionStatus'
  | 'dailyPrimeEnabled'
  | 'personalDailyReminderOptedIn'
  | 'dailyPrimeTime'
  | 'momentumCheckinsEnabled'
  | 'threadStrengthAlertsEnabled'
  | 'unfinishedAnchorRemindersEnabled'
>;

export interface SettingsModel {
  dailyOn: boolean;
  timeLabel: string;
  osDenied: boolean;
  momentumOn: boolean;
  showVisionChart: boolean;
}

/**
 * Vision / Chart reminder toggles store a preference only until Checkpoint Two
 * (D2), so production builds hide them unless the flag is set. Evaluated at call
 * time so tests can flip it.
 */
export const shouldShowVisionChart = (): boolean => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
  const flag = process.env.EXPO_PUBLIC_ENABLE_SMART_REMINDER_TOGGLES;
  if (!flag) return false;
  const normalized = String(flag).trim().toLowerCase();
  return normalized !== '' && normalized !== 'false' && normalized !== '0';
};

/**
 * Everything the Notifications screen renders from. `dailyOn` requires the
 * persisted prefs, OS permission AND a matching native schedule, so the toggle
 * can never claim a reminder that will not fire.
 */
export const deriveSettingsModel = (
  state: SettingsModelInput | null | undefined,
  nativeScheduled: boolean
): SettingsModel => {
  const dailyOn = Boolean(
    state &&
      state.notification_enabled &&
      state.notificationPermissionStatus === 'granted' &&
      state.dailyPrimeEnabled &&
      state.personalDailyReminderOptedIn &&
      nativeScheduled
  );
  return {
    dailyOn,
    timeLabel: dailyOn && state ? formatDisplay(state.dailyPrimeTime, false) : 'Off',
    osDenied: state?.notificationPermissionStatus === 'denied',
    momentumOn: state ? selectMomentumOn(state) : false,
    showVisionChart: shouldShowVisionChart(),
  };
};
