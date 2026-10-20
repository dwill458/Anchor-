import { apiClient } from '@/services/ApiClient';
import { useAuthStore } from '@/stores/authStore';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { applyServerRecords, flushPendingReceipts, restoreSnapshot } from './milestoneSnapshots';
import type { MilestoneRecord } from './milestoneModel';

/** Called only when the saved board has arrived. A read reconciles persisted facts; no client awards. */
export async function queueVisionMilestones(anchorId: string): Promise<void> {
  const { user, accountRevision, token } = useAuthStore.getState();
  if (!user?.id || !anchorId) return;
  const isCurrent = () => {
    const current = useAuthStore.getState();
    return current.user?.id === user.id && current.accountRevision === accountRevision && current.token === token;
  };
  try {
    await restoreSnapshot(user.id, anchorId);
    if (!isCurrent()) return;
    const response = await apiClient.get<{ success: boolean; data: { milestones: MilestoneRecord[] } }>(`/api/v2/anchors/${encodeURIComponent(anchorId)}/milestones`);
    if (!isCurrent()) return;
    const records = response.data?.data?.milestones;
    if (!Array.isArray(records)) return;
    const snapshot = applyServerRecords(user.id, anchorId, records);
    useMilestoneCelebrationStore.getState().enqueueAwards(snapshot.records.filter(record => record.definitionId.startsWith('vision.')), user.id);
    void flushPendingReceipts(user.id, anchorId);
  } catch {
    // Offline: the server receipt remains pending and Progress reconciles it on the next read.
  }
}
