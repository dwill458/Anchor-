import type { NotificationState } from '@/services/NotificationState';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config';
import { logger } from '@/utils/logger';

export async function syncNotificationStateToServer(
  userId: string | null,
  state: NotificationState
): Promise<void> {
  try {
    if (!userId || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return;
    }

    await fetch(`${SUPABASE_URL}/functions/v1/notifications/sync-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ userId, notificationState: state }),
    });
  } catch (error) {
    logger.error('[NotificationSyncService] syncNotificationStateToServer error', error);
  }
}
