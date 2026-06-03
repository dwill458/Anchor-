import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationState = Record<string, unknown>;
type PushTokens = {
  expoPushToken?: string | null;
  fcmToken?: string | null;
  apnsToken?: string | null;
};

const adminClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

type ExistingUserRow = {
  id: string;
  notification_state: NotificationState | null;
  updated_at?: string | null;
};

const stripServerManagedNotificationFields = (
  notificationState: NotificationState
): NotificationState => {
  const {
    last_sent_at: _lastSentAt,
    last_sent_type: _lastSentType,
    last_sent_utc_date: _lastSentUtcDate,
    updated_at: _updatedAt,
    ...clientManagedState
  } = notificationState;

  return clientManagedState;
};

export async function handleSyncState(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Missing bearer token', { status: 401 });
    }

    const token = authHeader.slice(7);
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user: authUser },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !authUser?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { notificationState, pushTokens, replacePushTokens = true } = await req.json() as {
      notificationState?: NotificationState;
      pushTokens?: PushTokens;
      replacePushTokens?: boolean;
    };

    if (
      (!notificationState || typeof notificationState !== 'object') &&
      !pushTokens
    ) {
      return new Response('Missing notificationState or pushTokens', { status: 400 });
    }

    const { data: existingUser, error: fetchError } = await adminClient
      .from('users')
      .select('id, notification_state, updated_at')
      .eq('email', authUser.email)
      .single<ExistingUserRow>();

    if (fetchError) {
      throw fetchError;
    }

    const sanitizedNotificationState = notificationState
      ? stripServerManagedNotificationFields(notificationState)
      : undefined;

    const mergedState = sanitizedNotificationState
      ? {
        ...(existingUser?.notification_state ?? {}),
        ...sanitizedNotificationState,
      }
      : (existingUser?.notification_state ?? {});

    const updatePayload: Record<string, unknown> = { notification_state: mergedState };
    if (sanitizedNotificationState && 'notification_enabled' in sanitizedNotificationState) {
      updatePayload.notifications_enabled = Boolean(sanitizedNotificationState.notification_enabled);
    }

    if (pushTokens) {
      if (replacePushTokens || 'expoPushToken' in pushTokens) {
        updatePayload.expo_push_token = pushTokens.expoPushToken ?? null;
      }
      if (replacePushTokens || 'fcmToken' in pushTokens) {
        updatePayload.fcm_token = pushTokens.fcmToken ?? null;
      }
      if (replacePushTokens || 'apnsToken' in pushTokens) {
        updatePayload.apns_token = pushTokens.apnsToken ?? null;
      }
    }

    updatePayload.updated_at = new Date().toISOString();

    let updateQuery = adminClient
      .from('users')
      .update(updatePayload)
      .eq('id', existingUser.id);

    updateQuery = existingUser.updated_at
      ? updateQuery.eq('updated_at', existingUser.updated_at)
      : updateQuery.is('updated_at', null);

    const { data: updatedUser, error } = await updateQuery
      .select('notification_state, updated_at')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!updatedUser) {
      return new Response(
        JSON.stringify({ error: 'Notification state update conflict.' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        notificationState: updatedUser.notification_state,
        updatedAt: updatedUser.updated_at,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[notifications/sync-state] Error:', error);
    return new Response('Error', { status: 500 });
  }
}
