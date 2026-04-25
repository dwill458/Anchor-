import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationType = 'WEAVER' | 'MIRROR' | 'ALCHEMIST' | null;

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
  last_sent_type?: Exclude<NotificationType, null>;
  last_sent_utc_date?: string;
  [key: string]: unknown;
};

type UserRow = {
  id: string;
  notification_state: NotificationState | null;
  fcm_token: string | null;
  apns_token: string | null;
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const utcDateString = (date: Date): string => date.toISOString().slice(0, 10);

const alreadySentToday = (state: NotificationState, now: Date): boolean =>
  state.last_sent_utc_date === utcDateString(now);

const evalWeaver = (state: NotificationState): boolean => {
  const isStruggler =
    (state.miss_streak ?? Number.MAX_SAFE_INTEGER) < 3 ||
    Boolean(state.app_opened_in_last_5_days);

  return Boolean(state.missed_yesterday) && isStruggler && !Boolean(state.primed_today);
};

const evalMirror = (state: NotificationState): boolean => {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  const isMondayMorning = day === 1 && hour >= 6 && hour < 12;
  const isSundayEvening = day === 0 && hour >= 18;

  return (isMondayMorning || isSundayEvening) && (state.total_primes_this_week ?? 0) >= 1;
};

const evalAlchemist = (state: NotificationState): boolean =>
  (state.current_primes ?? 0) >= (state.goal_primes ?? Number.MAX_SAFE_INTEGER) &&
  !Boolean(state.has_entered_burn_flow) &&
  !Boolean(state.sigil_in_vault);

const resolvePriority = (eligible: {
  alchemist: boolean;
  weaver: boolean;
  mirror: boolean;
}): NotificationType => {
  if (eligible.alchemist) return 'ALCHEMIST';
  if (eligible.weaver) return 'WEAVER';
  if (eligible.mirror) return 'MIRROR';
  return null;
};

const isSovereign = (state: NotificationState): boolean =>
  (state.total_primes_all_time ?? 0) >= 50 || (state.alchemist_milestones_count ?? 0) >= 3;

const buildPayload = (type: NotificationType, state: NotificationState) => {
  switch (type) {
    case 'WEAVER':
      return {
        title: 'The thread is still here.',
        body: 'One prime today ties the knot. Reconnect?',
        deepLink: '/sanctuary',
      };
    case 'MIRROR':
      return {
        title: 'Your week in reflection.',
        body: `${state.total_primes_this_week ?? 0} primes. You aren't just practicing-you're becoming.`,
        deepLink: '/thread-review',
      };
    case 'ALCHEMIST':
      return {
        title: isSovereign(state) ? 'The Sigil awakens.' : 'The Sigil is fully charged.',
        body: `${state.current_primes ?? 0} primes reached. Is it time to release to the Vault?`,
        deepLink: '/burn-release',
      };
    default:
      return null;
  }
};

async function sendPush(options: {
  userId: string;
  title: string;
  body: string;
  deepLink: string;
  fcmToken?: string | null;
  apnsToken?: string | null;
}): Promise<boolean> {
  if (!options.fcmToken && !options.apnsToken) {
    console.log(`[notifications] No push token for user ${options.userId}`);
    return false;
  }

  const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
  if (!options.fcmToken || !fcmServerKey) {
    console.log(
      `[notifications] Push provider not configured for user ${options.userId}; payload prepared only`
    );
    return false;
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
      },
    }),
  });

  if (!response.ok) {
    const failureBody = await response.text();
    throw new Error(failureBody || 'Failed to send FCM push.');
  }

  return true;
}

async function markNotificationSent(
  userId: string,
  existingState: NotificationState,
  type: Exclude<NotificationType, null>
): Promise<void> {
  const now = new Date();
  const nextState: NotificationState = {
    ...existingState,
    last_sent_at: now.toISOString(),
    last_sent_type: type,
    last_sent_utc_date: utcDateString(now),
  };

  const { error } = await supabase
    .from('users')
    .update({ notification_state: nextState })
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

export async function handleTriggerAll(_req: Request): Promise<Response> {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, notification_state, fcm_token, apns_token')
      .eq('notifications_enabled', true);

    if (error) {
      throw error;
    }

    for (const user of (users ?? []) as UserRow[]) {
      const state = user.notification_state ?? {};
      if (alreadySentToday(state, new Date())) {
        continue;
      }

      const eligible = {
        alchemist: evalAlchemist(state),
        weaver: evalWeaver(state),
        mirror: evalMirror(state),
      };

      const toFire = resolvePriority(eligible);
      if (!toFire) {
        continue;
      }

      const payload = buildPayload(toFire, state);
      if (!payload) {
        continue;
      }

      const sent = await sendPush({
        userId: user.id,
        ...payload,
        fcmToken: user.fcm_token,
        apnsToken: user.apns_token,
      });

      if (sent) {
        await markNotificationSent(user.id, state, toFire);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[notifications/trigger-all] Error:', error);
    return new Response('Error', { status: 500 });
  }
}

