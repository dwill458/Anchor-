import { apiClient, type AccountBoundRequestConfig } from '@/services/ApiClient';
import { useAuthStore } from '@/stores/authStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { mergeMilestoneRecords, type MilestoneRecord } from './milestoneModel';
import {
  milestoneCacheKey,
  parseMilestoneCache,
  serializeMilestoneCache,
  type MilestoneCacheSnapshot,
} from './milestoneCache';

/**
 * The single in-memory, device-persisted copy of each Anchor's milestone record. The hook, the
 * celebration host and the receipt retry all go through here, so a celebration finishing while
 * Progress is closed (or open) can never race another writer. Server truth is merged over it on
 * every read; nothing here is a source of ownership.
 */
const snapshots = new Map<string, MilestoneCacheSnapshot>();
const listeners = new Set<(key: string) => void>();
const restoring = new Map<string, Promise<MilestoneCacheSnapshot | null>>();

const keyOf = (accountId: string, anchorId: string) => `${accountId}:${anchorId}`;

export function getSnapshot(accountId: string, anchorId: string): MilestoneCacheSnapshot | null {
  return snapshots.get(keyOf(accountId, anchorId)) ?? null;
}

export function subscribeSnapshots(listener: (key: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const snapshotKey = keyOf;

/** Test hook: forget everything held in memory. */
export function resetMilestoneSnapshots(): void {
  snapshots.clear();
  restoring.clear();
}

/** Reads the device cache once per Anchor; an in-memory snapshot (already newer) is returned as is. */
export function restoreSnapshot(accountId: string, anchorId: string): Promise<MilestoneCacheSnapshot | null> {
  const key = keyOf(accountId, anchorId);
  const existing = snapshots.get(key);
  if (existing) return Promise.resolve(existing);
  let pending = restoring.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const raw = await encryptedPersistStorage.getItem(milestoneCacheKey(accountId, anchorId));
        const cached = parseMilestoneCache(raw, accountId, anchorId);
        // Anything written while the read was in flight is newer than the stored copy.
        if (snapshots.has(key)) return snapshots.get(key) ?? null;
        if (cached) snapshots.set(key, cached);
        return cached;
      } catch {
        return snapshots.get(key) ?? null;
      } finally {
        restoring.delete(key);
      }
    })();
    restoring.set(key, pending);
  }
  return pending;
}

/** Synchronous read-modify-write, then persisted and announced. */
export function updateSnapshot(
  accountId: string,
  anchorId: string,
  change: (current: MilestoneCacheSnapshot | null) => MilestoneCacheSnapshot,
): MilestoneCacheSnapshot {
  const key = keyOf(accountId, anchorId);
  const next = change(snapshots.get(key) ?? null);
  snapshots.set(key, next);
  void Promise.resolve(
    encryptedPersistStorage.setItem(milestoneCacheKey(accountId, anchorId), serializeMilestoneCache(next)),
  ).catch(() => undefined);
  listeners.forEach((listener) => listener(key));
  return next;
}

const empty = (accountId: string, anchorId: string): MilestoneCacheSnapshot => ({
  schemaVersion: 1,
  accountId,
  anchorId,
  records: [],
  pendingCelebrated: [],
});

/** Folds a server read into the snapshot. Earned stays earned; a receipt still pending locally stays celebrated. */
export function applyServerRecords(
  accountId: string,
  anchorId: string,
  server: readonly MilestoneRecord[],
  now: Date = new Date(),
): MilestoneCacheSnapshot {
  return updateSnapshot(accountId, anchorId, (current) => {
    const base = current ?? empty(accountId, anchorId);
    const pending = new Set(base.pendingCelebrated);
    const withReservations = server.map(record => {
      const local = base.records.find(r => r.id === record.id);
      return { ...record, presentationId: record.presentationId ?? local?.presentationId,
        presentationExpiresAt: record.presentationExpiresAt ?? local?.presentationExpiresAt };
    });
    const records = mergeMilestoneRecords(base.records, withReservations).map((record) =>
      pending.has(record.id) && !record.celebratedAt ? { ...record, celebratedAt: now.toISOString() } : record,
    );
    return { ...base, records, pendingCelebrated: [...pending] };
  });
}

/** Sends every receipt the server has not confirmed. Stops quietly at the first failure (still offline). */
export async function flushPendingReceipts(accountId: string, anchorId: string): Promise<void> {
  const { user, token, accountRevision } = useAuthStore.getState();
  if (user?.id !== accountId) return;
  const isCurrent = () => {
    const current = useAuthStore.getState();
    return current.user?.id === accountId && current.token === token && current.accountRevision === accountRevision;
  };
  const config: AccountBoundRequestConfig = { anchorAuthGuard: isCurrent, anchorAuthToken: token ?? undefined };
  const pending = [...(getSnapshot(accountId, anchorId)?.pendingCelebrated ?? [])];
  for (const id of pending) {
    if (!isCurrent()) return;
    try {
      const record = getSnapshot(accountId, anchorId)?.records.find(r => r.id === id);
      if (record?.presentationId) {
        await apiClient.post(`/api/v2/milestones/${encodeURIComponent(id)}/celebrated`, { presentationId: record.presentationId }, config);
      } else {
        await apiClient.post(`/api/v2/milestones/${encodeURIComponent(id)}/celebrated`, undefined, config);
      }
    } catch {
      return;
    }
    if (!isCurrent()) return;
    updateSnapshot(accountId, anchorId, (current) => {
      const base = current ?? empty(accountId, anchorId);
      return { ...base, pendingCelebrated: base.pendingCelebrated.filter((pendingId) => pendingId !== id) };
    });
  }
}

/**
 * A celebration finished: stamp the record locally at once (so it can never queue again), keep the
 * receipt for retry, then try to deliver it. Idempotent; never touches what was earned.
 */
export async function settleMilestone(accountId: string, record: MilestoneRecord, now: Date = new Date()): Promise<void> {
  const known = getSnapshot(accountId, record.anchorId)?.records.find((entry) => entry.id === record.id);
  if (known?.celebratedAt) return;
  updateSnapshot(accountId, record.anchorId, (current) => {
    const base = current ?? empty(accountId, record.anchorId);
    const stamped = { ...record, celebratedAt: now.toISOString() };
    const has = base.records.some((entry) => entry.id === record.id);
    return {
      ...base,
      records: has
        ? base.records.map((entry) => (entry.id === record.id ? { ...entry, celebratedAt: stamped.celebratedAt } : entry))
        : mergeMilestoneRecords(base.records, [stamped]),
      pendingCelebrated: base.pendingCelebrated.includes(record.id) ? base.pendingCelebrated : [...base.pendingCelebrated, record.id],
    };
  });
  await flushPendingReceipts(accountId, record.anchorId);
}
