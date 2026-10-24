import { composeWeeklyRecap, RecapSource, WeeklyRecapV2 } from '../weeklyRecap';

const NY = 'America/New_York';
const WEEK = '2026-10-12'; // Mon Oct 12 – Sun Oct 18 (EDT)
const at = (iso: string) => new Date(iso);

const base = (over: Partial<RecapSource> = {}): RecapSource => ({
  userId: 'u1', weekKey: WEEK, timeZone: NY, now: at('2026-10-21T18:00:00Z'), phase: 'FINAL', provenance: 'LIVE', hasAnyHistory: true,
  practices: [], priorPracticeAt: null, waypoints: [], courses: [], moves: [], completions: [], releases: [], milestones: [], visions: [],
  anchors: [{ id: 'a1', intention: 'Run a marathon', categoryKey: 'health', isReleased: false }, { id: 'a2', intention: 'Learn piano', categoryKey: 'creativity', isReleased: false }],
  failedDomains: [], ...over,
});
const course = (over = {}) => ({ id: 'c1', anchorId: 'a1', destination: 'Marathon day', waypointTotal: 4, waypointsReached: 2, finalWaypointId: 'w4', completedAt: null, routeScope: 'DESTINATION', ...over });
const wp = (id: string, iso: string, over = {}) => ({ id, courseId: 'c1', anchorId: 'a1', title: `Waypoint ${id}`, reachedAt: at(iso), ...over });
const mv = (id: string, iso: string, over = {}) => ({ id, courseId: 'c1', waypointId: 'wx', anchorId: 'a1', title: `Move ${id}`, completedAt: at(iso), ...over });
const pr = (id: string, key: string, over = {}) => ({ id, anchorId: 'a1', localDateKey: key, mode: 'focus', completedAt: at(`${key}T15:00:00Z`), ...over });
const compose = (s: RecapSource): WeeklyRecapV2 => composeWeeklyRecap(s)!;
const stat = (r: WeeklyRecapV2, id: string) => r.stats.find(s => s.id === id)?.value;

describe('completed Chart moves are meaningful progress', () => {
  it('reports several moves without a waypoint as progress, never a quiet week', () => {
    const r = compose(base({ courses: [course()], moves: [mv('m1', '2026-10-13T14:00:00Z'), mv('m2', '2026-10-14T14:00:00Z'), mv('m3', '2026-10-15T14:00:00Z')] }));
    expect(r.hero.kind).toBe('MOVES_PROGRESS');
    expect(r.hero.count).toBe(3);
    expect(r.opening.headline).not.toMatch(/quiet/i);
    expect(r.opening.summary).toBe('You finished 3 moves this week.');
    expect(stat(r, 'MOVES')).toBe(3);
  });
  it('a single move also counts, naming it', () => {
    const r = compose(base({ moves: [mv('m1', '2026-10-13T14:00:00Z', { title: 'Book the race' })] }));
    expect(r.hero.kind).toBe('MOVES_PROGRESS');
    expect(r.opening.summary).toContain('Book the race');
  });
  it('outranks practice-only weeks, even a full one', () => {
    const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'].map((k, i) => pr(`p${i}`, k));
    expect(compose(base({ practices: days, moves: [mv('m1', '2026-10-13T14:00:00Z')] })).hero.kind).toBe('MOVES_PROGRESS');
  });
  it('a reached waypoint outranks moves, and its own moves fold in without a second count', () => {
    const r = compose(base({
      courses: [course()], waypoints: [wp('w2', '2026-10-16T14:00:00Z')],
      moves: [mv('m1', '2026-10-14T14:00:00Z', { waypointId: 'w2' }), mv('m2', '2026-10-15T14:00:00Z', { waypointId: 'w2' })],
    }));
    expect(r.hero.kind).toBe('WAYPOINT_REACHED');
    expect(r.hero.movesCompleted).toBe(2);
    expect(r.highlights.find(h => h.kind === 'MOVES_PROGRESS')).toBeUndefined();
    expect(stat(r, 'MOVES')).toBe(2); // counted once, in the total
    expect(stat(r, 'WAYPOINTS')).toBe(1);
  });
  it('moves for a different waypoint still appear next to a waypoint hero', () => {
    const r = compose(base({
      courses: [course()], waypoints: [wp('w2', '2026-10-16T14:00:00Z')],
      moves: [mv('m1', '2026-10-14T14:00:00Z', { waypointId: 'w2' }), mv('m2', '2026-10-15T14:00:00Z', { waypointId: 'w3' })],
    }));
    expect(r.hero.movesCompleted).toBe(1);
    expect(r.highlights.map(h => h.kind)).toContain('MOVES_PROGRESS');
    expect(r.highlights.find(h => h.kind === 'MOVES_PROGRESS')!.count).toBe(1);
    expect(stat(r, 'MOVES')).toBe(2);
  });
  it('does not double count the same move delivered twice (CourseEvent + Move row)', () => {
    const r = compose(base({ moves: [mv('m1', '2026-10-13T14:00:00Z'), mv('m1', '2026-10-13T14:00:00Z')] }));
    expect(stat(r, 'MOVES')).toBe(1);
  });
  it('ignores moves completed outside the week (half-open boundaries)', () => {
    const r = compose(base({ moves: [
      mv('before', '2026-10-12T03:59:59Z'), // Sun 23:59:59 EDT, previous week
      mv('first', '2026-10-12T04:00:00Z'), mv('last', '2026-10-19T03:59:59Z'),
      mv('after', '2026-10-19T04:00:00Z'),
    ] }));
    expect(stat(r, 'MOVES')).toBe(2);
  });
  it('marks each move on its local weekday', () => {
    const r = compose(base({ moves: [mv('m1', '2026-10-19T02:00:00Z')] })); // Sun 22:00 EDT
    expect(r.motion.find(d => d.dateKey === '2026-10-18')!.markers).toEqual([{ kind: 'MOVE', dedupeKey: 'move:m1' }]);
  });
});

describe('hero ladder', () => {
  it('destination beats everything and absorbs its final waypoint', () => {
    const r = compose(base({
      courses: [course({ completedAt: at('2026-10-17T15:00:00Z'), waypointsReached: 4 })],
      waypoints: [wp('w3', '2026-10-14T15:00:00Z'), wp('w4', '2026-10-17T15:00:00Z')],
      releases: [{ anchorId: 'a2', at: at('2026-10-15T15:00:00Z') }],
    }));
    expect(r.hero.kind).toBe('DESTINATION_REACHED');
    expect(r.highlights.map(h => h.dedupeKey)).toEqual(expect.arrayContaining(['anchor:a2:released', 'waypoint:w3']));
    expect(r.highlights.map(h => h.dedupeKey)).not.toContain('waypoint:w4');
    expect(stat(r, 'WAYPOINTS')).toBe(2); // the final waypoint was reached, so it still counts once
    expect(r.motion.flatMap(d => d.markers).find(m => m.dedupeKey === 'waypoint:w4')!.kind).toBe('DESTINATION');
  });
  it('NEXT_STRETCH completion is not a destination', () => {
    const r = compose(base({ courses: [course({ completedAt: at('2026-10-17T15:00:00Z'), routeScope: 'NEXT_STRETCH' })] }));
    expect(r.hero.kind).not.toBe('DESTINATION_REACHED');
  });
  it('completing and releasing the same Anchor is one composite hero', () => {
    const r = compose(base({ completions: [{ anchorId: 'a1', at: at('2026-10-14T15:00:00Z') }], releases: [{ anchorId: 'a1', at: at('2026-10-16T15:00:00Z') }] }));
    expect(r.hero.kind).toBe('ANCHOR_COMPLETED_RELEASED');
    expect(r.highlights).toHaveLength(0);
    expect(stat(r, 'COMPLETED')).toBe(1);
    expect(stat(r, 'RELEASED')).toBe(1);
  });
  it('completion and release are distinct facts for different Anchors', () => {
    const r = compose(base({ completions: [{ anchorId: 'a1', at: at('2026-10-14T15:00:00Z') }], releases: [{ anchorId: 'a2', at: at('2026-10-16T15:00:00Z') }] }));
    expect(r.hero.kind).toBe('ANCHOR_RELEASED');
    expect(r.highlights[0].kind).toBe('ANCHOR_COMPLETED');
  });
  it('picks the higher waypoint ratio, then newer, then dedupeKey (total order)', () => {
    const courses = [course({ id: 'cA', waypointTotal: 4, waypointsReached: 1 }), course({ id: 'cB', waypointTotal: 4, waypointsReached: 3 })];
    const r = compose(base({ courses, waypoints: [wp('x', '2026-10-13T15:00:00Z', { courseId: 'cA' }), wp('y', '2026-10-14T15:00:00Z', { courseId: 'cB' })] }));
    expect(r.hero.dedupeKey).toBe('waypoint:y');
    const tie = compose(base({ courses: [course({ id: 'cA' }), course({ id: 'cB' })], waypoints: [wp('b', '2026-10-13T15:00:00Z', { courseId: 'cA' }), wp('a', '2026-10-13T15:00:00Z', { courseId: 'cB' })] }));
    expect(tie.hero.dedupeKey).toBe('waypoint:a');
  });
  it('collapses two waypoints on the same Chart into one highlight row', () => {
    const r = compose(base({ courses: [course({ waypointsReached: 3 })], waypoints: [wp('w1', '2026-10-13T15:00:00Z'), wp('w2', '2026-10-15T15:00:00Z')] }));
    expect(r.hero.dedupeKey).toBe('waypoint:w2');
    expect(r.highlights).toHaveLength(1);
    expect(r.highlights[0].title).toBe('2 waypoints reached');
    expect(stat(r, 'WAYPOINTS')).toBe(2);
  });
  it('a milestone on an included waypoint is a label, not another item or count', () => {
    const r = compose(base({ courses: [course()], waypoints: [wp('w1', '2026-10-13T15:00:00Z')], milestones: [
      { id: 'ms1', anchorId: 'a1', definitionId: 'journey.waypoint.first', earnedAt: at('2026-10-13T15:00:00Z'), sourceEntityId: 'w1' },
      { id: 'ms2', anchorId: 'a1', definitionId: 'journey.goal', earnedAt: at('2026-10-13T15:00:00Z'), sourceEntityId: null },
    ] }));
    expect(r.hero.labels).toEqual(['First waypoint']);
    expect(r.highlights).toHaveLength(0);
    expect(stat(r, 'MILESTONES')).toBeUndefined();
  });
  it('a practice-count milestone is its own achievement but does not add practices', () => {
    const r = compose(base({ practices: [pr('p1', '2026-10-13')], milestones: [{ id: 'ms', anchorId: 'a1', definitionId: 'commitment.practices.10', earnedAt: at('2026-10-13T15:00:00Z'), sourceEntityId: 'p1' }] }));
    expect(r.hero.kind).toBe('PRACTICE_COUNT_MILESTONE');
    expect(stat(r, 'PRACTICES')).toBe(1);
  });
  it('strength beats vision beats practice-count; highest strength wins', () => {
    const ms = (id: string, def: string) => ({ id, anchorId: 'a1', definitionId: def, earnedAt: at('2026-10-14T15:00:00Z'), sourceEntityId: null });
    const r = compose(base({ milestones: [ms('1', 'commitment.practices.30'), ms('2', 'vision.board.complete'), ms('3', 'strength.building'), ms('4', 'strength.integrated')] }));
    expect(r.hero.dedupeKey).toBe('milestone:4');
    expect(r.highlights.map(h => h.dedupeKey)).toEqual(['milestone:3', 'milestone:2', 'milestone:1']);
  });
  it('a Vision fact does not double a Vision milestone for the same event', () => {
    const r = compose(base({ visions: [{ id: 'v1', kind: 'FIRST', anchorId: 'a1', at: at('2026-10-14T15:00:00Z') }], milestones: [{ id: 'm', anchorId: 'a1', definitionId: 'vision.first', earnedAt: at('2026-10-14T15:00:00Z'), sourceEntityId: null }] }));
    expect([r.hero, ...r.highlights].filter(h => h.kind === 'VISION_MILESTONE')).toHaveLength(1);
  });
  it('practice-only tiers: week ≥4 days, return after ≥14 days, steady, quiet', () => {
    const keys = (n: number) => bounds7.slice(0, n).map((k, i) => pr(`p${i}`, k));
    const bounds7 = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
    expect(compose(base({ practices: keys(4) })).hero.kind).toBe('PRACTICE_WEEK');
    expect(compose(base({ practices: keys(3) })).hero.kind).toBe('STEADY');
    expect(compose(base({ practices: keys(2), priorPracticeAt: at('2026-09-20T15:00:00Z') })).hero.kind).toBe('RETURN');
    expect(compose(base({ practices: keys(2), priorPracticeAt: at('2026-10-05T15:00:00Z') })).hero.kind).toBe('STEADY');
    expect(compose(base()).hero.kind).toBe('QUIET');
  });
  it('returns nothing for an account with no history at all', () => {
    expect(composeWeeklyRecap(base({ hasAnyHistory: false }))).toBeNull();
  });
});

describe('counts reconcile with canonical sources, including events omitted from highlights', () => {
  it('totals come from sources even when the highlight list is capped', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `ms${i}`, anchorId: 'a1', definitionId: ['commitment.practices.1', 'commitment.practices.10', 'commitment.minutes.100', 'vision.visualize.1', 'vision.visualize.10', 'strength.building', 'strength.established', 'commitment.practices.30'][i], earnedAt: at('2026-10-14T15:00:00Z'), sourceEntityId: null }));
    const r = compose(base({ milestones: many, moves: [mv('m1', '2026-10-13T14:00:00Z'), mv('m2', '2026-10-13T15:00:00Z')] }));
    expect(stat(r, 'MILESTONES')).toBe(8);
    expect(1 + r.highlights.length + r.highlightsOverflow).toBe(8 + 1); // milestones + the moves candidate
    expect(r.highlights).toHaveLength(3);
    expect(r.motion.flatMap(d => d.markers).filter(m => m.kind === 'MILESTONE')).toHaveLength(8);
    expect(r.motion.flatMap(d => d.markers).filter(m => m.kind === 'MOVE')).toHaveLength(stat(r, 'MOVES')!);
  });
  it('practice totals equal days and sessions, and the motion strip', () => {
    const r = compose(base({ practices: [pr('a', '2026-10-12'), pr('b', '2026-10-12'), pr('c', '2026-10-14', { anchorId: 'a2' })] }));
    expect(stat(r, 'PRACTICE_DAYS')).toBe(2);
    expect(stat(r, 'PRACTICES')).toBe(3);
    expect(r.motion.reduce((n, d) => n + d.practices.length, 0)).toBe(3);
    expect(r.anchors.reduce((n, a) => n + a.practices, 0)).toBe(3);
  });
  it('excludes practice outside the week by local date key, and de-duplicates ids', () => {
    const r = compose(base({ practices: [pr('a', '2026-10-11'), pr('b', '2026-10-19'), pr('c', '2026-10-13'), pr('c', '2026-10-13')] }));
    expect(stat(r, 'PRACTICES')).toBe(1);
  });
  it('lists at most four Anchors and reports the overflow', () => {
    const anchors = ['a1', 'a2', 'a3', 'a4', 'a5'].map(id => ({ id, intention: id, categoryKey: 'career', isReleased: false }));
    const r = compose(base({ anchors, practices: anchors.map((a, i) => pr(`p${i}`, '2026-10-13', { anchorId: a.id })) }));
    expect(r.anchors).toHaveLength(4);
    expect(r.anchorsOverflow).toBe(1);
  });
  it('omits zero-value optional stats', () => {
    expect(compose(base({ practices: [pr('a', '2026-10-13')] })).stats.map(s => s.id)).toEqual(['PRACTICE_DAYS', 'PRACTICES']);
  });
});

describe('truth under missing data', () => {
  it('a failed Chart/Moves domain is never reported as zero or as a quiet week', () => {
    const r = compose(base({ failedDomains: ['CHART', 'MOVES'] }));
    expect(r.hero.kind).toBe('INCOMPLETE');
    expect(r.dataQuality.missing).toEqual(['CHART', 'MOVES']);
    expect(r.finalizable).toBe(false);
    expect(r.status).toBe('DRAFT');
    expect(r.provisional).toEqual({ isProvisional: true, reason: 'INCOMPLETE_DATA' });
    expect(r.stats.find(s => s.id === 'MOVES' || s.id === 'WAYPOINTS')).toBeUndefined();
  });
  it('a failed practice domain with nothing else is INCOMPLETE, not QUIET, and has no practice stats', () => {
    const r = compose(base({ failedDomains: ['PRACTICE'] }));
    expect(r.hero.kind).toBe('INCOMPLETE');
    expect(r.stats.find(s => s.id === 'PRACTICES')).toBeUndefined();
  });
  it('archived Anchors are not releases', () => {
    const r = compose(base({ anchors: [{ id: 'a1', intention: 'x', categoryKey: 'career', isReleased: false }], practices: [pr('p', '2026-10-13')] }));
    expect(stat(r, 'RELEASED')).toBeUndefined();
  });
  it('a released Anchor keeps its identity in refs', () => {
    const r = compose(base({ anchors: [{ id: 'a1', intention: 'Run a marathon', categoryKey: 'health', isReleased: true }], releases: [{ anchorId: 'a1', at: at('2026-10-15T15:00:00Z') }] }));
    expect(r.refs.anchors.a1).toEqual({ intention: 'Run a marathon', categoryKey: 'health', isReleased: true });
  });
});

describe('lifecycle and provisional status', () => {
  it('preview and syncing are provisional drafts; final is frozen only with complete data', () => {
    const p = compose(base({ phase: 'PREVIEW' }));
    expect(p.status).toBe('DRAFT'); expect(p.provisional.reason).toBe('WEEK_IN_PROGRESS');
    const s = compose(base({ phase: 'SYNCING' }));
    expect(s.status).toBe('DRAFT'); expect(s.provisional.reason).toBe('SYNCING');
    const f = compose(base({ phase: 'FINAL' }));
    expect(f.status).toBe('FINAL'); expect(f.provisional).toEqual({ isProvisional: false, reason: null });
  });
  it('late-synced practice changes a draft but the same inputs always give the same output', () => {
    const early = compose(base({ phase: 'SYNCING', practices: [pr('a', '2026-10-13')] }));
    const late = compose(base({ phase: 'SYNCING', practices: [pr('a', '2026-10-13'), pr('b', '2026-10-14')] }));
    expect(stat(early, 'PRACTICES')).toBe(1); expect(stat(late, 'PRACTICES')).toBe(2);
    expect(JSON.stringify(compose(base({ practices: [pr('a', '2026-10-13')] })))).toBe(JSON.stringify(compose(base({ practices: [pr('a', '2026-10-13')] }))));
  });
  it('picks stable copy per (user, week) and never uses invented claims', () => {
    const r = compose(base({ practices: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'].map((k, i) => pr(`p${i}`, k)) }));
    expect(r.opening.summary).toBe('You practiced on 4 of 7 days.');
    expect(JSON.stringify(r)).not.toMatch(/streak|becoming|you are a|proud/i);
    expect(compose(base({ practices: [pr('a', '2026-10-13')] })).opening.headline).toBe(compose(base({ practices: [pr('a', '2026-10-13')] })).opening.headline);
  });
  it('travel does not move a day: practice stays on its recorded local date key', () => {
    const r = compose(base({ practices: [pr('t', '2026-10-18', { completedAt: at('2026-10-18T23:30:00Z') })] })); // 19:30 EDT but recorded Sunday
    expect(r.motion.find(d => d.dateKey === '2026-10-18')!.practices).toHaveLength(1);
  });
  it('DST: an event in the repeated hour lands on the right local day', () => {
    const w = '2026-10-26';
    const r = compose(base({ weekKey: w, moves: [mv('m1', '2026-11-02T04:30:00Z'), mv('m2', '2026-11-02T05:00:00Z')] }));
    // Nov 2 04:30Z = 23:30 EST Sun Nov 1 (in week); 05:00Z = Mon 00:00 EST Nov 2 (next week)
    expect(stat(r, 'MOVES')).toBe(1);
  });
});
