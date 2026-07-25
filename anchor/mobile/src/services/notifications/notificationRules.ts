import type { Anchor } from '@/types';
import type { SessionLogEntry } from '@/stores/sessionStore';
import { localDateString } from '@/services/DailyGoalNudgeService';
import type {
  LastNotificationSentAt,
  NotificationCategory,
  NotificationMilestone,
  NotificationPermissionStatus,
  UnfinishedAnchorReminderMap,
} from './notificationTypes';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const PRACTICE_CATEGORIES = new Set<NotificationCategory>(['daily_prime', 'thread_strength']);
const REASONABLE_UNFINISHED_DELAY_MS = DAY_MS;

export interface NotificationRuleState {
  notification_enabled: boolean;
  notificationPermissionStatus: NotificationPermissionStatus;
  dailyPrimeEnabled: boolean;
  dailyPrimeTime: string;
  threadStrengthAlertsEnabled: boolean;
  threadStrengthThreshold: number;
  unfinishedAnchorRemindersEnabled: boolean;
  weeklyRecapEnabled: boolean;
  milestoneNotificationsEnabled: boolean;
  lastNotificationSentAt?: LastNotificationSentAt;
  sentMilestones?: NotificationMilestone[];
  unfinishedAnchorReminders?: UnfinishedAnchorReminderMap;
}

export interface NotificationRuleContext {
  now: Date;
  sessionLog: SessionLogEntry[];
  totalSessionsCount: number;
  threadStrength: number;
  anchors: Anchor[];
}

export interface NotificationRuleResult {
  category: NotificationCategory;
  eligible: boolean;
  anchorId?: string;
  milestone?: NotificationMilestone;
  fireDate?: Date;
  variables?: Record<string, string | number>;
  reason?: string;
}

export function hasCompletedPrimeToday(sessionLog: SessionLogEntry[], now: Date): boolean {
  const today = localDateString(now);

  return sessionLog.some((entry) => {
    if (entry.type !== 'activate' && entry.type !== 'reinforce' && entry.type !== 'visualize') {
      return false;
    }
    const completedAt = new Date(entry.completedAt);
    return !Number.isNaN(completedAt.getTime()) && localDateString(completedAt) === today;
  });
}

export function parseReminderTime(time: string): { hour: number; minute: number } | null {
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    return null;
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

export function nextReminderFireDate(time: string, now: Date): Date | null {
  const parsed = parseReminderTime(time);
  if (!parsed) {
    return null;
  }

  const fireDate = new Date(now);
  fireDate.setHours(parsed.hour, parsed.minute, 0, 0);
  if (fireDate.getTime() <= now.getTime()) {
    fireDate.setDate(fireDate.getDate() + 1);
  }

  return fireDate;
}

export function canSendCategory(
  state: NotificationRuleState,
  category: NotificationCategory,
  now: Date
): boolean {
  if (!state.notification_enabled || state.notificationPermissionStatus !== 'granted') {
    return false;
  }

  const sentAt = state.lastNotificationSentAt ?? {};
  const todaySends = Object.entries(sentAt).filter(([, value]) => isSameLocalDay(value, now));
  if (todaySends.length >= 3) {
    return false;
  }

  const sentWithinHour = Object.values(sentAt).some((value) => {
    const sentDate = new Date(value ?? '');
    return !Number.isNaN(sentDate.getTime()) && now.getTime() - sentDate.getTime() < HOUR_MS;
  });
  if (sentWithinHour) {
    return false;
  }

  if (PRACTICE_CATEGORIES.has(category)) {
    const practiceSentToday = todaySends.some(([sentCategory]) =>
      PRACTICE_CATEGORIES.has(sentCategory as NotificationCategory)
    );
    if (practiceSentToday) {
      return false;
    }
  }

  return true;
}

export function evaluateDailyPrime(
  state: NotificationRuleState,
  context: NotificationRuleContext
): NotificationRuleResult {
  const fireDate = nextReminderFireDate(state.dailyPrimeTime, context.now);
  const completedToday = hasCompletedPrimeToday(context.sessionLog, context.now);

  // A completed session suppresses only today's reminder. The scheduler
  // replaces deterministic notification IDs whenever app state changes, so
  // making the rule wholly ineligible here would cancel the already-queued
  // reminder and leave nothing scheduled for tomorrow.
  if (
    fireDate &&
    completedToday &&
    fireDate.getFullYear() === context.now.getFullYear() &&
    fireDate.getMonth() === context.now.getMonth() &&
    fireDate.getDate() === context.now.getDate()
  ) {
    fireDate.setDate(fireDate.getDate() + 1);
  }

  const eligible = Boolean(
    state.dailyPrimeEnabled &&
    fireDate &&
    canSendCategory(state, 'daily_prime', context.now)
  );

  return {
    category: 'daily_prime',
    eligible,
    fireDate: eligible ? fireDate ?? undefined : undefined,
    reason: eligible ? undefined : 'daily_prime_ineligible',
  };
}

export function evaluateThreadStrength(
  state: NotificationRuleState,
  context: NotificationRuleContext
): NotificationRuleResult {
  const lastSentAt = state.lastNotificationSentAt?.thread_strength;
  const sentRecently = Boolean(lastSentAt && context.now.getTime() - new Date(lastSentAt).getTime() < DAY_MS);
  const eligible = Boolean(
    state.threadStrengthAlertsEnabled &&
    canSendCategory(state, 'thread_strength', context.now) &&
    context.threadStrength < state.threadStrengthThreshold &&
    !hasCompletedPrimeToday(context.sessionLog, context.now) &&
    !sentRecently
  );

  return {
    category: 'thread_strength',
    eligible,
    fireDate: eligible ? new Date(context.now.getTime() + 5 * 60 * 1000) : undefined,
    variables: { threadStrength: Math.round(context.threadStrength) },
    reason: eligible ? undefined : 'thread_strength_ineligible',
  };
}

export function evaluateUnfinishedAnchor(
  state: NotificationRuleState,
  context: NotificationRuleContext
): NotificationRuleResult {
  const reminderMap = state.unfinishedAnchorReminders ?? {};
  const unfinished = context.anchors.find((anchor) => {
    if (anchor.isReleased || anchor.archivedAt || anchor.isCharged) {
      return false;
    }
    const anchorId = anchor.localId ?? anchor.id;
    const reminder = reminderMap[anchorId];
    if (reminder?.sentAt) {
      return false;
    }
    const startedAt = reminder?.startedAt ?? anchor.createdAt?.toISOString?.() ?? new Date(anchor.createdAt).toISOString();
    return context.now.getTime() - new Date(startedAt).getTime() >= REASONABLE_UNFINISHED_DELAY_MS;
  });

  const eligible = Boolean(
    unfinished &&
    state.unfinishedAnchorRemindersEnabled &&
    canSendCategory(state, 'unfinished_anchor', context.now)
  );

  return {
    category: 'unfinished_anchor',
    eligible,
    anchorId: unfinished ? (unfinished.localId ?? unfinished.id) : undefined,
    fireDate: eligible ? new Date(context.now.getTime() + 5 * 60 * 1000) : undefined,
    reason: eligible ? undefined : 'unfinished_anchor_ineligible',
  };
}

export function evaluateWeeklyRecap(
  state: NotificationRuleState,
  context: NotificationRuleContext
): NotificationRuleResult {
  const weeklySessions = context.sessionLog.filter((entry) => {
    const completedAt = new Date(entry.completedAt);
    return !Number.isNaN(completedAt.getTime()) &&
      context.now.getTime() - completedAt.getTime() < 7 * DAY_MS &&
      (entry.type === 'activate' || entry.type === 'reinforce' || entry.type === 'visualize');
  });
  const strongestAnchor = context.anchors
    .filter((anchor) => !anchor.isReleased && !anchor.archivedAt)
    .sort((left, right) => (right.activationCount ?? 0) - (left.activationCount ?? 0))[0];
  const lastSentAt = state.lastNotificationSentAt?.weekly_recap;
  const sentThisWeek = Boolean(lastSentAt && context.now.getTime() - new Date(lastSentAt).getTime() < 7 * DAY_MS);
  const eligible = Boolean(
    state.weeklyRecapEnabled &&
    canSendCategory(state, 'weekly_recap', context.now) &&
    !sentThisWeek &&
    (weeklySessions.length > 0 || context.anchors.length > 0)
  );

  return {
    category: 'weekly_recap',
    eligible,
    fireDate: eligible ? new Date(context.now.getTime() + 5 * 60 * 1000) : undefined,
    variables: {
      sessionCount: weeklySessions.length,
      anchorName: strongestAnchor ? `${strongestAnchor.category} anchor` : 'your anchor',
      threadStrength: Math.round(context.threadStrength),
    },
    reason: eligible ? undefined : 'weekly_recap_ineligible',
  };
}

export function detectMilestone(
  totalSessionsCount: number,
  threadStrength: number,
  sentMilestones: NotificationMilestone[] = []
): NotificationMilestone | null {
  const candidates: NotificationMilestone[] = [];
  if (totalSessionsCount >= 3) candidates.push('sessions_3');
  if (totalSessionsCount >= 7) candidates.push('sessions_7');
  if (totalSessionsCount >= 30) candidates.push('sessions_30');
  if (threadStrength >= 100) candidates.push('thread_strength_100');

  return candidates.find((candidate) => !sentMilestones.includes(candidate)) ?? null;
}

export function getMilestoneLabel(milestone: NotificationMilestone): string {
  switch (milestone) {
    case 'sessions_3':
      return '3 sessions completed';
    case 'sessions_7':
      return '7 sessions completed';
    case 'sessions_30':
      return '30 sessions completed';
    case 'thread_strength_100':
      return 'Thread Strength reached 100%';
  }
}

export function evaluateMilestone(
  state: NotificationRuleState,
  context: NotificationRuleContext
): NotificationRuleResult {
  const milestone = detectMilestone(
    context.totalSessionsCount,
    context.threadStrength,
    state.sentMilestones
  );
  const eligible = Boolean(
    milestone &&
    state.milestoneNotificationsEnabled &&
    canSendCategory(state, 'milestone', context.now)
  );

  return {
    category: 'milestone',
    eligible,
    milestone: milestone ?? undefined,
    fireDate: eligible ? new Date(context.now.getTime() + 5 * 60 * 1000) : undefined,
    variables: milestone ? { milestoneLabel: getMilestoneLabel(milestone) } : undefined,
    reason: eligible ? undefined : 'milestone_ineligible',
  };
}

export function evaluateNotificationRules(
  state: NotificationRuleState,
  context: NotificationRuleContext
): NotificationRuleResult[] {
  return [
    evaluateMilestone(state, context),
    evaluateThreadStrength(state, context),
    evaluateUnfinishedAnchor(state, context),
    evaluateWeeklyRecap(state, context),
    evaluateDailyPrime(state, context),
  ];
}

function isSameLocalDay(value: string | undefined, now: Date): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}
