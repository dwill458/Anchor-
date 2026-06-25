import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationCategory = 'daily_prime' | 'thread_strength' | 'weekly_recap' | 'milestone';
type NotificationTone = 'direct' | 'encouraging' | 'reflective' | 'performance';

type NotificationState = {
  miss_streak?: number;
  app_opened_in_last_5_days?: boolean;
  missed_yesterday?: boolean;
  primed_today?: boolean;
  total_primes_this_week?: number;
  current_primes?: number;
  goal_primes?: number;
  has_entered_burn_flow?: boolean;
  sigil_in_vault?: boolean;
  total_primes_all_time?: number;
  alchemist_milestones_count?: number;
  last_sent_at?: string;
  last_sent_type?: NotificationCategory | 'WEAVER' | 'ALCHEMIST' | 'MIRROR' | 'MICRO_PRIME';
  last_sent_utc_date?: string;
  active_session?: boolean;
  active_hours_end?: number;
  dailyPrimeTime?: string;
  timezone?: string;
  weaver_enabled?: boolean;
  dailyPrimeEnabled?: boolean;
  threadStrength?: number;
  threadStrengthAlertsEnabled?: boolean;
  threadStrengthThreshold?: number;
  weeklyRecapEnabled?: boolean;
  milestoneNotificationsEnabled?: boolean;
  notificationTone?: NotificationTone;
  lastNotificationSentAt?: Partial<Record<NotificationCategory, string>>;
  sentMilestones?: string[];
  [key: string]: unknown;
};

type UserRow = {
  id: string;
  notification_state: NotificationState | null;
  expo_push_token: string | null;
  fcm_token: string | null;
  apns_token: string | null;
  updated_at?: string | null;
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_SEND_HOUR = 21;
const DATE_FORMATTER_LOCALE = 'en-CA';

const getValidTimezone = (timezone?: string): string => timezone || DEFAULT_TIMEZONE;

const withTwoHourBuffer = (date: Date): Date => new Date(date.getTime() - 2 * 60 * 60 * 1000);

export const notificationDateString = (
  date: Date,
  timezone?: string
): string => {
  const adjusted = withTwoHourBuffer(date);

  try {
    return new Intl.DateTimeFormat(DATE_FORMATTER_LOCALE, {
      timeZone: getValidTimezone(timezone),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(adjusted);
  } catch {
    return adjusted.toISOString().slice(0, 10);
  }
};

export const localHourForTimezone = (date: Date, timezone?: string): number => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: getValidTimezone(timezone),
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? Number.NaN);
    return Number.isNaN(hour) ? date.getUTCHours() : hour;
  } catch {
    return date.getUTCHours();
  }
};

export const alreadySentToday = (state: NotificationState, now: Date): boolean =>
  state.last_sent_utc_date === notificationDateString(now, state.timezone);

export const isAllowedSendHour = (state: NotificationState, now: Date): boolean =>
  localHourForTimezone(now, state.timezone) === resolveSendHour(state);

const resolveSendHour = (state: NotificationState): number => {
  const time = typeof state.dailyPrimeTime === 'string' ? state.dailyPrimeTime : null;
  const match = time ? /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(time) : null;
  if (match) {
    return Number(match[1]);
  }

  return state.active_hours_end ?? DEFAULT_SEND_HOUR;
};

const wasCategorySentRecently = (
  state: NotificationState,
  category: NotificationCategory,
  now: Date,
  windowMs: number
): boolean => {
  const sentAt = state.lastNotificationSentAt?.[category];
  if (!sentAt) {
    return false;
  }

  const sentDate = new Date(sentAt);
  return !Number.isNaN(sentDate.getTime()) && now.getTime() - sentDate.getTime() < windowMs;
};

const evalDailyPrime = (state: NotificationState): boolean =>
  state.dailyPrimeEnabled !== false &&
  !Boolean(state.primed_today) &&
  !Boolean(state.active_session);

const evalThreadStrength = (state: NotificationState, now: Date): boolean =>
  state.threadStrengthAlertsEnabled !== false &&
  (state.threadStrength ?? 100) < (state.threadStrengthThreshold ?? 70) &&
  !Boolean(state.primed_today) &&
  !wasCategorySentRecently(state, 'thread_strength', now, 24 * 60 * 60 * 1000);

const evalWeeklyRecap = (state: NotificationState, now: Date): boolean =>
  Boolean(state.weeklyRecapEnabled) &&
  (state.total_primes_this_week ?? 0) > 0 &&
  !wasCategorySentRecently(state, 'weekly_recap', now, 7 * 24 * 60 * 60 * 1000);

const resolvePriority = (eligible: {
  milestone: boolean;
  threadStrength: boolean;
  weeklyRecap: boolean;
  dailyPrime: boolean;
}): NotificationCategory | null => {
  if (eligible.milestone) return 'milestone';
  if (eligible.threadStrength) return 'thread_strength';
  if (eligible.weeklyRecap) return 'weekly_recap';
  if (eligible.dailyPrime) return 'daily_prime';
  return null;
};

const detectMilestone = (state: NotificationState): string | null => {
  const sent = new Set(state.sentMilestones ?? []);
  const total = state.total_primes_all_time ?? 0;
  if (total >= 3 && !sent.has('sessions_3')) return 'sessions_3';
  if (total >= 7 && !sent.has('sessions_7')) return 'sessions_7';
  if (total >= 30 && !sent.has('sessions_30')) return 'sessions_30';
  if ((state.threadStrength ?? 0) >= 100 && !sent.has('thread_strength_100')) {
    return 'thread_strength_100';
  }
  return null;
};

const getMilestoneLabel = (milestone?: string): string => {
  switch (milestone) {
    case 'sessions_3':
      return '3 sessions completed';
    case 'sessions_7':
      return '7 sessions completed';
    case 'sessions_30':
      return '30 sessions completed';
    case 'thread_strength_100':
      return 'Thread Strength reached 100%';
    default:
      return 'Progress milestone';
  }
};

const buildPayload = (category: NotificationCategory, state: NotificationState, milestone?: string) => {
  const tone = state.notificationTone ?? 'encouraging';
  switch (category) {
    case 'daily_prime':
      return {
        title: 'Your anchor is ready',
        body: "One Focus Session can reinforce today's thread.",
        deepLink: '/sanctuary',
        templateId: 'daily_prime_direct_1',
        tone,
      };
    case 'thread_strength':
      return {
        title: 'Thread Strength is fading',
        body: 'A short Focus Session can restore momentum.',
        deepLink: '/sanctuary',
        templateId: 'thread_strength_direct_1',
        tone,
      };
    case 'weekly_recap':
      return {
        title: 'Your weekly pattern',
        body: `You completed ${state.total_primes_this_week ?? 0} sessions this week.`,
        deepLink: '/practice',
        templateId: 'weekly_recap_direct_1',
        tone,
      };
    case 'milestone':
      return {
        title: getMilestoneLabel(milestone),
        body: 'The thread is holding.',
        deepLink: '/sanctuary',
        templateId: 'milestone_direct_7_sessions',
        tone,
      };
    default:
      return null;
  }
};

async function clearInvalidTokens(
  userId: string,
  invalid: {
    expoPushToken?: boolean;
    fcmToken?: boolean;
    apnsToken?: boolean;
  }
): Promise<void> {
  const updatePayload: Record<string, null> = {};

  if (invalid.expoPushToken) {
    updatePayload.expo_push_token = null;
  }
  if (invalid.fcmToken) {
    updatePayload.fcm_token = null;
  }
  if (invalid.apnsToken) {
    updatePayload.apns_token = null;
  }

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  const { error } = await supabase.from('users').update(updatePayload).eq('id', userId);
  if (error) {
    throw error;
  }
}

async function sendExpoPush(options: {
  userId: string;
  title: string;
  body: string;
  deepLink: string;
  category: NotificationCategory;
  templateId: string;
  tone: NotificationTone;
  milestone?: string;
  expoPushToken: string;
}): Promise<{ sent: boolean; invalidExpoToken?: boolean }> {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: options.expoPushToken,
      title: options.title,
      body: options.body,
      data: {
        deepLink: options.deepLink,
        category: options.category,
        templateId: options.templateId,
        tone: options.tone,
        milestone: options.milestone,
      },
    }),
  });

  if (!response.ok) {
    const failureBody = await response.text();
    throw new Error(failureBody || 'Failed to send Expo push.');
  }

  const payload = await response.json().catch(() => null) as
    | { data?: Array<{ status?: string; details?: { error?: string } }> }
    | null;
  const ticket = payload?.data?.[0];
  const errorCode = ticket?.details?.error;

  if (ticket?.status === 'ok') {
    return { sent: true };
  }

  if (errorCode === 'DeviceNotRegistered') {
    console.log(`[notifications] Invalid Expo push token for user ${options.userId}`);
    return { sent: false, invalidExpoToken: true };
  }

  if (errorCode) {
    throw new Error(`Expo push error: ${errorCode}`);
  }

  return { sent: false };
}

async function sendPush(options: {
  userId: string;
  title: string;
  body: string;
  deepLink: string;
  category: NotificationCategory;
  templateId: string;
  tone: NotificationTone;
  milestone?: string;
  expoPushToken?: string | null;
  fcmToken?: string | null;
  apnsToken?: string | null;
}): Promise<{
  sent: boolean;
  invalidExpoToken?: boolean;
  invalidFcmToken?: boolean;
}> {
  if (options.expoPushToken) {
    return sendExpoPush({
      userId: options.userId,
      title: options.title,
      body: options.body,
      deepLink: options.deepLink,
      expoPushToken: options.expoPushToken,
    });
  }

  if (!options.fcmToken && !options.apnsToken) {
    console.log(`[notifications] No push token for user ${options.userId}`);
    return { sent: false };
  }

  const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
  if (!options.fcmToken || !fcmServerKey) {
    console.log(
      `[notifications] Push provider not configured for user ${options.userId}; payload prepared only`
    );
    return { sent: false };
  }

  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      Authorization: `key=${fcmServerKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: options.fcmToken,
      notification: {
        title: options.title,
        body: options.body,
      },
      data: {
        deepLink: options.deepLink,
        category: options.category,
        templateId: options.templateId,
        tone: options.tone,
        milestone: options.milestone,
      },
    }),
  });

  if (!response.ok) {
    const failureBody = await response.text();
    throw new Error(failureBody || 'Failed to send FCM push.');
  }

  const payload = await response.json().catch(() => null) as
    | { failure?: number; results?: Array<{ error?: string }> }
    | null;
  const errorCode = payload?.results?.[0]?.error;

  if ((payload?.failure ?? 0) > 0 && errorCode) {
    if (errorCode === 'InvalidRegistration' || errorCode === 'NotRegistered') {
      console.log(`[notifications] Invalid FCM token for user ${options.userId}`);
      return { sent: false, invalidFcmToken: true };
    }

    throw new Error(`FCM push error: ${errorCode}`);
  }

  return { sent: true };
}

async function markNotificationSent(
  userId: string,
  existingState: NotificationState,
  category: NotificationCategory,
  milestone?: string,
  existingUpdatedAt?: string | null
): Promise<void> {
  const now = new Date();
  const nextState: NotificationState = {
    ...existingState,
    lastNotificationSentAt: {
      ...(existingState.lastNotificationSentAt ?? {}),
      [category]: now.toISOString(),
    },
    last_sent_at: now.toISOString(),
    last_sent_type: category,
    last_sent_utc_date: notificationDateString(now, existingState.timezone),
  };
  if (category === 'milestone' && milestone) {
    nextState.sentMilestones = Array.from(new Set([...(existingState.sentMilestones ?? []), milestone]));
  }

  let query = supabase
    .from('users')
    .update({
      notification_state: nextState,
      updated_at: now.toISOString(),
    })
    .eq('id', userId);

  query = existingUpdatedAt ? query.eq('updated_at', existingUpdatedAt) : query.is('updated_at', null);

  const { data, error } = await query.select('id').maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    console.warn(`[notifications] Skipped stale notification_state update for user ${userId}`);
  }
}

export async function handleTriggerAll(_req: Request): Promise<Response> {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, notification_state, expo_push_token, fcm_token, apns_token, updated_at')
      .eq('notifications_enabled', true);

    if (error) {
      throw error;
    }

    for (const user of (users ?? []) as UserRow[]) {
      const state = user.notification_state ?? {};
      const now = new Date();

      if (!isAllowedSendHour(state, now)) {
        continue;
      }

      if (alreadySentToday(state, now)) {
        continue;
      }

      const eligible = {
        milestone: state.milestoneNotificationsEnabled !== false && detectMilestone(state) != null,
        threadStrength: evalThreadStrength(state, now),
        weeklyRecap: evalWeeklyRecap(state, now),
        dailyPrime: evalDailyPrime(state),
      };

      const toFire = resolvePriority(eligible);
      if (!toFire) {
        continue;
      }

      const milestone = toFire === 'milestone' ? detectMilestone(state) ?? undefined : undefined;
      const payload = buildPayload(toFire, state, milestone);
      if (!payload) {
        continue;
      }

      const result = await sendPush({
        userId: user.id,
        ...payload,
        category: toFire,
        milestone,
        expoPushToken: user.expo_push_token,
        fcmToken: user.fcm_token,
        apnsToken: user.apns_token,
      });

      if (result.invalidExpoToken || result.invalidFcmToken) {
        await clearInvalidTokens(user.id, {
          expoPushToken: result.invalidExpoToken,
          fcmToken: result.invalidFcmToken,
        });
      }

      if (result.sent) {
        await markNotificationSent(user.id, state, toFire, milestone, user.updated_at);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[notifications/trigger-all] Error:', error);
    return new Response('Error', { status: 500 });
  }
}
