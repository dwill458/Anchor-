import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/services/ApiClient';
import { useAuthStore } from '@/stores/authStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { mergeMilestoneRecords, uncelebrated, type MilestoneRecord } from '@/milestones/milestoneModel';
import {
  milestoneCacheKey,
  parseMilestoneCache,
  serializeMilestoneCache,
  type MilestoneCacheSnapshot,
} from '@/milestones/milestoneCache';

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
 * This Anchor's milestones: restored from the device cache at once, then reconciled with the
 * server (which also awards anything earned while offline). Switching Anchors never shows another
 * Anchor's record, and a celebration receipt is kept and retried if the network drops.
 */
export function useAnchorMilestones(anchorId: string | null | undefined): UseAnchorMilestonesResult {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const [records, setRecords] = useState<MilestoneRecord[]>([]);
  const [status, setStatus] = useState<MilestoneStatus>('loading');
  const snapshot = useRef<MilestoneCacheSnapshot | null>(null);
  const scope = useRef('');
  const requestId = useRef(0);

  const persist = useCallback((next: MilestoneCacheSnapshot) => {
    snapshot.current = next;
    void Promise.resolve(
      encryptedPersistStorage.setItem(milestoneCacheKey(next.accountId, next.anchorId), serializeMilestoneCache(next)),
    ).catch(() => undefined);
  }, []);

  const flushReceipts = useCallback(
    async (forScope: string) => {
      const current = snapshot.current;
      if (!current || scope.current !== forScope) return;
      for (const id of [...current.pendingCelebrated]) {
        try {
          await apiClient.post(`/api/v2/milestones/${encodeURIComponent(id)}/celebrated`);
        } catch {
          return; // Still offline: keep the receipt and try on the next read.
        }
        const latest = snapshot.current;
        if (!latest || scope.current !== forScope) return;
        persist({ ...latest, pendingCelebrated: latest.pendingCelebrated.filter((pending) => pending !== id) });
      }
    },
    [persist],
  );

  const refresh = useCallback(async () => {
    if (!anchorId || !accountId) return;
    const forScope = `${accountId}:${anchorId}`;
    const thisRequest = ++requestId.current;
    try {
      const response = await apiClient.get(`/api/v2/anchors/${encodeURIComponent(anchorId)}/milestones`);
      if (requestId.current !== thisRequest || scope.current !== forScope) return;
      const payload = unwrap(response);
      if (!payload) {
        setStatus('error');
        return;
      }
      const cached = snapshot.current;
      const merged = mergeMilestoneRecords(cached?.records ?? [], payload.milestones);
      // A receipt still pending locally stays celebrated even if this read predates it.
      const pending = new Set(cached?.pendingCelebrated ?? []);
      const settled = merged.map((record) =>
        pending.has(record.id) && !record.celebratedAt ? { ...record, celebratedAt: new Date().toISOString() } : record,
      );
      persist({ schemaVersion: 1, accountId, anchorId, records: settled, pendingCelebrated: [...pending] });
      setRecords(settled);
      setStatus('ready');
      void flushReceipts(forScope);
    } catch {
      if (requestId.current !== thisRequest || scope.current !== forScope) return;
      // Keep showing what the device already knows; a failed read removes nothing.
      setStatus(snapshot.current ? 'offline' : 'error');
    }
  }, [accountId, anchorId, flushReceipts, persist]);

  useEffect(() => {
    const forScope = anchorId && accountId ? `${accountId}:${anchorId}` : '';
    scope.current = forScope;
    snapshot.current = null;
    setRecords([]);
    setStatus(forScope ? 'loading' : 'ready');
    if (!anchorId || !accountId) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await encryptedPersistStorage.getItem(milestoneCacheKey(accountId, anchorId));
        const cached = parseMilestoneCache(raw, accountId, anchorId);
        if (cancelled || scope.current !== forScope) return;
        // The cache only seeds the first frame; a server read that landed first is newer.
        if (cached && !snapshot.current) {
          snapshot.current = cached;
          setRecords(mergeMilestoneRecords(cached.records, []));
        }
      } catch {
        // No cache is fine.
      }
      if (!cancelled) void refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, anchorId, refresh]);

  const markCelebrated = useCallback(
    async (milestoneId: string) => {
      const current = snapshot.current;
      if (!current || !anchorId || !accountId) return;
      const target = current.records.find((record) => record.id === milestoneId);
      if (!target || target.celebratedAt) return;
      const stamped = new Date().toISOString();
      const next: MilestoneCacheSnapshot = {
        ...current,
        records: current.records.map((record) => (record.id === milestoneId ? { ...record, celebratedAt: stamped } : record)),
        pendingCelebrated: current.pendingCelebrated.includes(milestoneId)
          ? current.pendingCelebrated
          : [...current.pendingCelebrated, milestoneId],
      };
      persist(next);
      setRecords(next.records);
      await flushReceipts(`${accountId}:${anchorId}`);
    },
    [accountId, anchorId, flushReceipts, persist],
  );

  const pendingCelebrations = useMemo(() => uncelebrated(records), [records]);

  return { records, pendingCelebrations, status, refresh, markCelebrated };
}
