export type NotificationCategory =
  | 'daily_prime'
  | 'thread_strength'
  | 'unfinished_anchor'
  | 'weekly_recap'
  | 'milestone';

export type NotificationTone = 'direct' | 'encouraging' | 'reflective' | 'performance';

export type NotificationPermissionStatus = 'undetermined' | 'granted' | 'denied';

export type NotificationMilestone = 'sessions_3' | 'sessions_7' | 'sessions_30' | 'thread_strength_100';

export interface NotificationTemplate {
  id: string;
  category: NotificationCategory;
  tone: NotificationTone;
  title: string;
  body: string;
  allowedVariables: string[];
}

export interface NotificationPersonalizationInput {
  userId: string;
  category: NotificationCategory;
  anchorName?: string;
  threadStrength?: number;
  recentSessions: number;
  preferredTone: NotificationTone;
  lastOpenedNotificationAt?: string;
}

export type LastNotificationSentAt = Partial<Record<NotificationCategory, string>>;

export interface UnfinishedAnchorReminderState {
  startedAt: string;
  sentAt?: string;
}

export type UnfinishedAnchorReminderMap = Record<string, UnfinishedAnchorReminderState>;

