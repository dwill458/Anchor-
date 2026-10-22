import { isRoutineEvent, mergeMilestoneEvents } from '../milestoneEvents';
import type { V2ThreadEventItem } from '../types';
import type { MilestoneRecord } from '@/milestones/milestoneModel';

const event = (over: Partial<V2ThreadEventItem>): V2ThreadEventItem => ({
  id: 'e',
  type: 'ANCHOR_CREATED',
  title: 't',
  copy: 'c',
  why: 'w',
  significance: 'MEDIUM',
  occurredAt: '2026-09-01T00:00:00.000Z',
  formattedDate: 'Sep 1',
  authoritativeDelta: null,
  authoritativeThreadRange: null,
  sourceDomain: 'ANCHOR_LIFECYCLE',
  ...over,
});

const record = (id: string, definitionId: string, earnedAt: string): MilestoneRecord => ({
  id,
  anchorId: 'a1',
  definitionId,
  definitionVersion: 1,
  earnedAt,
  sourceKind: 'PRACTICE_COMPLETION',
  sourceEntityId: null,
  metadata: {},
  celebratedAt: null,
});

describe('isRoutineEvent', () => {
  it('treats repeated practice and route tweaks as routine', () => {
    expect(isRoutineEvent(event({ type: 'PRACTICE_COMPLETED' }))).toBe(true);
    expect(isRoutineEvent(event({ type: 'ROUTE_ADJUSTED' }))).toBe(true);
  });

  it('keeps a Move routine only when it carries none of the user’s own words', () => {
    expect(isRoutineEvent(event({ type: 'ONE_MOVE_COMPLETED', note: null }))).toBe(true);
    expect(isRoutineEvent(event({ type: 'ONE_MOVE_COMPLETED', note: 'Sent the proposal' }))).toBe(false);
  });

  it('treats the moments that matter as meaningful', () => {
    for (const type of ['ANCHOR_CREATED', 'EVOLUTION_STAGE_REACHED', 'FULL_STRENGTH_REACHED', 'MILESTONE_EARNED', 'WAYPOINT_REACHED', 'DESTINATION_REACHED', 'ANCHOR_COMPLETED'] as const) {
      expect(isRoutineEvent(event({ type }))).toBe(false);
    }
  });
});

describe('mergeMilestoneEvents', () => {
  it('adds a milestone event dated by when it was truly earned, with the milestone to open', () => {
    const merged = mergeMilestoneEvents([event({ id: 'created' })], [record('m1', 'commitment.practices.1', '2026-09-05T10:00:00.000Z')]);
    expect(merged.map((e) => e.id)).toEqual(['evt-milestone-m1', 'created']);
    expect(merged[0]).toMatchObject({
      type: 'MILESTONE_EARNED',
      title: 'First Practice',
      copy: 'Milestone earned · Commitment',
      occurredAt: '2026-09-05T10:00:00.000Z',
      milestoneDefinitionId: 'commitment.practices.1',
      sourceDomain: 'MILESTONE',
    });
  });

  it('folds a derived stage event into the server milestone, which has the real date', () => {
    const derived = event({ id: 'stage', type: 'EVOLUTION_STAGE_REACHED', stageName: 'Established', occurredAt: '' });
    const merged = mergeMilestoneEvents([derived], [record('m1', 'strength.established', '2026-09-10T00:00:00.000Z')]);
    expect(merged.map((e) => e.id)).toEqual(['evt-milestone-m1']);
  });

  it('keeps a derived stage event when no milestone record covers it', () => {
    const derived = event({ id: 'stage', type: 'EVOLUTION_STAGE_REACHED', stageName: 'Established' });
    expect(mergeMilestoneEvents([derived], []).map((e) => e.id)).toEqual(['stage']);
    expect(mergeMilestoneEvents([derived], [record('m1', 'strength.building', '2026-09-10T00:00:00.000Z')]).map((e) => e.id)).toContain('stage');
  });

  it('folds Full Strength and the 10th practice into their milestones only', () => {
    const full = event({ id: 'full', type: 'FULL_STRENGTH_REACHED' });
    const ten = event({ id: 'ten', type: 'PRACTICE_MILESTONE_REACHED', milestoneCount: 10 });
    const twentyFive = event({ id: 'tf', type: 'PRACTICE_MILESTONE_REACHED', milestoneCount: 25 });
    const merged = mergeMilestoneEvents(
      [full, ten, twentyFive],
      [record('a', 'strength.full', '2026-09-01T00:00:00.000Z'), record('b', 'commitment.practices.10', '2026-09-02T00:00:00.000Z')],
    );
    expect(merged.map((e) => e.id).sort()).toEqual(['evt-milestone-a', 'evt-milestone-b', 'tf']);
  });

  it('never deletes other history: practices, waypoints and undated events survive in order', () => {
    const events = [
      event({ id: 'wp', type: 'WAYPOINT_REACHED', occurredAt: '2026-09-20T00:00:00.000Z' }),
      event({ id: 'practice', type: 'PRACTICE_COMPLETED', occurredAt: '2026-09-03T00:00:00.000Z' }),
      event({ id: 'undated', type: 'EVOLUTION_STAGE_REACHED', stageName: 'Building', occurredAt: '' }),
    ];
    const merged = mergeMilestoneEvents(events, [record('m', 'commitment.practices.1', '2026-09-03T12:00:00.000Z')]);
    expect(merged.map((e) => e.id)).toEqual(['wp', 'evt-milestone-m', 'practice', 'undated']);
  });

  it('ignores records this app version cannot describe, or with no real date', () => {
    expect(
      mergeMilestoneEvents([], [record('x', 'future.unknown', '2026-09-01T00:00:00.000Z'), record('y', 'strength.building', 'not-a-date')]),
    ).toEqual([]);
  });

  it('with no records returns the history unchanged', () => {
    const events = [event({ id: 'a' }), event({ id: 'b', occurredAt: '2026-08-01T00:00:00.000Z' })];
    expect(mergeMilestoneEvents(events, []).map((e) => e.id)).toEqual(['a', 'b']);
  });
});
