import { getTrialState, TRIAL_DURATION_MS } from '../TrialLifecycleService';

describe('TrialLifecycleService', () => {
  const now = new Date('2026-09-07T12:00:00.000Z');

  it('distinguishes not-started from expired', () => {
    expect(getTrialState(null, now)).toBe('NOT_STARTED');
    expect(getTrialState(new Date(now.getTime() - TRIAL_DURATION_MS), now)).toBe('EXPIRED');
  });

  it('keeps an active explicit trial active', () => {
    expect(getTrialState(new Date(now.getTime() - 60_000), now)).toBe('ACTIVE');
  });
});
