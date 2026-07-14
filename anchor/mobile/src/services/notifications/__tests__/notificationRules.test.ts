import {
  canSendCategory,
  detectMilestone,
  evaluateDailyPrime,
  evaluateMilestone,
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
  milestoneNotificationsEnabled: true,
  lastNotificationSentAt: {},
  sentMilestones: [],
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

  it('detects weekly recap and milestones', () => {
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
    expect(detectMilestone(3, 50, [])).toBe('sessions_3');
    expect(detectMilestone(7, 50, ['sessions_3'])).toBe('sessions_7');
    expect(detectMilestone(30, 50, ['sessions_3', 'sessions_7'])).toBe('sessions_30');
    expect(detectMilestone(30, 100, ['sessions_3', 'sessions_7', 'sessions_30'])).toBe('thread_strength_100');
    expect(evaluateMilestone(baseState(), context({ totalSessionsCount: 3 })).eligible).toBe(true);
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
            milestone: '2026-06-24T11:00:00.000Z',
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
        'milestone',
        now
      )
    ).toBe(false);
  });
});
