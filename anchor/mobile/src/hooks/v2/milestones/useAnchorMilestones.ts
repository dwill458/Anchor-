import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient, type AccountBoundRequestConfig } from '@/services/ApiClient';
import { useAuthStore } from '@/stores/authStore';
import { uncelebrated, type MilestoneRecord } from '@/milestones/milestoneModel';
import {
  applyServerRecords,
  flushPendingReceipts,
  getSnapshot,
  restoreSnapshot,
  settleMilestone,
  snapshotKey,
  subscribeSnapshots,
} from '@/milestones/milestoneSnapshots';

export type MilestoneStatus = 'loading' | 'ready' | 'offline' | 'error';

export interface UseAnchorMilestonesResult {
  /** The permanent record, newest first. Earned milestones are never removed by a failed read. */
  records: MilestoneRecord[];
  /** Earned but not yet celebrated, oldest first: the queue for the celebration layer. */
  pendingCelebrations: MilestoneRecord[];
  status: MilestoneStatus;
  refresh: () => Promise<void>;
  /** Presentation receipt after a celebration finishes. Local first, retried until the server confirms. */
  markCelebrated: (milestoneId: string) => Promise<void>;
}

interface ServerPayload {
  milestones: MilestoneRecord[];
  created: MilestoneRecord[];
}

const unwrap = (response?: { data?: unknown } | null): ServerPayload | null => {
  const body = response?.data as { success?: boolean; data?: ServerPayload } | undefined;
  const data = body && typeof body === 'object' && 'data' in body ? body.data : (body as unknown as ServerPayload | undefined);
  return data && Array.isArray(data.milestones) ? data : null;
};

/**
 * This Anchor's milestones: restored from the device snapshot at once, then reconciled with the
 * server (which also awards anything earned while offline). The snapshot is shared with the
 * celebration host, so a celebration finishing anywhere updates every mounted reader.
 */
export function useAnchorMilestones(anchorId: string | null | undefined): UseAnchorMilestonesResult {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const token = useAuthStore((state) => state.token);
  const accountRevision = useAuthStore((state) => state.accountRevision);
  const [records, setRecords] = useState<MilestoneRecord[]>([]);
  const [status, setStatus] = useState<MilestoneStatus>('loading');
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!anchorId || !accountId) return;
    const thisRequest = ++requestId.current;
    const isCurrent = () => {
      const current = useAuthStore.getState();
      return requestId.current === thisRequest && current.user?.id === accountId &&
        current.token === token && current.accountRevision === accountRevision;
    };
    try {
      const config: AccountBoundRequestConfig = { anchorAuthGuard: isCurrent, anchorAuthToken: token ?? undefined };
      const response = await apiClient.get(`/api/v2/anchors/${encodeURIComponent(anchorId)}/milestones`, config);
      if (!isCurrent()) return;
      const payload = unwrap(response);
      if (!payload) {
        setStatus('error');
        return;
      }
      applyServerRecords(accountId, anchorId, payload.milestones);
      setStatus('ready');
      void flushPendingReceipts(accountId, anchorId);
    } catch {
      if (!isCurrent()) return;
      // Keep showing what the device already knows; a failed read removes nothing.
      setStatus(getSnapshot(accountId, anchorId) ? 'offline' : 'error');
    }
  }, [accountId, anchorId, token, accountRevision]);

  useEffect(() => {
    setRecords([]);
    if (!anchorId || !accountId) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    const key = snapshotKey(accountId, anchorId);
    const unsubscribe = subscribeSnapshots((changed) => {
      if (changed === key) setRecords(getSnapshot(accountId, anchorId)?.records ?? []);
    });
    let cancelled = false;
    void (async () => {
      const cached = await restoreSnapshot(accountId, anchorId);
      if (cancelled) return;
      if (cached) setRecords(cached.records);
      await refresh();
    })();
    return () => {
      cancelled = true;
      ++requestId.current;
      unsubscribe();
    };
  }, [accountId, anchorId, refresh]);

  const markCelebrated = useCallback(
    async (milestoneId: string) => {
      if (!accountId || !anchorId) return;
      const record = getSnapshot(accountId, anchorId)?.records.find((entry) => entry.id === milestoneId);
      if (record) await settleMilestone(accountId, record);
    },
    [accountId, anchorId],
  );

  const pendingCelebrations = useMemo(() => uncelebrated(records).filter(record =>
    record.presentationId && Date.parse(record.presentationExpiresAt ?? '') > Date.now()), [records]);

  return { records, pendingCelebrations, status, refresh, markCelebrated };
}
