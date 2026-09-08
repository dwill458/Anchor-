import type { Anchor } from '@/types';
import type { SessionLogEntry } from '@/stores/sessionStore';
import type { PracticeSessionRecord } from '@/types/practice';
import { selectCanonicalPracticeEvents } from '@/utils/practiceMetrics';
import { localDateString } from '@/services/DailyGoalNudgeService';
import type {
  LastNotificationSentAt,
  NotificationCategory,
  NotificationPermissionStatus,
  UnfinishedAnchorReminderMap,
} from './notificationTypes';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const PRACTICE_CATEGORIES = new Set<NotificationCategory>(['daily_prime', 'thread_strength']);
const REASONABLE_UNFINISHED_DELAY_MS = DAY_MS;
/** Grace period before an immediately-triggered reminder is delivered. */
const SOON_MS = 5 * 60 * 1000;

export interface NotificationRuleState {
  notification_enabled: boolean;
  notificationPermissionStatus: NotificationPermissionStatus;
  dailyPrimeEnabled: boolean;
  dailyPrimeTime: string;
  threadStrengthAlertsEnabled: boolean;
  threadStrengthThreshold: number;
  unfinishedAnchorRemindersEnabled: boolean;
  weeklyRecapEnabled: boolean;
  lastNotificationSentAt?: LastNotificationSentAt;
  unfinishedAnchorReminders?: UnfinishedAnchorReminderMap;
}

export interface NotificationRuleContext {
  now: Date;
  sessionLog: SessionLogEntry[];
  practiceHistory?: PracticeSessionRecord[];
  accountId?: string | null;
  totalSessionsCount: number;
  threadStrength: number;
  anchors: Anchor[];
}

export interface NotificationRuleResult {
  category: NotificationCategory;
  eligible: boolean;
  anchorId?: string;
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

function completedCanonicalEvents(context: NotificationRuleContext): PracticeSessionRecord[] | null {
  if (context.practiceHistory == null || !context.accountId) return null;
  return selectCanonicalPracticeEvents(context.practiceHistory, context.accountId, context.now);
}

function hasCompletedPracticeToday(context: NotificationRuleContext): boolean {
  const canonical = completedCanonicalEvents(context);
  return canonical
    ? canonical.some((entry) => entry.localDateKey === localDateString(context.now))
    : hasCompletedPrimeToday(context.sessionLog, context.now);
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

/**
 * `lastNotificationSentAt` holds the *delivery* time of each category, which is
 * the fire date of the notification that was scheduled for it. A fire date in
 * the future has not been delivered yet and must not count against the
 * frequency caps — otherwise scheduling a reminder immediately disqualifies
 * every category, and the next scheduler pass cancels the pending reminder
 * without replacing it.
 */
function deliveredTimestamps(
  sentAt: LastNotificationSentAt,
  now: Date
): [string, Date][] {
  return Object.entries(sentAt).flatMap(([category, value]) => {
    const sentDate = new Date(value ?? '');
    if (Number.isNaN(sentDate.getTime()) || sentDate.getTime() > now.getTime()) {
      return [];
    }
    return [[category, sentDate] as [string, Date]];
  });
}

function wasDeliveredWithin(value: string | undefined, now: Date, windowMs: number): boolean {
  if (!value) {
    return false;
  }

  const sentDate = new Date(value);
  if (Number.isNaN(sentDate.getTime()) || sentDate.getTime() > now.getTime()) {
    return false;
  }

  return now.getTime() - sentDate.getTime() < windowMs;
}

/**
 * Frequency caps are evaluated against the day the notification would be
 * *delivered*, not the moment it is scheduled. Scheduling tomorrow's reminder
 * the morning after today's one fired must not be blocked by today's delivery.
 */
export function canSendCategory(
  state: NotificationRuleState,
  category: NotificationCategory,
  now: Date,
  fireDate: Date = now
): boolean {
  if (!state.notification_enabled || state.notificationPermissionStatus !== 'granted') {
    return false;
  }

  const delivered = deliveredTimestamps(state.lastNotificationSentAt ?? {}, now);
  const sameDaySends = delivered.filter(([, sentDate]) =>
    isSameLocalDay(sentDate.toISOString(), fireDate)
  );
  if (sameDaySends.length >= 3) {
    return false;
  }

  const sentWithinHour = delivered.some(
    ([, sentDate]) => fireDate.getTime() - sentDate.getTime() < HOUR_MS
  );
  if (sentWithinHour) {
    return false;
  }

  if (PRACTICE_CATEGORIES.has(category)) {
    const practiceSentSameDay = sameDaySends.some(([sentCategory]) =>
      PRACTICE_CATEGORIES.has(sentCategory as NotificationCategory)
    );
    if (practiceSentSameDay) {
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
  const deliveredToday =
    wasDeliveredWithin(state.lastNotificationSentAt?.daily_prime, context.now, DAY_MS) &&
    isSameLocalDay(state.lastNotificationSentAt?.daily_prime, context.now);

  // A completed session — or a reminder that already went out today — suppresses
  // only today's occurrence. The scheduler replaces deterministic notification
  // IDs whenever app state changes, so making the rule wholly ineligible here
  // would cancel the already-queued reminder and leave nothing scheduled for
  // tomorrow.
  if (
    fireDate &&
    (hasCompletedPracticeToday(context) || deliveredToday) &&
    isSameLocalDay(context.now.toISOString(), fireDate)
  ) {
    fireDate.setDate(fireDate.getDate() + 1);
  }

  const eligible = Boolean(
    state.dailyPrimeEnabled &&
    fireDate &&
    canSendCategory(state, 'daily_prime', context.now, fireDate)
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
  const sentRecently = wasDeliveredWithin(
    state.lastNotificationSentAt?.thread_strength,
    context.now,
    DAY_MS
  );
  const fireDate = new Date(context.now.getTime() + SOON_MS);
  const eligible = Boolean(
    state.threadStrengthAlertsEnabled &&
    canSendCategory(state, 'thread_strength', context.now, fireDate) &&
    context.threadStrength < state.threadStrengthThreshold &&
    !hasCompletedPracticeToday(context) &&
    !sentRecently
  );

  return {
    category: 'thread_strength',
    eligible,
    fireDate: eligible ? fireDate : undefined,
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

  const fireDate = new Date(context.now.getTime() + SOON_MS);
  const eligible = Boolean(
    unfinished &&
    state.unfinishedAnchorRemindersEnabled &&
    canSendCategory(state, 'unfinished_anchor', context.now, fireDate)
  );

  return {
    category: 'unfinished_anchor',
    eligible,
    anchorId: unfinished ? (unfinished.localId ?? unfinished.id) : undefined,
    fireDate: eligible ? fireDate : undefined,
    reason: eligible ? undefined : 'unfinished_anchor_ineligible',
  };
}

export function evaluateWeeklyRecap(
  state: NotificationRuleState,
  context: NotificationRuleContext
): NotificationRuleResult {
  const canonical = completedCanonicalEvents(context);
  const weeklySessionCount = canonical
    ? canonical.filter((entry) => context.now.getTime() - new Date(entry.completedAt).getTime() < 7 * DAY_MS).length
    : context.sessionLog.filter((entry) => {
    const completedAt = new Date(entry.completedAt);
    return !Number.isNaN(completedAt.getTime()) &&
      context.now.getTime() - completedAt.getTime() < 7 * DAY_MS &&
      (entry.type === 'activate' || entry.type === 'reinforce' || entry.type === 'visualize');
    }).length;
  const strongestAnchor = context.anchors
    .filter((anchor) => !anchor.isReleased && !anchor.archivedAt)
    .sort((left, right) => (right.activationCount ?? 0) - (left.activationCount ?? 0))[0];
  const sentThisWeek = wasDeliveredWithin(
    state.lastNotificationSentAt?.weekly_recap,
    context.now,
    7 * DAY_MS
  );
  const fireDate = new Date(context.now.getTime() + SOON_MS);
  const eligible = Boolean(
    state.weeklyRecapEnabled &&
    canSendCategory(state, 'weekly_recap', context.now, fireDate) &&
    !sentThisWeek &&
    (weeklySessionCount > 0 || context.anchors.length > 0)
  );

  return {
    category: 'weekly_recap',
    eligible,
    fireDate: eligible ? fireDate : undefined,
    variables: {
      sessionCount: weeklySessionCount,
      anchorName: strongestAnchor ? `${strongestAnchor.category} anchor` : 'your anchor',
      threadStrength: Math.round(context.threadStrength),
    },
    reason: eligible ? undefined : 'weekly_recap_ineligible',
  };
}

export function evaluateNotificationRules(
  state: NotificationRuleState,
  context: NotificationRuleContext
): NotificationRuleResult[] {
  return [
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
