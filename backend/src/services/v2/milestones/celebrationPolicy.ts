import { MILESTONE_DEFINITIONS } from './registry';

export const RECONCILIATION_VERSION = 1;
export const ACTION_WINDOW_MS = 2 * 60 * 1000;
export type MilestoneAction = {
  kind: 'practice' | 'vision' | 'chart' | 'goal';
  sourceEntityId: string;
  eventId?: string;
};

export const milestoneActionKey = (action: MilestoneAction) =>
  `${action.kind}:${action.sourceEntityId}${action.kind === 'chart' && action.eventId ? `:${action.eventId}` : ''}`;

type Candidate = { definitionId: string; sourceKind: string; sourceEntityId: string | null };

/** Stable direct-event priority, then highest threshold; lexical ID is the final tie break. */
export function featureMilestone<T extends Candidate>(
  records: readonly T[],
  action: MilestoneAction,
  visualize = false
): T | null {
  const score = (record: T) => {
    const definition = MILESTONE_DEFINITIONS.find(d => d.id === record.definitionId);
    if (!definition) return -1;
    const direct =
      action.kind === 'practice'
        ? visualize
          ? 'vision'
          : 'commitment'
        : action.kind === 'vision'
          ? 'vision'
          : 'journey';
    const rule = definition.rule;
    const tier =
      'threshold' in rule
        ? rule.threshold
        : 'count' in rule
          ? rule.count
          : 'minutes' in rule
            ? rule.minutes
            : rule.kind === 'goal'
              ? 1000
              : rule.kind === 'allWaypoints'
                ? 100
                : rule.kind === 'halfway'
                  ? 50
                  : rule.kind === 'visionBoard'
                    ? 8
                    : 1;
    return (definition.family === direct ? 10000 : 0) + tier;
  };
  return (
    [...records]
      .filter(r => score(r) >= 0)
      .sort((a, b) => score(b) - score(a) || a.definitionId.localeCompare(b.definitionId))[0] ??
    null
  );
}

export function belongsToAction(award: Candidate, action: MilestoneAction): boolean {
  if (action.kind === 'practice')
    return (
      award.sourceKind === 'PRACTICE_COMPLETION' && award.sourceEntityId === action.sourceEntityId
    );
  if (action.kind === 'vision')
    return award.sourceKind === 'VISION_COMMIT' && award.sourceEntityId === action.sourceEntityId;
  if (action.kind === 'goal') return award.sourceKind === 'ANCHOR_LIFECYCLE';
  return award.sourceKind === 'COURSE_EVENT';
}
