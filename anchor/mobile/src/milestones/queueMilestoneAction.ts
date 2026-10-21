import { apiClient, type AccountBoundRequestConfig } from '@/services/ApiClient';
import { useAuthStore } from '@/stores/authStore';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { applyServerRecords, restoreSnapshot } from './milestoneSnapshots';
import type { MilestoneRecord } from './milestoneModel';

export type MilestoneAction = { kind: 'practice' | 'vision' | 'chart' | 'goal'; sourceEntityId: string; eventId?: string };

/** Called at an approved completion boundary, never from background sync or gallery reads. */
export async function queueMilestoneAction(anchorId: string, action: MilestoneAction, isActive: () => boolean = () => true, onReturn?: () => void): Promise<void> {
  const { user, token, accountRevision } = useAuthStore.getState();
  if (!user?.id || !anchorId || !action.sourceEntityId) return;
  const started = Date.now();
  const isCurrent = () => {
    const current = useAuthStore.getState();
    return isActive() && Date.now() - started < 8000 && current.user?.id === user.id &&
      current.token === token && current.accountRevision === accountRevision;
  };
  try {
    await restoreSnapshot(user.id, anchorId);
    if (!isCurrent()) return;
    const config: AccountBoundRequestConfig = { anchorAuthGuard: isCurrent, anchorAuthToken: token ?? undefined };
    const response = await apiClient.post<{ success: boolean; data: { presentation: {
      presentationId: string; expiresAt: string; record: MilestoneRecord;
    } | null } }>(`/api/v2/anchors/${encodeURIComponent(anchorId)}/milestone-celebration`, action,
      config);
    if (!isCurrent()) return;
    const reservation = response.data?.data?.presentation;
    if (!reservation || reservation.record.anchorId !== anchorId || !reservation.presentationId) return;
    const record = { ...reservation.record, presentationId: reservation.presentationId, presentationExpiresAt: reservation.expiresAt };
    const snapshot = applyServerRecords(user.id, anchorId, [record]);
    const known = snapshot.records.find(r => r.id === record.id);
    if (known) useMilestoneCelebrationStore.getState().enqueueAwards([known], user.id, isActive, onReturn);
  } catch {
    // Awards survive failure; an automatic presentation is optional and never retried elsewhere.
  }
}
