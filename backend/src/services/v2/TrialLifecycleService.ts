export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type TrialState = 'NOT_STARTED' | 'ACTIVE' | 'EXPIRED';

/** The server is the only authority for the trial start timestamp. */
export function getTrialState(trialStartedAt: Date | null | undefined, now = new Date()): TrialState {
  if (!trialStartedAt) return 'NOT_STARTED';
  return now.getTime() < trialStartedAt.getTime() + TRIAL_DURATION_MS ? 'ACTIVE' : 'EXPIRED';
}
