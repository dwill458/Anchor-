import { buildRecapViewModel } from '../recapViewModel';
import type { AvailableRecapView, RecapContent } from '../recapTypes';

const stats = { practiceDays: 3, sessions: 4, waypoints: 0, moves: 4, destinations: 0, intentionsCompleted: 0, releases: 0, milestones: 0 };
const days = ['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18'].map((dateKey, i) => ({ dateKey, practiced: i < 3, achievements: i === 1 ? 4 : 0 }));
const content = (over: Partial<RecapContent['core']> = {}, map: RecapContent['map'] = null): RecapContent => ({
  core: {
    weekKey: '2026-10-12', timeZone: 'America/New_York',
    hero: { kind: 'MOVES_PROGRESS', anchorId: 'a1', anchorTitle: 'Fitness', courseId: 'c1', count: 4 },
    headline: 'You completed 4 moves on Fitness.', stats, days, highlights: [], omittedHighlightCount: 0,
    reconciliation: { countedTotal: 4, listed: 0, absorbed: 0, omitted: 0 }, ...over,
  }, map,
});
const view = (o: Partial<AvailableRecapView> = {}, c = content()): AvailableRecapView => ({
  available: true, weekKey: '2026-10-12', timeZone: 'America/New_York', phase: 'FINAL', status: 'FINAL', provisional: false,
  finalizesAt: '2026-10-20T16:00:00.000Z', generatedAt: '2026-10-20T16:00:00.000Z', content: c, feedback: null, ...o,
});

describe('buildRecapViewModel', () => {
  it('labels the week Monday to Sunday', () => {
    expect(buildRecapViewModel(view()).weekLabel).toBe('Oct 12 – Oct 18');
    expect(buildRecapViewModel(view({ weekKey: '2026-10-26' }, content({ weekKey: '2026-10-26' }))).weekLabel).toBe('Oct 26 – Nov 1');
  });

  it('is honest about provisional status and only allows feedback once FINAL', () => {
    const fin = buildRecapViewModel(view());
    expect(fin.status).toEqual({ kind: 'FINAL', label: null });
    expect(fin.feedbackEnabled).toBe(true);
    const prov = buildRecapViewModel(view({ phase: 'PROVISIONAL', status: 'DRAFT', provisional: true }));
    expect(prov.status.kind).toBe('PROVISIONAL');
    expect(prov.status.label).toMatch(/final Tuesday at noon/i);
    expect(prov.feedbackEnabled).toBe(false);
    const prev = buildRecapViewModel(view({ phase: 'PREVIEW', status: 'DRAFT', provisional: true }));
    expect(prev.status.kind).toBe('PREVIEW');
    expect(prev.status.label).toMatch(/preview/i);
    expect(prev.feedbackEnabled).toBe(false);
  });

  it('a moves-only week shows accurate move copy and stats, not a quiet message', () => {
    const vm = buildRecapViewModel(view());
    expect(vm.hero.eyebrow).toBe('MOVES COMPLETED');
    expect(vm.hero.headline).toBe('You completed 4 moves on Fitness.');
    expect(vm.hero.support).toBe('3 practice days · 4 moves completed');
    expect(vm.stats.find((s) => s.key === 'moves')!.value).toBe('4');
    expect(vm.nextAction).toEqual({ kind: 'CHART', label: 'Choose your next move', anchorId: 'a1' });
  });

  it('a quiet week says only what is true', () => {
    const vm = buildRecapViewModel(view({}, content({
      hero: { kind: 'QUIET' }, headline: 'A quiet week.',
      stats: { ...stats, practiceDays: 0, sessions: 0, moves: 0 }, days: days.map((d) => ({ ...d, practiced: false, achievements: 0 })),
    })));
    expect(vm.hero.support).toBe('No practice or progress was recorded this week.');
    expect(vm.nextAction.kind).toBe('PRACTICE');
  });

  it('always shows practice days, moves and waypoints; other stats only when non-zero', () => {
    const vm = buildRecapViewModel(view());
    expect(vm.stats.map((s) => s.key)).toEqual(['practiceDays', 'moves', 'waypoints']);
    const vm2 = buildRecapViewModel(view({}, content({ stats: { ...stats, releases: 1, destinations: 1 } })));
    expect(vm2.stats.map((s) => s.key)).toEqual(['practiceDays', 'moves', 'waypoints', 'destinations', 'releases']);
  });

  it('exposes the seven-day strip with weekday letters', () => {
    const vm = buildRecapViewModel(view());
    expect(vm.days.map((d) => d.letter).join('')).toBe('MTWTFSS');
    expect(vm.days[0].practiced).toBe(true);
    expect(vm.days[1].achievements).toBe(4);
  });

  it('describes highlights, folds associated moves into the waypoint line, and reports omitted items', () => {
    const vm = buildRecapViewModel(view({}, content({
      hero: { kind: 'WAYPOINT', anchorId: 'a1', anchorTitle: 'Fitness', courseId: 'c1', title: 'First 5K' },
      highlights: [
        { kind: 'WAYPOINT_REACHED', sourceEntityId: 'w1', anchorId: 'a1', anchorTitle: 'Fitness', title: 'First 5K', occurredAt: '2026-10-15T15:00:00.000Z', absorbedMoveCount: 2 },
        { kind: 'MOVE_COMPLETED', sourceEntityId: 'm9', anchorId: 'a1', anchorTitle: 'Fitness', title: 'Stretch', occurredAt: '2026-10-14T15:00:00.000Z', absorbedMoveCount: 0 },
      ],
      omittedHighlightCount: 3,
    })));
    expect(vm.highlights[0]).toMatchObject({ label: 'Waypoint reached', detail: 'First 5K · 2 moves toward it' });
    expect(vm.highlights[1]).toMatchObject({ label: 'Move completed', detail: 'Stretch' });
    expect(vm.moreCount).toBe(3);
  });

  it('only renders a route when the server verified it; otherwise no route is shown', () => {
    const frozen = { waypointIndex: 2, waypointTotal: 5, reachedWaypointIds: ['a', 'b'], reachedMask: [true, true, false, false, false] };
    const ok = buildRecapViewModel(view({}, content({}, { courseId: 'c1', status: 'VERIFIED', frozen })));
    expect(ok.map).toEqual({ mode: 'VERIFIED', anchorId: 'a1', routeStatus: 'active', waypointIndex: 2, waypointTotal: 5, reachedMask: [true, true, false, false, false] });
    const bad = buildRecapViewModel(view({}, content({}, { courseId: 'c1', status: 'UNVERIFIED', frozen: null })));
    expect(bad.map).toEqual({ mode: 'NONE', reason: 'UNVERIFIED' });
    expect(buildRecapViewModel(view()).map).toEqual({ mode: 'NONE', reason: 'NO_COURSE' });
  });

  it('refuses to draw a route whose reached waypoints are not a contiguous prefix or whose mask is incomplete', () => {
    const gap = { waypointIndex: 2, waypointTotal: 4, reachedWaypointIds: ['a', 'c'], reachedMask: [true, false, true, false] };
    expect(buildRecapViewModel(view({}, content({}, { courseId: 'c1', status: 'VERIFIED', frozen: gap }))).map).toEqual({ mode: 'NONE', reason: 'UNVERIFIED' });
    const noMask = { waypointIndex: 1, waypointTotal: 3, reachedWaypointIds: ['a'] };
    expect(buildRecapViewModel(view({}, content({}, { courseId: 'c1', status: 'VERIFIED', frozen: noMask }))).map).toEqual({ mode: 'NONE', reason: 'UNVERIFIED' });
    const short = { waypointIndex: 1, waypointTotal: 3, reachedWaypointIds: ['a'], reachedMask: [true] };
    expect(buildRecapViewModel(view({}, content({}, { courseId: 'c1', status: 'VERIFIED', frozen: short }))).map).toEqual({ mode: 'NONE', reason: 'UNVERIFIED' });
  });

  it('can draw a verified route with nothing reached yet', () => {
    const none = { waypointIndex: 0, waypointTotal: 3, reachedWaypointIds: [], reachedMask: [false, false, false] };
    expect(buildRecapViewModel(view({}, content({}, { courseId: 'c1', status: 'VERIFIED', frozen: none }))).map).toMatchObject({ mode: 'VERIFIED', waypointIndex: 0 });
  });

  it('carries the anchor id on each highlight so the host can keep Anchor context', () => {
    const vm = buildRecapViewModel(view({}, content({ highlights: [{ kind: 'MOVE_COMPLETED', sourceEntityId: 'm1', anchorId: 'a7', anchorTitle: 'Writing', title: 'Draft', occurredAt: '2026-10-14T15:00:00.000Z', absorbedMoveCount: 0 }] })));
    expect(vm.highlights[0].anchorId).toBe('a7');
  });

  it('marks a reached destination as a complete route', () => {
    const frozen = { waypointIndex: 3, waypointTotal: 3, reachedWaypointIds: ['a', 'b', 'c'], reachedMask: [true, true, true] };
    const vm = buildRecapViewModel(view({}, content({ hero: { kind: 'DESTINATION', anchorId: 'a1', title: 'Run a 5K', courseId: 'c1' } }, { courseId: 'c1', status: 'VERIFIED', frozen })));
    expect(vm.map).toMatchObject({ mode: 'VERIFIED', routeStatus: 'complete' });
    expect(vm.nextAction.label).toBe('Plan what comes next');
  });
});
