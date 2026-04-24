import {
  calculateMinutesSinceWakeTime,
  getMonday12AMLocal,
  initializeNotificationState,
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
      goal_primes: 22,
      active_hours_start: 8,
      active_hours_end: 21,
      notification_enabled: true,
      sovereign_rank: false,
      active_session: false,
    });
    expect(typeof state.timezone).toBe('string');
    expect(new Date(state.last_app_open_at).toISOString()).toBe('2026-04-23T14:30:00.000Z');
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
    jest.setSystemTime(new Date('2026-04-23T15:45:00.000Z'));
    expect(calculateMinutesSinceWakeTime(8)).toBe(165);
    expect(calculateMinutesSinceWakeTime(16)).toBe(0);
  });
});
