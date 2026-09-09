/**
 * Client-side view of the server trial lifecycle.
 *
 * The server owns `trialStartedAt`. This module only *reads* a timestamp the
 * server supplied and classifies it exactly the way the backend
 * `TrialLifecycleService.getTrialState` does. It never invents a start time.
 */

import { V2_TRIAL_DURATION_MS, V2_TRIAL_DURATION_DAYS, type V2TrialState } from '@/constants/v2/paywall';

export type { V2TrialState };

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * `null` / missing → `TRIAL_NOT_STARTED`.
 * within the 7-day window → `TRIAL_ACTIVE`.
 * past the window → `TRIAL_ENDED`.
 */
export function resolveV2TrialState(
  trialStartedAt: Date | string | null | undefined,
  now: Date = new Date(),
): V2TrialState {
  const started = toDate(trialStartedAt);
  if (!started) return 'TRIAL_NOT_STARTED';
  return now.getTime() < started.getTime() + V2_TRIAL_DURATION_MS ? 'TRIAL_ACTIVE' : 'TRIAL_ENDED';
}

/** Whole days left in the trial. `0` when not started or already ended. */
export function v2TrialDaysRemaining(
  trialStartedAt: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  const started = toDate(trialStartedAt);
  if (!started) return 0;
  const remainingMs = started.getTime() + V2_TRIAL_DURATION_MS - now.getTime();
  if (remainingMs <= 0) return 0;
  return Math.min(V2_TRIAL_DURATION_DAYS, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

/** The explicit trial CTA is only meaningful before the trial has ever started. */
export function canStartV2Trial(trialState: V2TrialState, isActiveSubscriber: boolean): boolean {
  return !isActiveSubscriber && trialState === 'TRIAL_NOT_STARTED';
}
