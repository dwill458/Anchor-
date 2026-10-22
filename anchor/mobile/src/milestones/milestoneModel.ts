import { MILESTONE_SPECS, getMilestoneSpec, type MilestoneFamily, type MilestoneSpec } from './registry';

/** One permanent record, exactly as the server returns it. */
export interface MilestoneRecord {
  id: string;
  anchorId: string;
  definitionId: string;
  definitionVersion: number;
  earnedAt: string;
  sourceKind: string;
  sourceEntityId: string | null;
  metadata: unknown;
  /** Null until a celebration finished. A presentation receipt only; never decides ownership. */
  celebratedAt: string | null;
  backfillVersion?: number | null;
  /** Short-lived server reservation; never confers ownership. */
  presentationId?: string;
  presentationExpiresAt?: string;
}

export type MilestoneFilter = 'all' | MilestoneFamily;

export interface MilestoneItem {
  spec: MilestoneSpec;
  state: 'earned' | 'locked';
  /** Present only when earned. */
  record: MilestoneRecord | null;
}

/**
 * Merges the cached record with a fresh server read. The server wins on any shared milestone,
 * but an earned milestone is never dropped because a read happened to omit it (offline cache,
 * stale or partial response): earned stays earned.
 */
export function mergeMilestoneRecords(cached: readonly MilestoneRecord[], server: readonly MilestoneRecord[]): MilestoneRecord[] {
  const byDefinition = new Map<string, MilestoneRecord>();
  for (const record of cached) byDefinition.set(record.definitionId, record);
  for (const record of server) byDefinition.set(record.definitionId, record);
  return [...byDefinition.values()].sort(newestFirst);
}

const time = (iso: string) => {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
};

function newestFirst(a: MilestoneRecord, b: MilestoneRecord): number {
  return time(b.earnedAt) - time(a.earnedAt) || a.definitionId.localeCompare(b.definitionId);
}

/**
 * Earned milestones newest first, then locked ones in definition order. A record whose definition
 * this app version does not know is still earned: it is kept out of the list rather than drawn
 * with invented copy (the app will show it after it updates).
 */
export function buildMilestoneItems(
  records: readonly MilestoneRecord[],
  filter: MilestoneFilter = 'all',
  options: { includeLocked?: boolean } = {},
): MilestoneItem[] {
  const includeLocked = options.includeLocked ?? true;
  const earnedIds = new Set<string>();
  const earned: MilestoneItem[] = [];
  for (const record of [...records].sort(newestFirst)) {
    const spec = getMilestoneSpec(record.definitionId);
    if (!spec || (filter !== 'all' && spec.family !== filter)) continue;
    earnedIds.add(spec.id);
    earned.push({ spec, state: 'earned', record });
  }
  if (!includeLocked) return earned;
  const locked = MILESTONE_SPECS.filter(
    (spec) => !earnedIds.has(spec.id) && (filter === 'all' || spec.family === filter),
  ).map((spec): MilestoneItem => ({ spec, state: 'locked', record: null }));
  return [...earned, ...locked];
}

/** Records the server has not seen celebrated, oldest first so they queue in the order they happened. */
export function uncelebrated(records: readonly MilestoneRecord[]): MilestoneRecord[] {
  return records
    .filter((record) => !record.celebratedAt && getMilestoneSpec(record.definitionId))
    .sort((a, b) => time(a.earnedAt) - time(b.earnedAt) || a.definitionId.localeCompare(b.definitionId));
}
