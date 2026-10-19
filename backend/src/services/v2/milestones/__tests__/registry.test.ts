import { MILESTONE_DEFINITIONS, MILESTONE_IDS, evaluateMilestones, type MilestoneFacts } from '../registry';

const d = (iso: string) => new Date(iso);
const empty = (): MilestoneFacts => ({ sessions: [], movements: [], courses: [], intentionCompletedAt: null });
const ids = (facts: MilestoneFacts) => evaluateMilestones(facts).map(a => a.definitionId);
const award = (facts: MilestoneFacts, id: string) => evaluateMilestones(facts).find(a => a.definitionId === id);

const sessionsOf = (count: number, seconds = 60) =>
  Array.from({ length: count }, (_, i) => ({
    id: `s${String(i + 1).padStart(3, '0')}`,
    completedAt: new Date(Date.UTC(2026, 8, 1 + i, 12)),
    seconds,
  }));

describe('milestone definitions', () => {
  it('has unique, stable ids across the three families', () => {
    expect(MILESTONE_IDS.size).toBe(MILESTONE_DEFINITIONS.length);
    expect(new Set(MILESTONE_DEFINITIONS.map(m => m.family))).toEqual(new Set(['strength', 'commitment', 'journey']));
  });

  it('uses the app Thread stage thresholds, not the mockup example levels', () => {
    const thresholds = MILESTONE_DEFINITIONS.filter(m => m.rule.kind === 'strength').map(m =>
      m.rule.kind === 'strength' ? m.rule.threshold : 0
    );
    expect(thresholds).toEqual([25, 50, 75, 90, 100]);
  });
});

describe('evaluateMilestones', () => {
  it('awards nothing with no history', () => {
    expect(evaluateMilestones(empty())).toEqual([]);
  });

  describe('strength', () => {
    const movements = [
      { sessionId: 'a', completedAt: d('2026-09-01T10:00:00Z'), afterStrength: 20 },
      { sessionId: 'b', completedAt: d('2026-09-02T10:00:00Z'), afterStrength: 52 },
      { sessionId: 'c', completedAt: d('2026-09-10T10:00:00Z'), afterStrength: 30 },
    ];

    it('awards every threshold first crossed, dated by the session that crossed it', () => {
      const facts = { ...empty(), movements };
      expect(ids(facts).filter(id => id.startsWith('strength.'))).toEqual(['strength.building', 'strength.established']);
      expect(award(facts, 'strength.established')).toMatchObject({
        earnedAt: d('2026-09-02T10:00:00Z'),
        sourceEntityId: 'b',
        sourceKind: 'PRACTICE_COMPLETION',
      });
    });

    it('keeps a milestone after strength decays below it', () => {
      // The last movement is 30, below Established (50); the award still stands.
      expect(ids({ ...empty(), movements })).toContain('strength.established');
    });

    it('does not award a level that was never reached', () => {
      expect(ids({ ...empty(), movements })).not.toContain('strength.integrated');
    });

    it('is order independent', () => {
      const shuffled = { ...empty(), movements: [movements[2], movements[0], movements[1]] };
      expect(evaluateMilestones(shuffled)).toEqual(evaluateMilestones({ ...empty(), movements }));
    });
  });

  describe('commitment', () => {
    it('awards the first practice on the first completed session', () => {
      const facts = { ...empty(), sessions: sessionsOf(1) };
      expect(ids(facts)).toEqual(['commitment.practices.1']);
      expect(award(facts, 'commitment.practices.1')?.earnedAt).toEqual(d('2026-09-01T12:00:00Z'));
    });

    it('awards 10 / 30 / 100 on exactly the Nth session', () => {
      expect(ids({ ...empty(), sessions: sessionsOf(9) })).not.toContain('commitment.practices.10');
      const ten = { ...empty(), sessions: sessionsOf(10) };
      expect(award(ten, 'commitment.practices.10')?.sourceEntityId).toBe('s010');
      expect(ids({ ...empty(), sessions: sessionsOf(29) })).not.toContain('commitment.practices.30');
      expect(ids({ ...empty(), sessions: sessionsOf(30) })).toContain('commitment.practices.30');
      expect(ids({ ...empty(), sessions: sessionsOf(99) })).not.toContain('commitment.practices.100');
      expect(ids({ ...empty(), sessions: sessionsOf(100) })).toContain('commitment.practices.100');
    });

    it('awards cumulative minutes on the session that crosses the line', () => {
      // 10 sessions of 600s = 100 minutes exactly.
      const facts = { ...empty(), sessions: sessionsOf(10, 600) };
      expect(award(facts, 'commitment.minutes.100')?.sourceEntityId).toBe('s010');
      expect(ids({ ...empty(), sessions: sessionsOf(10, 599) })).not.toContain('commitment.minutes.100');
      expect(ids(facts)).not.toContain('commitment.minutes.500');
    });

    it('ignores negative durations instead of subtracting from the total', () => {
      const sessions = [...sessionsOf(10, 600), { id: 'bad', completedAt: d('2026-09-30T00:00:00Z'), seconds: -99999 }];
      expect(ids({ ...empty(), sessions })).toContain('commitment.minutes.100');
    });

    it('does not depend on consecutive days', () => {
      const sessions = [
        { id: 'a', completedAt: d('2026-01-01T00:00:00Z'), seconds: 60 },
        { id: 'b', completedAt: d('2026-06-01T00:00:00Z'), seconds: 60 },
      ];
      expect(ids({ ...empty(), sessions })).toEqual(['commitment.practices.1']);
    });
  });

  describe('journey', () => {
    const wp = (id: string, reachedAt: string | null, extra: Partial<MilestoneFacts['courses'][0]['waypoints'][0]> = {}) => ({
      id,
      reachedAt: reachedAt ? d(reachedAt) : null,
      cancelledAt: null,
      skippedAt: null,
      archivedAt: null,
      ...extra,
    });
    const course = (waypoints: ReturnType<typeof wp>[], extra: Partial<MilestoneFacts['courses'][0]> = {}) => ({
      id: 'course-1',
      routeScope: 'DESTINATION',
      status: 'ACTIVE',
      completedAt: null,
      waypoints,
      ...extra,
    });

    it('awards nothing for an opened but untouched Chart', () => {
      const facts = { ...empty(), courses: [course([wp('1', null), wp('2', null), wp('3', null), wp('4', null)])] };
      expect(evaluateMilestones(facts)).toEqual([]);
    });

    it('awards the first waypoint on the earliest reach', () => {
      const facts = { ...empty(), courses: [course([wp('1', '2026-09-05T00:00:00Z'), wp('2', '2026-09-03T00:00:00Z'), wp('3', null), wp('4', null)])] };
      expect(award(facts, 'journey.waypoint.first')).toMatchObject({ earnedAt: d('2026-09-03T00:00:00Z'), sourceEntityId: '2' });
    });

    it('awards halfway when ceil(n/2) live waypoints are reached, dated by that reach', () => {
      const facts = { ...empty(), courses: [course([wp('1', '2026-09-01T00:00:00Z'), wp('2', '2026-09-04T00:00:00Z'), wp('3', null), wp('4', null)])] };
      expect(award(facts, 'journey.halfway')?.earnedAt).toEqual(d('2026-09-04T00:00:00Z'));
      const short = { ...empty(), courses: [course([wp('1', '2026-09-01T00:00:00Z'), wp('2', null), wp('3', null), wp('4', null)])] };
      expect(ids(short)).not.toContain('journey.halfway');
    });

    it('does not count skipped or cancelled waypoints toward the total', () => {
      const facts = {
        ...empty(),
        courses: [course([wp('1', '2026-09-01T00:00:00Z'), wp('2', null), wp('3', null, { skippedAt: d('2026-09-02T00:00:00Z') }), wp('4', null, { cancelledAt: d('2026-09-02T00:00:00Z') })])],
      };
      // Live total is 2, so one reach is halfway.
      expect(ids(facts)).toContain('journey.halfway');
    });

    it('needs at least two live waypoints for a halfway', () => {
      expect(ids({ ...empty(), courses: [course([wp('1', '2026-09-01T00:00:00Z')])] })).not.toContain('journey.halfway');
    });

    it('awards the destination only for a COMPLETED, non-stretch course', () => {
      const done = course([wp('1', '2026-09-01T00:00:00Z'), wp('2', '2026-09-02T00:00:00Z')], { status: 'COMPLETED', completedAt: d('2026-09-02T00:00:00Z') });
      expect(award({ ...empty(), courses: [done] }, 'journey.destination')?.earnedAt).toEqual(d('2026-09-02T00:00:00Z'));
      expect(ids({ ...empty(), courses: [{ ...done, routeScope: 'NEXT_STRETCH' }] })).not.toContain('journey.destination');
      expect(ids({ ...empty(), courses: [{ ...done, status: 'ACTIVE', completedAt: null }] })).not.toContain('journey.destination');
    });

    it('does not infer goal completion from a finished Chart', () => {
      const done = course([wp('1', '2026-09-01T00:00:00Z'), wp('2', '2026-09-02T00:00:00Z')], { status: 'COMPLETED', completedAt: d('2026-09-02T00:00:00Z') });
      expect(ids({ ...empty(), courses: [done] })).not.toContain('journey.goal');
    });

    it('awards the goal only from the explicit intention completion record', () => {
      const facts = { ...empty(), intentionCompletedAt: d('2026-10-01T00:00:00Z') };
      expect(award(facts, 'journey.goal')).toMatchObject({ earnedAt: d('2026-10-01T00:00:00Z'), sourceKind: 'ANCHOR_LIFECYCLE' });
    });
  });

  it('is deterministic: the same facts give the same awards', () => {
    const facts = { ...empty(), sessions: sessionsOf(12, 600), movements: [{ sessionId: 's001', completedAt: d('2026-09-01T12:00:00Z'), afterStrength: 60 }] };
    expect(evaluateMilestones(facts)).toEqual(evaluateMilestones(facts));
  });
});
