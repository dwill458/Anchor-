import NotificationService from '@/services/NotificationService';
import { useSessionStore, type SessionLogEntry } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';

const DAILY_GOAL_CUTOFF_HOUR = 21;
const COUNTED_SESSION_TYPES = new Set<SessionLogEntry['type']>(['activate', 'reinforce']);

export interface DailyGoalProgress {
  completedCount: number;
  goal: number;
  remainingCount: number;
  isGoalComplete: boolean;
}

export interface DailyGoalNudgeSyncOptions {
  goal: number;
  completedCount: number;
  enabled: boolean;
  reminderTime: string;
  now?: Date;
}

interface TimeParts {
  hour: number;
  minute: number;
}

interface DailyGoalCheckpoint {
  milestone: number;
  triggerAt: Date;
}

const clampGoal = (goal: number): number => Math.max(1, Math.min(20, Math.round(goal)));

const parseTime = (time: string): TimeParts | null => {
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
};

export const localDateString = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

export const countDailyGoalCompletions = (
  sessionLog: SessionLogEntry[],
  now: Date = new Date()
): number => {
  const today = localDateString(now);

  return sessionLog.reduce((count, entry) => {
    if (!COUNTED_SESSION_TYPES.has(entry.type)) {
      return count;
    }

    const completedAt = new Date(entry.completedAt);
    if (Number.isNaN(completedAt.getTime())) {
      return count;
    }

    return localDateString(completedAt) === today ? count + 1 : count;
  }, 0);
};

export const getDailyGoalProgress = (
  goal: number,
  sessionLog: SessionLogEntry[],
  now: Date = new Date()
): DailyGoalProgress => {
  const normalizedGoal = clampGoal(goal);
  const completedCount = countDailyGoalCompletions(sessionLog, now);
  const remainingCount = Math.max(normalizedGoal - completedCount, 0);

  return {
    completedCount,
    goal: normalizedGoal,
    remainingCount,
    isGoalComplete: remainingCount === 0,
  };
};

export const getDailyGoalCheckpoints = ({
  goal,
  completedCount,
  reminderTime,
  now = new Date(),
}: Omit<DailyGoalNudgeSyncOptions, 'enabled'>): DailyGoalCheckpoint[] => {
  const normalizedGoal = clampGoal(goal);
  if (normalizedGoal <= 1) {
    return [];
  }

  const parsedTime = parseTime(reminderTime);
  if (!parsedTime) {
    return [];
  }

  const start = new Date(now);
  start.setHours(parsedTime.hour, parsedTime.minute, 0, 0);

  const cutoff = new Date(now);
  cutoff.setHours(DAILY_GOAL_CUTOFF_HOUR, 0, 0, 0);

  if (start.getTime() >= cutoff.getTime()) {
    return [];
  }

  const checkpoints: DailyGoalCheckpoint[] = [];
  const firstMilestone = Math.max(completedCount + 1, 2);

  for (let milestone = firstMilestone; milestone <= normalizedGoal; milestone += 1) {
    const progressRatio = (milestone - 1) / (normalizedGoal - 1);
    const checkpointMs =
      start.getTime() + Math.round((cutoff.getTime() - start.getTime()) * progressRatio);
    const triggerAt = new Date(checkpointMs);

    if (triggerAt.getTime() <= now.getTime()) {
      continue;
    }

    checkpoints.push({ milestone, triggerAt });
  }

  return checkpoints;
};

export const syncDailyGoalNudges = async ({
  goal,
  completedCount,
  enabled,
  reminderTime,
  now = new Date(),
}: DailyGoalNudgeSyncOptions): Promise<DailyGoalCheckpoint[]> => {
  await NotificationService.cancelAllDailyGoalCheckpoints();

  const normalizedGoal = clampGoal(goal);
  if (!enabled || completedCount >= normalizedGoal) {
    return [];
  }

  const checkpoints = getDailyGoalCheckpoints({
    goal: normalizedGoal,
    completedCount,
    reminderTime,
    now,
  });

  await Promise.all(
    checkpoints.map((checkpoint) =>
      NotificationService.scheduleDailyGoalCheckpoint(
        checkpoint.milestone,
        normalizedGoal,
        checkpoint.triggerAt
      )
    )
  );

  return checkpoints;
};

export const syncDailyReminderFromStores = async (): Promise<void> => {
  const settings = useSettingsStore.getState();

  if (!settings.dailyReminderEnabled) {
    await NotificationService.cancelDailyReminder();
    return;
  }

  await NotificationService.scheduleDailyReminder(settings.dailyReminderTime);
};

export const syncDailyGoalNudgesFromStores = async (now: Date = new Date()): Promise<DailyGoalCheckpoint[]> => {
  useSessionStore.getState().resetIfNewDay();

  const settings = useSettingsStore.getState();
  const sessionLog = useSessionStore.getState().sessionLog;
  const completedCount = countDailyGoalCompletions(sessionLog, now);

  return syncDailyGoalNudges({
    goal: settings.dailyPracticeGoal,
    completedCount,
    enabled: settings.dailyReminderEnabled,
    reminderTime: settings.dailyReminderTime,
    now,
  });
};
