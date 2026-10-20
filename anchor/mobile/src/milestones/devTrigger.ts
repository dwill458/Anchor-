import { MILESTONE_SPECS, type MilestoneSpec } from './registry';
import type { MilestoneRecord } from './milestoneModel';

/**
 * Development only: a synthetic record so any milestone's celebration can be seen on demand.
 * It is queued as a REPLAY (non-awarding): it never reaches the server, the device cache, the
 * receipt retry or the Progress shelf, so testing it cannot create or alter a real milestone.
 */
export const DEV_MILESTONE_ID_PREFIX = 'dev-milestone:';

const SAMPLE_WAYPOINTS = 6;

function sampleMetadata(spec: MilestoneSpec): Record<string, number> {
  const strength = /^strength\./.test(spec.id) ? Number(/Reach (\d+) Thread/.exec(spec.unlock)?.[1]) : NaN;
  if (Number.isFinite(strength)) return { threshold: strength, strength };
  const practices = /^commitment\.practices\.(\d+)$/.exec(spec.id);
  if (practices) return { practices: Number(practices[1]) };
  const minutes = /^commitment\.minutes\.(\d+)$/.exec(spec.id);
  if (minutes) return { minutes: Number(minutes[1]) };
  if (spec.id === 'journey.halfway') return { waypointCount: SAMPLE_WAYPOINTS };
  return {};
}

export function makeDevMilestoneRecord(definitionId: string, anchorId: string, now: Date = new Date()): MilestoneRecord | null {
  const spec = MILESTONE_SPECS.find((entry) => entry.id === definitionId);
  if (!spec) return null;
  return {
    id: `${DEV_MILESTONE_ID_PREFIX}${definitionId}`,
    anchorId,
    definitionId,
    definitionVersion: spec.version,
    earnedAt: now.toISOString(),
    sourceKind: 'DEV_TRIGGER',
    sourceEntityId: null,
    metadata: sampleMetadata(spec),
    // Already "celebrated": nothing about this record may ever look unsettled.
    celebratedAt: now.toISOString(),
  };
}

export const isDevMilestoneRecord = (record: Pick<MilestoneRecord, 'id'>): boolean =>
  record.id.startsWith(DEV_MILESTONE_ID_PREFIX);

/** Short label for the picker chip. */
export const DEV_MILESTONE_LABELS: ReadonlyArray<{ id: string; label: string }> = MILESTONE_SPECS.map((spec) => ({
  id: spec.id,
  label: spec.title,
}));
