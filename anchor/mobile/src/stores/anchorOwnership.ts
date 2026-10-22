import type { Anchor } from '@/types';

export const GUEST_SCOPE = 'guest';
export const RECOVERY_SCOPE = 'recovery';
const guestIds = new Set(['guest', 'guest-user', 'user-local', 'local-user']);
export const accountScope = (userId: string | null) => userId ? `account:${userId}` : GUEST_SCOPE;

/** Missing and historical placeholder owners are never assigned to a login. */
export function anchorOwnerScope(anchor: Anchor): string {
  if (guestIds.has(anchor.userId)) return GUEST_SCOPE;
  if (!anchor.userId || anchor.userId === 'test-user-123') return RECOVERY_SCOPE;
  return accountScope(anchor.userId);
}

export interface AnchorPartition {
  anchors: Anchor[];
  currentAnchorId?: string;
  primeStreak: number;
  lastPrimedDate: string | null;
  lastSyncedAt: Date | null;
}

export function partitionAnchors(anchors: Anchor[]): Record<string, AnchorPartition> {
  const partitions: Record<string, AnchorPartition> = {};
  for (const anchor of anchors) {
    if (!anchor || typeof anchor.id !== 'string') throw new Error('Anchor vault requires recovery');
    const scope = anchorOwnerScope(anchor);
    const partition = partitions[scope] ??= {
      anchors: [], primeStreak: 0, lastPrimedDate: null, lastSyncedAt: null,
    };
    partition.anchors.push(anchor);
  }
  return partitions;
}
