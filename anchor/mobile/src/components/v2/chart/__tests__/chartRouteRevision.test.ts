import type { CourseDetail } from '@/types/chart';
import { course, waypoint } from '../panel/__tests__/chartPanelFixtures';
import { routeSignature, routeWasRevised } from '../chartRouteRevision';

const withWaypoints = (extra: CourseDetail['waypoints'], base: CourseDetail = course()): CourseDetail => ({ ...base, waypoints: extra });

describe('routeWasRevised', () => {
  it('is false for the same route, even with a new version, moves or progress', () => {
    const before = course();
    const after: CourseDetail = { ...course(), version: 9, moves: [], reachedCount: 2 };
    expect(routeWasRevised(before, after)).toBe(false);
  });

  it('is true when a waypoint is added, removed, reordered, renamed or its measure changes', () => {
    const before = course();
    const added = withWaypoints([...before.waypoints, waypoint({ id: 'w4', position: 400, title: 'Another' })]);
    const removed = withWaypoints(before.waypoints.slice(0, 2));
    const reordered = withWaypoints(before.waypoints.map((item) => (item.id === 'w3' ? { ...item, position: 150 } : item)));
    const renamed = withWaypoints(before.waypoints.map((item) => (item.id === 'w3' ? { ...item, title: 'Reach 20,000 active users' } : item)));
    const remeasured = withWaypoints(before.waypoints.map((item) => (item.id === 'w2' && item.metric ? { ...item, metric: { ...item.metric, target: 2000 } } : item)));
    for (const after of [added, removed, reordered, renamed, remeasured]) expect(routeWasRevised(before, after)).toBe(true);
  });

  it('ignores a cancelled waypoint and whitespace around titles (they are not part of the live route)', () => {
    const before = course();
    const withCancelled = withWaypoints([...before.waypoints, waypoint({ id: 'w9', position: 900, title: 'Gone', state: 'CANCELLED' })]);
    const padded = withWaypoints(before.waypoints.map((item) => ({ ...item, title: ` ${item.title} ` })));
    expect(routeWasRevised(before, withCancelled)).toBe(false);
    expect(routeWasRevised(before, padded)).toBe(false);
  });

  it('is false when either side is missing', () => {
    expect(routeWasRevised(null, course())).toBe(false);
    expect(routeWasRevised(course(), undefined)).toBe(false);
    expect(routeSignature(null)).toBe('');
  });
});
