import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationState = Record<string, unknown>;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export async function handleSyncState(req: Request): Promise<Response> {
  try {
    const { userId, notificationState } = await req.json() as {
      userId?: string;
      notificationState?: NotificationState;
    };

    if (!userId || !notificationState || typeof notificationState !== 'object') {
      return new Response('Missing userId or notificationState', { status: 400 });
    }

    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('notification_state')
      .eq('id', userId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const mergedState = {
      ...(existingUser?.notification_state ?? {}),
      ...notificationState,
    };

    const updatePayload: Record<string, unknown> = { notification_state: mergedState };
    if ('notification_enabled' in notificationState) {
      updatePayload.notifications_enabled = Boolean(notificationState.notification_enabled);
    }

    const { error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId);

    if (error) {
      throw error;
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[notifications/sync-state] Error:', error);
    return new Response('Error', { status: 500 });
  }
}

