import {
  canSendCategory,
  evaluateDailyPrime,
  evaluateThreadStrength,
  evaluateUnfinishedAnchor,
  evaluateWeeklyRecap,
  hasCompletedPrimeToday,
} from '../notificationRules';
import type { NotificationRuleContext, NotificationRuleState } from '../notificationRules';
import type { Anchor } from '@/types';

const baseState = (overrides: Partial<NotificationRuleState> = {}): NotificationRuleState => ({
  notification_enabled: true,
  notificationPermissionStatus: 'granted',
  dailyPrimeEnabled: true,
  dailyPrimeTime: '21:00',
  threadStrengthAlertsEnabled: true,
  threadStrengthThreshold: 70,
  unfinishedAnchorRemindersEnabled: true,
  weeklyRecapEnabled: true,
  lastNotificationSentAt: {},
  unfinishedAnchorReminders: {},
  ...overrides,
});

const anchor = (overrides: Partial<Anchor> = {}): Anchor => ({
  id: 'anchor-1',
  userId: 'user-1',
  intentionText: 'Build calm focus',
  category: 'desire',
  distilledLetters: ['B', 'C', 'F'],
  baseSigilSvg: '<svg />',
  structureVariant: 'balanced',
  isCharged: false,
  activationCount: 0,
  createdAt: new Date('2026-06-23T10:00:00.000Z'),
  updatedAt: new Date('2026-06-23T10:00:00.000Z'),
  ...overrides,
});

const context = (overrides: Partial<NotificationRuleContext> = {}): NotificationRuleContext => ({
  now: new Date('2026-06-24T15:00:00.000Z'),
  sessionLog: [],
  totalSessionsCount: 0,
  threadStrength: 50,
  anchors: [],
  ...overrides,
});

describe('notification rules', () => {
  it('counts activate and reinforce as completed practice today', () => {
    expect(
      hasCompletedPrimeToday(
        [
          {
            id: 'session-1',
            anchorId: 'anchor-1',
            type: 'activate',
            durationSeconds: 30,
            mode: 'silent',
            completedAt: '2026-06-24T10:00:00.000Z',
          },
        ],
        new Date('2026-06-24T15:00:00.000Z')
      )
    ).toBe(true);
  });

  it('does not let stabilize block daily prime reminders', () => {
    const result = evaluateDailyPrime(
      baseState(),
      context({
        sessionLog: [
          {
            id: 'session-1',
            anchorId: 'anchor-1',
            type: 'stabilize',
            durationSeconds: 30,
            mode: 'silent',
            completedAt: '2026-06-24T10:00:00.000Z',
          },
        ],
      })
    );

    expect(result.eligible).toBe(true);
  });

  it('keeps tomorrow queued after practice is completed today', () => {
    const result = evaluateDailyPrime(
      baseState({ dailyPrimeTime: '21:00' }),
      context({
        now: new Date('2026-06-24T15:00:00.000Z'),
        sessionLog: [
          {
            id: 'session-1',
            anchorId: 'anchor-1',
            type: 'activate',
            durationSeconds: 30,
            mode: 'silent',
            completedAt: '2026-06-24T14:00:00.000Z',
          },
        ],
      })
    );

    expect(result.eligible).toBe(true);
    expect(result.fireDate).toEqual(new Date(2026, 5, 25, 21, 0, 0, 0));
  });

  it('fires thread strength below threshold and respects daily practice', () => {
    expect(evaluateThreadStrength(baseState(), context({ threadStrength: 69 })).eligible).toBe(true);
    expect(
      evaluateThreadStrength(
        baseState(),
        context({
          threadStrength: 69,
          sessionLog: [
            {
              id: 'session-1',
              anchorId: 'anchor-1',
              type: 'reinforce',
              durationSeconds: 120,
              mode: 'silent',
              completedAt: '2026-06-24T10:00:00.000Z',
            },
          ],
        })
      ).eligible
    ).toBe(false);
  });

  it('sends unfinished anchor reminders once after the delay', () => {
    const result = evaluateUnfinishedAnchor(
      baseState({
        unfinishedAnchorReminders: {
          'anchor-1': { startedAt: '2026-06-23T10:00:00.000Z' },
        },
      }),
      context({ anchors: [anchor()] })
    );

    expect(result.eligible).toBe(true);
    expect(
      evaluateUnfinishedAnchor(
        baseState({
          unfinishedAnchorReminders: {
            'anchor-1': {
              startedAt: '2026-06-23T10:00:00.000Z',
              sentAt: '2026-06-24T12:00:00.000Z',
            },
          },
        }),
        context({ anchors: [anchor()] })
      ).eligible
    ).toBe(false);
  });

  it('detects weekly recap', () => {
    expect(
      evaluateWeeklyRecap(
        baseState(),
        context({
          sessionLog: [
            {
              id: 'session-1',
              anchorId: 'anchor-1',
              type: 'activate',
              durationSeconds: 30,
              mode: 'silent',
              completedAt: '2026-06-24T10:00:00.000Z',
            },
          ],
          anchors: [anchor({ isCharged: true, activationCount: 3 })],
        })
      ).eligible
    ).toBe(true);
  });

  it('enforces global spam limits', () => {
    const now = new Date('2026-06-24T15:00:00.000Z');

    expect(
      canSendCategory(
        baseState({
          lastNotificationSentAt: {
            daily_prime: '2026-06-24T10:00:00.000Z',
          },
        }),
        'thread_strength',
        now
      )
    ).toBe(false);

    expect(
      canSendCategory(
        baseState({
          lastNotificationSentAt: {
            daily_prime: '2026-06-24T09:00:00.000Z',
            weekly_recap: '2026-06-24T10:00:00.000Z',
            thread_strength: '2026-06-24T11:00:00.000Z',
          },
        }),
        'unfinished_anchor',
        now
      )
    ).toBe(false);

    expect(
      canSendCategory(
        baseState({
          lastNotificationSentAt: {
            weekly_recap: '2026-06-24T14:30:00.000Z',
          },
        }),
        'daily_prime',
        now
      )
    ).toBe(false);
  });
});

describe('send limits are evaluated at delivery time', () => {
  // Regression: these limits used to be judged against "now" while scheduling a
  // reminder hours away, so a recent delivery made the standing daily prime
  // ineligible — and the scheduler cancels ineligible categories, silently
  // unscheduling the recurring reminder.
  const now = new Date('2026-06-24T15:00:00.000Z');
  // Anchor the prime well clear of `now` in LOCAL terms so the assertions do
  // not depend on the machine timezone.
  const dailyPrimeTime = `${String((now.getHours() + 5) % 24).padStart(2, '0')}:00`;
  const sentTenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  it('keeps the daily prime scheduled after a recent delivery', () => {
    const result = evaluateDailyPrime(
      baseState({
        dailyPrimeTime,
        lastNotificationSentAt: { thread_strength: sentTenMinutesAgo },
      }),
      context({ now })
    );

    expect(result.eligible).toBe(true);
    expect(result.fireDate).toBeInstanceOf(Date);
    expect(result.fireDate!.getTime()).toBeGreaterThan(now.getTime());
  });

  it('allows a distant fire time but blocks an imminent one', () => {
    const state = baseState({
      lastNotificationSentAt: { weekly_recap: now.toISOString() },
    });

    expect(
      canSendCategory(state, 'daily_prime', new Date(now.getTime() + 6 * 60 * 60 * 1000))
    ).toBe(true);
    expect(
      canSendCategory(state, 'daily_prime', new Date(now.getTime() + 10 * 60 * 1000))
    ).toBe(false);
  });

  it('still rate-limits situational nudges, which fire minutes away', () => {
    const result = evaluateThreadStrength(
      baseState({ lastNotificationSentAt: { weekly_recap: sentTenMinutesAgo } }),
      context({ now, threadStrength: 10 })
    );

    expect(result.eligible).toBe(false);
  });

  it.each([
    ['notifications disabled', { notification_enabled: false }],
    ['permission denied', { notificationPermissionStatus: 'denied' as const }],
    ['daily prime turned off', { dailyPrimeEnabled: false }],
  ])('still reports the daily prime ineligible when %s', (_label, overrides) => {
    const result = evaluateDailyPrime(
      baseState({ dailyPrimeTime, ...overrides }),
      context({ now })
    );

    expect(result.eligible).toBe(false);
    expect(result.fireDate).toBeUndefined();
  });
});
