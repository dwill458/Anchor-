import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationType = 'WEAVER' | 'ALCHEMIST' | null;

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
  active_session?: boolean;
  timezone?: string;
  weaver_enabled?: boolean;
  [key: string]: unknown;
};

type UserRow = {
  id: string;
  notification_state: NotificationState | null;
  expo_push_token: string | null;
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

  return (
    Boolean(state.missed_yesterday) &&
    isStruggler &&
    !Boolean(state.primed_today) &&
    state.weaver_enabled !== false
  );
};

const evalAlchemist = (state: NotificationState): boolean =>
  (state.current_primes ?? 0) >= (state.goal_primes ?? Number.MAX_SAFE_INTEGER) &&
  !Boolean(state.has_entered_burn_flow) &&
  !Boolean(state.sigil_in_vault);

const resolvePriority = (eligible: {
  alchemist: boolean;
  weaver: boolean;
}): NotificationType => {
  if (eligible.alchemist) return 'ALCHEMIST';
  if (eligible.weaver) return 'WEAVER';
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
    case 'ALCHEMIST':
      return {
        title: isSovereign(state)
          ? 'The thread is woven.'
          : 'The anchor is complete.',
        body: `${state.current_primes ?? 0} primes forged. Is it time to release to the Vault?`,
        deepLink: '/burn-release',
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
      .select('id, notification_state, expo_push_token, fcm_token, apns_token')
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
      };

      const toFire = resolvePriority(eligible);
      if (!toFire) {
        continue;
      }

      const payload = buildPayload(toFire, state);
      if (!payload) {
        continue;
      }

      const result = await sendPush({
        userId: user.id,
        ...payload,
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
        await markNotificationSent(user.id, state, toFire);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[notifications/trigger-all] Error:', error);
    return new Response('Error', { status: 500 });
  }
}
