import { FAMILY_LABEL, getMilestoneSpec } from '@/milestones/registry';
import type { MilestoneRecord } from '@/milestones/milestoneModel';
import type { V2ThreadEventItem } from './types';

const STAGE_MILESTONE: Record<string, string> = {
  Building: 'strength.building',
  Established: 'strength.established',
  Integrated: 'strength.integrated',
  Reinforced: 'strength.reinforced',
};

const PRACTICE_MILESTONE: Record<number, string> = {
  1: 'commitment.practices.1',
  10: 'commitment.practices.10',
  30: 'commitment.practices.30',
  100: 'commitment.practices.100',
};

const time = (iso: string) => {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
};

/**
 * Routine entries: the repeated rows (every practice, every route tweak, a Move with no words of
 * its own). They stay in the log and are one tap away, but do not fill its first view.
 */
export function isRoutineEvent(event: V2ThreadEventItem): boolean {
  if (event.type === 'PRACTICE_COMPLETED' || event.type === 'ROUTE_ADJUSTED') return true;
  return event.type === 'ONE_MOVE_COMPLETED' && !event.note;
}

/** The milestone definition a derived event restates, if any. Those are replaced by the server's record. */
function supersededBy(event: V2ThreadEventItem): string | null {
  if (event.type === 'EVOLUTION_STAGE_REACHED') return (event.stageName && STAGE_MILESTONE[event.stageName]) || null;
  if (event.type === 'FULL_STRENGTH_REACHED') return 'strength.full';
  if (event.type === 'PRACTICE_MILESTONE_REACHED') return (event.milestoneCount && PRACTICE_MILESTONE[event.milestoneCount]) || null;
  return null;
}

/**
 * Adds a "milestone earned" event for each permanent milestone record, dated by when it was truly
 * earned. A derived event that only restated the same fact (a Thread stage, Full Strength, the Nth
 * practice) is folded into it, since the server date is the authoritative one. Everything else,
 * and every derived event with no matching record, is kept untouched: nothing in the history is
 * deleted or rewritten, only de-duplicated for display.
 */
export function mergeMilestoneEvents(
  events: readonly V2ThreadEventItem[],
  records: readonly MilestoneRecord[],
): V2ThreadEventItem[] {
  const earned = new Set<string>();
  const added: V2ThreadEventItem[] = [];
  for (const record of records) {
    const spec = getMilestoneSpec(record.definitionId);
    if (!spec || Number.isNaN(Date.parse(record.earnedAt))) continue;
    earned.add(spec.id);
    const at = new Date(record.earnedAt);
    added.push({
      id: `evt-milestone-${record.id}`,
      type: 'MILESTONE_EARNED',
      title: spec.title,
      copy: `Milestone earned · ${FAMILY_LABEL[spec.family]}`,
      why: spec.unlock,
      significance: spec.celebration.level >= 4 ? 'MAJOR' : 'HIGH',
      occurredAt: record.earnedAt,
      formattedDate: at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      formattedTime: at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      authoritativeDelta: null,
      authoritativeThreadRange: null,
      sourceDomain: 'MILESTONE',
      milestoneDefinitionId: spec.id,
      rawDomainEventId: record.id,
    });
  }
  const kept = events.filter((event) => {
    const replacedBy = supersededBy(event);
    return !(replacedBy && earned.has(replacedBy));
  });
  // Newest first; events with no known date stay after every dated one, in their original order.
  return [...kept, ...added].sort((a, b) => {
    const ta = time(a.occurredAt);
    const tb = time(b.occurredAt);
    return ta === tb ? 0 : tb - ta;
  });
}
