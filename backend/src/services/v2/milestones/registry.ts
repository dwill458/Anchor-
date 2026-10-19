/**
 * Milestone definitions and the pure rules that decide which are earned.
 *
 * Ids are stable forever (clients key artwork and copy on them). Changing a rule means bumping
 * `version` on that definition; existing awards keep the version they were earned under.
 * Strength thresholds mirror the app's Thread stages (`resolveEvolutionStage`): Building 25,
 * Established 50, Integrated 75, Reinforced 90, plus Full Strength at 100.
 */

export type MilestoneFamily = 'strength' | 'commitment' | 'journey';

export type MilestoneRule =
  | { kind: 'strength'; threshold: number }
  | { kind: 'practices'; count: number }
  | { kind: 'minutes'; minutes: number }
  | { kind: 'firstWaypoint' }
  | { kind: 'halfway' }
  | { kind: 'allWaypoints' }
  | { kind: 'goal' };

export interface MilestoneDefinition {
  id: string;
  family: MilestoneFamily;
  version: number;
  rule: MilestoneRule;
}

export const MILESTONE_DEFINITIONS: readonly MilestoneDefinition[] = [
  { id: 'strength.building', family: 'strength', version: 1, rule: { kind: 'strength', threshold: 25 } },
  { id: 'strength.established', family: 'strength', version: 1, rule: { kind: 'strength', threshold: 50 } },
  { id: 'strength.integrated', family: 'strength', version: 1, rule: { kind: 'strength', threshold: 75 } },
  { id: 'strength.reinforced', family: 'strength', version: 1, rule: { kind: 'strength', threshold: 90 } },
  { id: 'strength.full', family: 'strength', version: 1, rule: { kind: 'strength', threshold: 100 } },

  { id: 'commitment.practices.1', family: 'commitment', version: 1, rule: { kind: 'practices', count: 1 } },
  { id: 'commitment.practices.10', family: 'commitment', version: 1, rule: { kind: 'practices', count: 10 } },
  { id: 'commitment.practices.30', family: 'commitment', version: 1, rule: { kind: 'practices', count: 30 } },
  { id: 'commitment.practices.100', family: 'commitment', version: 1, rule: { kind: 'practices', count: 100 } },
  { id: 'commitment.minutes.100', family: 'commitment', version: 1, rule: { kind: 'minutes', minutes: 100 } },
  { id: 'commitment.minutes.500', family: 'commitment', version: 1, rule: { kind: 'minutes', minutes: 500 } },

  { id: 'journey.waypoint.first', family: 'journey', version: 1, rule: { kind: 'firstWaypoint' } },
  { id: 'journey.halfway', family: 'journey', version: 1, rule: { kind: 'halfway' } },
  { id: 'journey.destination', family: 'journey', version: 1, rule: { kind: 'allWaypoints' } },
  { id: 'journey.goal', family: 'journey', version: 1, rule: { kind: 'goal' } },
];

export const MILESTONE_IDS: ReadonlySet<string> = new Set(MILESTONE_DEFINITIONS.map(d => d.id));

/** Persisted facts for ONE Anchor. Nothing here is client-supplied. */
export interface MilestoneFacts {
  /** Completed practice sessions only. */
  sessions: Array<{ id: string; completedAt: Date; seconds: number }>;
  /** Server-authoritative strength after each session (`ThreadV2Movement.afterStrength`). */
  movements: Array<{ sessionId: string; completedAt: Date; afterStrength: number }>;
  /** Non-deleted Charts for this Anchor. */
  courses: Array<{
    id: string;
    routeScope: string;
    status: string;
    completedAt: Date | null;
    waypoints: Array<{
      id: string;
      reachedAt: Date | null;
      cancelledAt: Date | null;
      skippedAt: Date | null;
      archivedAt: Date | null;
    }>;
  }>;
  /** `Anchor.intentionCompletedAt`: the only authoritative record of a reached goal. */
  intentionCompletedAt: Date | null;
}

export interface MilestoneAward {
  definitionId: string;
  definitionVersion: number;
  earnedAt: Date;
  sourceKind: 'PRACTICE_COMPLETION' | 'COURSE_EVENT' | 'ANCHOR_LIFECYCLE';
  sourceEntityId: string | null;
  metadata: Record<string, number | string>;
}

const byTimeThenId = <T extends { completedAt: Date; id?: string; sessionId?: string }>(a: T, b: T) =>
  a.completedAt.getTime() - b.completedAt.getTime() ||
  (a.id ?? a.sessionId ?? '').localeCompare(b.id ?? b.sessionId ?? '');

const isLive = (w: MilestoneFacts['courses'][number]['waypoints'][number]) =>
  !w.cancelledAt && !w.skippedAt && !w.archivedAt;

function earliest<T extends { at: Date }>(items: T[]): T | null {
  return items.reduce<T | null>((best, item) => (!best || item.at < best.at ? item : best), null);
}

/**
 * The milestones these facts qualify for, each with when it was first earned. Pure and total:
 * the same facts always give the same awards, and awards never depend on current strength
 * (only on the first time a threshold was crossed), so decay cannot revoke anything.
 */
export function evaluateMilestones(facts: MilestoneFacts): MilestoneAward[] {
  const sessions = [...facts.sessions].sort(byTimeThenId);
  const movements = [...facts.movements].sort(byTimeThenId);
  const awards: MilestoneAward[] = [];

  for (const def of MILESTONE_DEFINITIONS) {
    const base = { definitionId: def.id, definitionVersion: def.version };
    const rule = def.rule;

    if (rule.kind === 'strength') {
      const hit = movements.find(m => m.afterStrength >= rule.threshold);
      if (hit) {
        awards.push({
          ...base,
          earnedAt: hit.completedAt,
          sourceKind: 'PRACTICE_COMPLETION',
          sourceEntityId: hit.sessionId,
          metadata: { threshold: rule.threshold, strength: hit.afterStrength },
        });
      }
    } else if (rule.kind === 'practices') {
      const hit = sessions[rule.count - 1];
      if (hit) {
        awards.push({
          ...base,
          earnedAt: hit.completedAt,
          sourceKind: 'PRACTICE_COMPLETION',
          sourceEntityId: hit.id,
          metadata: { practices: rule.count },
        });
      }
    } else if (rule.kind === 'minutes') {
      const needed = rule.minutes * 60;
      let total = 0;
      const hit = sessions.find(s => (total += Math.max(0, s.seconds)) >= needed);
      if (hit) {
        awards.push({
          ...base,
          earnedAt: hit.completedAt,
          sourceKind: 'PRACTICE_COMPLETION',
          sourceEntityId: hit.id,
          metadata: { minutes: rule.minutes },
        });
      }
    } else if (rule.kind === 'firstWaypoint') {
      const hit = earliest(
        facts.courses.flatMap(c =>
          c.waypoints.filter(w => w.reachedAt).map(w => ({ at: w.reachedAt as Date, id: w.id }))
        )
      );
      if (hit) {
        awards.push({ ...base, earnedAt: hit.at, sourceKind: 'COURSE_EVENT', sourceEntityId: hit.id, metadata: {} });
      }
    } else if (rule.kind === 'halfway') {
      const hits = facts.courses
        .filter(c => c.routeScope !== 'NEXT_STRETCH')
        .flatMap(c => {
          const live = c.waypoints.filter(isLive);
          if (live.length < 2) return [];
          const reached = live
            .filter(w => w.reachedAt)
            .sort((a, b) => (a.reachedAt as Date).getTime() - (b.reachedAt as Date).getTime());
          const needed = Math.ceil(live.length / 2);
          const at = reached[needed - 1]?.reachedAt;
          return at ? [{ at, id: c.id, total: live.length }] : [];
        });
      const hit = earliest(hits);
      if (hit) {
        awards.push({
          ...base,
          earnedAt: hit.at,
          sourceKind: 'COURSE_EVENT',
          sourceEntityId: hit.id,
          metadata: { waypointCount: hit.total },
        });
      }
    } else if (rule.kind === 'allWaypoints') {
      const hit = earliest(
        facts.courses
          .filter(c => c.status === 'COMPLETED' && c.routeScope !== 'NEXT_STRETCH' && c.completedAt)
          .map(c => ({ at: c.completedAt as Date, id: c.id }))
      );
      if (hit) {
        awards.push({ ...base, earnedAt: hit.at, sourceKind: 'COURSE_EVENT', sourceEntityId: hit.id, metadata: {} });
      }
    } else if (rule.kind === 'goal') {
      if (facts.intentionCompletedAt) {
        awards.push({
          ...base,
          earnedAt: facts.intentionCompletedAt,
          sourceKind: 'ANCHOR_LIFECYCLE',
          sourceEntityId: null,
          metadata: {},
        });
      }
    }
  }
  return awards;
}
