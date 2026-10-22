import { canStartV2Trial, resolveV2TrialState, v2TrialDaysRemaining } from '../trialState';
import { V2_TRIAL_DURATION_MS } from '@/constants/v2/paywall';

const NOW = new Date('2026-09-08T12:00:00.000Z');

describe('resolveV2TrialState', () => {
  it('resolves a null trialStartedAt to TRIAL_NOT_STARTED', () => {
    expect(resolveV2TrialState(null, NOW)).toBe('TRIAL_NOT_STARTED');
    expect(resolveV2TrialState(undefined, NOW)).toBe('TRIAL_NOT_STARTED');
    expect(resolveV2TrialState('', NOW)).toBe('TRIAL_NOT_STARTED');
  });

  it('resolves a timestamp inside the 7-day window to TRIAL_ACTIVE', () => {
    const startedAt = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(resolveV2TrialState(startedAt, NOW)).toBe('TRIAL_ACTIVE');
  });

  it('resolves a timestamp past the window to TRIAL_ENDED', () => {
    const startedAt = new Date(NOW.getTime() - V2_TRIAL_DURATION_MS - 1);
    expect(resolveV2TrialState(startedAt, NOW)).toBe('TRIAL_ENDED');
  });

  it('matches the backend classification at the exact boundary', () => {
    const startedAt = new Date(NOW.getTime() - V2_TRIAL_DURATION_MS);
    expect(resolveV2TrialState(startedAt, NOW)).toBe('TRIAL_ENDED');
  });
});

describe('canStartV2Trial', () => {
  it('is true only before the trial has ever started and with no paid sub', () => {
    expect(canStartV2Trial('TRIAL_NOT_STARTED', false)).toBe(true);
  });

  it('is false once the trial is spent — an expired trial cannot be restarted', () => {
    expect(canStartV2Trial('TRIAL_ENDED', false)).toBe(false);
  });

  it('is false while a trial is already active', () => {
    expect(canStartV2Trial('TRIAL_ACTIVE', false)).toBe(false);
  });

  it('is false for an active subscriber (bypasses the trial-start CTA)', () => {
    expect(canStartV2Trial('TRIAL_NOT_STARTED', true)).toBe(false);
  });
});

describe('v2TrialDaysRemaining', () => {
  it('is 0 when not started or already ended', () => {
    expect(v2TrialDaysRemaining(null, NOW)).toBe(0);
    expect(v2TrialDaysRemaining(new Date(NOW.getTime() - V2_TRIAL_DURATION_MS - 1), NOW)).toBe(0);
  });

  it('counts whole days left, capped at 7', () => {
    expect(v2TrialDaysRemaining(new Date(NOW.getTime()), NOW)).toBe(7);
    expect(v2TrialDaysRemaining(new Date(NOW.getTime() - 5.5 * 24 * 60 * 60 * 1000), NOW)).toBe(2);
  });
});
