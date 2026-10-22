import type { MilestoneRecord } from './milestoneModel';

/**
 * What is kept on the device for one account's Anchor so Progress works offline: the permanent
 * records last seen, plus celebration receipts that have not reached the server yet. It is a
 * cache of server truth, never a source of it: the server list is merged over it on every read.
 */
export interface MilestoneCacheSnapshot {
  schemaVersion: 1;
  accountId: string;
  anchorId: string;
  records: MilestoneRecord[];
  /** Milestone ids celebrated on this device whose receipt the server has not confirmed. */
  pendingCelebrated: string[];
}

export const milestoneCacheKey = (accountId: string, anchorId: string) =>
  `anchor:v2:milestones:${encodeURIComponent(accountId)}:${encodeURIComponent(anchorId)}`;

const isRecord = (value: unknown): value is MilestoneRecord => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.anchorId === 'string' &&
    typeof v.definitionId === 'string' &&
    typeof v.earnedAt === 'string' &&
    (v.celebratedAt === null || typeof v.celebratedAt === 'string')
  );
};

/** Null for anything unreadable or belonging to another account or Anchor. */
export function parseMilestoneCache(raw: string | null, accountId: string, anchorId: string): MilestoneCacheSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MilestoneCacheSnapshot>;
    if (parsed.schemaVersion !== 1 || parsed.accountId !== accountId || parsed.anchorId !== anchorId) return null;
    return {
      schemaVersion: 1,
      accountId,
      anchorId,
      records: Array.isArray(parsed.records) ? parsed.records.filter(isRecord) : [],
      pendingCelebrated: Array.isArray(parsed.pendingCelebrated)
        ? parsed.pendingCelebrated.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

export const serializeMilestoneCache = (snapshot: MilestoneCacheSnapshot): string => JSON.stringify(snapshot);
