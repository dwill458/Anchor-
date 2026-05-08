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
      .select('id, notification_state')
      .eq('email', authUser.email)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const mergedState = notificationState
      ? {
        ...(existingUser?.notification_state ?? {}),
        ...notificationState,
      }
      : (existingUser?.notification_state ?? {});

    const updatePayload: Record<string, unknown> = { notification_state: mergedState };
    if (notificationState && 'notification_enabled' in notificationState) {
      updatePayload.notifications_enabled = Boolean(notificationState.notification_enabled);
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

    const { error } = await adminClient
      .from('users')
      .update(updatePayload)
      .eq('id', existingUser.id);

    if (error) {
      throw error;
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[notifications/sync-state] Error:', error);
    return new Response('Error', { status: 500 });
  }
}
