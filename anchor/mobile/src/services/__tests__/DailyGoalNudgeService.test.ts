import NotificationService from '../NotificationService';
import {
  countDailyGoalCompletions,
  getDailyGoalCheckpoints,
  syncDailyGoalNudges,
} from '../DailyGoalNudgeService';

describe('DailyGoalNudgeService', () => {
  beforeEach(async () => {
    NotificationService.setMockEnabled(true);
    await NotificationService.cancelAllNotifications();
  });

  afterEach(() => {
    NotificationService.setMockEnabled(false);
  });

  it('counts activate and reinforce sessions for the current local day only', () => {
    const now = new Date(2026, 3, 12, 10, 0, 0);

    const count = countDailyGoalCompletions(
      [
        {
          id: 'activate-today',
          anchorId: 'anchor-1',
          type: 'activate',
          durationSeconds: 30,
          mode: 'silent',
          completedAt: new Date(2026, 3, 12, 8, 0, 0).toISOString(),
        },
        {
          id: 'reinforce-today',
          anchorId: 'anchor-1',
          type: 'reinforce',
          durationSeconds: 300,
          mode: 'silent',
          completedAt: new Date(2026, 3, 12, 9, 0, 0).toISOString(),
        },
        {
          id: 'stabilize-today',
          anchorId: 'anchor-1',
          type: 'stabilize',
          durationSeconds: 60,
          mode: 'silent',
          completedAt: new Date(2026, 3, 12, 9, 30, 0).toISOString(),
        },
        {
          id: 'activate-yesterday',
          anchorId: 'anchor-1',
          type: 'activate',
          durationSeconds: 30,
          mode: 'silent',
          completedAt: new Date(2026, 3, 11, 23, 30, 0).toISOString(),
        },
      ],
      now
    );

    expect(count).toBe(2);
  });

  it('schedules remaining checkpoints for a goal of 3', async () => {
    await syncDailyGoalNudges({
      goal: 3,
      completedCount: 0,
      enabled: true,
      reminderTime: '09:00',
      now: new Date(2026, 3, 12, 8, 0, 0),
    });

    const scheduled = await NotificationService.getScheduledNotifications();
    expect(scheduled.map((item) => item.identifier).sort()).toEqual([
      'daily-goal-checkpoint:2',
      'daily-goal-checkpoint:3',
    ]);
  });

  it('removes earlier checkpoints after progress catches up', async () => {
    await syncDailyGoalNudges({
      goal: 3,
      completedCount: 2,
      enabled: true,
      reminderTime: '09:00',
      now: new Date(2026, 3, 12, 14, 0, 0),
    });

    const scheduled = await NotificationService.getScheduledNotifications();
    expect(scheduled.map((item) => item.identifier)).toEqual(['daily-goal-checkpoint:3']);
  });

  it('cancels all checkpoints once the goal is complete', async () => {
    await syncDailyGoalNudges({
      goal: 3,
      completedCount: 3,
      enabled: true,
      reminderTime: '09:00',
      now: new Date(2026, 3, 12, 14, 0, 0),
    });

    const scheduled = await NotificationService.getScheduledNotifications();
    expect(scheduled).toHaveLength(0);
  });

  it('cancels all checkpoints when reminders are disabled', async () => {
    await syncDailyGoalNudges({
      goal: 3,
      completedCount: 0,
      enabled: false,
      reminderTime: '09:00',
      now: new Date(2026, 3, 12, 8, 0, 0),
    });

    const scheduled = await NotificationService.getScheduledNotifications();
    expect(scheduled).toHaveLength(0);
  });

  it('skips checkpoints that are already in the past later in the day', () => {
    const checkpoints = getDailyGoalCheckpoints({
      goal: 3,
      completedCount: 0,
      reminderTime: '09:00',
      now: new Date(2026, 3, 12, 16, 30, 0),
    });

    expect(checkpoints.map((checkpoint) => checkpoint.milestone)).toEqual([3]);
  });
});
