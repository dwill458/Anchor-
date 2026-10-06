/**
 * The "Day 5 · We'll remind you" promise on the paywall trial timeline.
 *
 * Scheduled locally the moment a store trial starts, so it does not depend on
 * the backend or on push registration. One fixed identifier means a second
 * trial start replaces the reminder rather than stacking a duplicate.
 */

import NotificationService from '@/services/NotificationService';
import { logger } from '@/utils/logger';

export const TRIAL_END_REMINDER_ID = 'anchor-pro-trial-end-reminder';
/** Day 5 of a 7-day trial: two full days before the first charge. */
export const TRIAL_END_REMINDER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export function trialEndReminderFireDate(trialStartedAt: Date): Date {
  return new Date(trialStartedAt.getTime() + TRIAL_END_REMINDER_DAY * DAY_MS);
}

export function trialEndReminderCopy(renewalPriceLabel: string | null): { title: string; body: string } {
  return {
    title: 'Your Anchor Pro trial ends in 2 days',
    body: renewalPriceLabel
      ? `You'll be billed ${renewalPriceLabel} for a year unless you cancel in your store settings before then.`
      : 'Your annual plan begins unless you cancel in your store settings before then.',
  };
}

/**
 * Best effort: asks for notification permission if it has not been decided
 * (the user has just been told a reminder is coming), and never throws into
 * the purchase flow.
 */
export async function scheduleTrialEndReminder(
  renewalPriceLabel: string | null,
  trialStartedAt: Date = new Date(),
): Promise<string | null> {
  try {
    // Prompts only when undecided; an existing grant or denial resolves silently.
    if (!(await NotificationService.requestPermissions())) return null;
    const { title, body } = trialEndReminderCopy(renewalPriceLabel);
    return await NotificationService.scheduleLocalNotification({
      id: TRIAL_END_REMINDER_ID,
      title,
      body,
      fireDate: trialEndReminderFireDate(trialStartedAt),
    });
  } catch (error) {
    logger.warn('[v2/paywall] trial reminder could not be scheduled', error);
    return null;
  }
}
