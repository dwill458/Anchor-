import { belongsToAction, featureMilestone, milestoneActionKey, type MilestoneAction } from '../celebrationPolicy';

const practice: MilestoneAction = { kind: 'practice', sourceEntityId: 'session-10' };
const record = (definitionId: string, sourceKind = 'PRACTICE_COMPLETION', sourceEntityId: string | null = 'session-10') => ({
  definitionId, sourceKind, sourceEntityId,
});

describe('automatic milestone selection', () => {
  it('features only one of several awards from a practice, preferring direct commitment over Strength', () => {
    const records = [record('strength.full'), record('commitment.practices.10')];
    expect(featureMilestone(records, practice)).toBe(records[1]);
    expect(records).toHaveLength(2); // Featuring never consumes or removes the other awards.
  });

  it('is deterministic regardless of database return order and leaves input unchanged', () => {
    const records = [record('strength.building'), record('strength.full'), record('strength.integrated')];
    const original = [...records];
    expect(featureMilestone(records, practice)?.definitionId).toBe('strength.full');
    expect(featureMilestone([...records].reverse(), practice)?.definitionId).toBe('strength.full');
    expect(records).toEqual(original);
  });

  it('prioritizes qualifying Visualize accomplishments for a Visualize practice', () => {
    const records = [record('commitment.practices.100'), record('vision.visualize.10'), record('vision.visualize.30')];
    expect(featureMilestone(records, practice, true)?.definitionId).toBe('vision.visualize.30');
    expect(featureMilestone(records, practice, false)?.definitionId).toBe('commitment.practices.100');
  });

  it('prefers the completed board over the first committed Vision', () => {
    const records = [record('vision.first', 'VISION_COMMIT', 'v1'), record('vision.board.complete', 'VISION_COMMIT', 'v1')];
    expect(featureMilestone(records, { kind: 'vision', sourceEntityId: 'v1' })?.definitionId).toBe('vision.board.complete');
  });

  it('features Goal Reached over All Waypoints when both qualify at the boundary', () => {
    const records = [record('journey.destination', 'COURSE_EVENT', 'c1'), record('journey.goal', 'ANCHOR_LIFECYCLE', null)];
    expect(featureMilestone(records, { kind: 'chart', sourceEntityId: 'c1' })?.definitionId).toBe('journey.goal');
  });

  it('selects the highest directly relevant historical practice award for the welcome-back candidate', () => {
    const records = [
      ...['strength.building', 'strength.established', 'strength.integrated', 'strength.reinforced', 'strength.full'],
      ...['commitment.practices.1', 'commitment.practices.10', 'commitment.practices.30', 'journey.waypoint.first', 'vision.first'],
    ].map(id => record(id));
    expect(records).toHaveLength(10);
    expect(featureMilestone(records, practice)?.definitionId).toBe('commitment.practices.30');
  });

  it('returns no candidate for empty or unknown-only awards', () => {
    expect(featureMilestone([], practice)).toBeNull();
    expect(featureMilestone([record('future.unsupported')], practice)).toBeNull();
  });

  it('never prefers unknown metadata over a known definition', () => {
    expect(featureMilestone([record('future.unsupported'), record('strength.building')], practice)?.definitionId).toBe('strength.building');
  });
});

describe('authoritative event association', () => {
  it('keys Chart retries by the reached waypoint while allowing distinct later waypoint actions', () => {
    const first: MilestoneAction = { kind: 'chart', sourceEntityId: 'course-1', eventId: 'waypoint-1' };
    expect(milestoneActionKey(first)).toBe(milestoneActionKey({ ...first }));
    expect(milestoneActionKey(first)).not.toBe(milestoneActionKey({ ...first, eventId: 'waypoint-2' }));
  });

  it('requires the exact server session for practice eligibility', () => {
    expect(belongsToAction(record('strength.building'), practice)).toBe(true);
    expect(belongsToAction(record('strength.building', 'PRACTICE_COMPLETION', 'other-session'), practice)).toBe(false);
    expect(belongsToAction(record('vision.first', 'VISION_COMMIT', 'session-10'), practice)).toBe(false);
  });

  it('keeps Vision commits separate from Visualize completion evidence', () => {
    const action: MilestoneAction = { kind: 'vision', sourceEntityId: 'v1' };
    expect(belongsToAction(record('vision.first', 'VISION_COMMIT', 'v1'), action)).toBe(true);
    expect(belongsToAction(record('vision.first', 'VISION_COMMIT', 'v2'), action)).toBe(false);
    expect(belongsToAction(record('vision.visualize.1', 'PRACTICE_COMPLETION', 'v1'), action)).toBe(false);
  });

  it('requires persisted lifecycle evidence for a goal and course evidence for Chart', () => {
    const goal: MilestoneAction = { kind: 'goal', sourceEntityId: 'anchor-1' };
    const chart: MilestoneAction = { kind: 'chart', sourceEntityId: 'course-1' };
    expect(belongsToAction(record('journey.goal', 'ANCHOR_LIFECYCLE', null), goal)).toBe(true);
    expect(belongsToAction(record('journey.destination', 'COURSE_EVENT', 'course-1'), goal)).toBe(false);
    expect(belongsToAction(record('journey.waypoint.first', 'COURSE_EVENT', 'waypoint-1'), chart)).toBe(true);
    expect(belongsToAction(record('commitment.practices.1'), chart)).toBe(false);
  });
});
