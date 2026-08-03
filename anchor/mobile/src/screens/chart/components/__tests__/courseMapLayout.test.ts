import type { WaypointSummary } from '@/types/chart';
import { buildCourseMapLayout } from '../courseMapLayout';

function waypoint(overrides: Partial<WaypointSummary> & Pick<WaypointSummary, 'id' | 'position' | 'state'>): WaypointSummary {
  return {
    courseId: 'course-1',
    title: `Waypoint ${overrides.position}`,
    description: null,
    blockedReason: null,
    reachedAt: null,
    skippedAt: null,
    cancelledAt: null,
    anchorLink: null,
    ...overrides,
  };
}

describe('buildCourseMapLayout', () => {
  it('marks the waypoint matching currentWaypointId as dominant even when its state is BLOCKED', () => {
    const waypoints = [
      waypoint({ id: 'a', position: 1, state: 'REACHED' }),
      waypoint({ id: 'b', position: 2, state: 'BLOCKED' }),
      waypoint({ id: 'c', position: 3, state: 'UPCOMING' }),
    ];

    const layout = buildCourseMapLayout(waypoints, 'b');
    const dominant = layout.nodes.find((n) => n.isDominant);

    expect(dominant?.waypoint.id).toBe('b');
    expect(dominant?.emphasis).toBe('dominant');
  });

  it('never marks more than one node dominant', () => {
    const waypoints = [
      waypoint({ id: 'a', position: 1, state: 'REACHED' }),
      waypoint({ id: 'b', position: 2, state: 'CURRENT' }),
      waypoint({ id: 'c', position: 3, state: 'UPCOMING' }),
    ];
    const layout = buildCourseMapLayout(waypoints, 'b');
    expect(layout.nodes.filter((n) => n.isDominant)).toHaveLength(1);
  });

  it('marks no node dominant when currentWaypointId is null (DRAFT/COMPLETED courses)', () => {
    const waypoints = [
      waypoint({ id: 'a', position: 1, state: 'REACHED' }),
      waypoint({ id: 'b', position: 2, state: 'REACHED' }),
    ];
    const layout = buildCourseMapLayout(waypoints, null);
    expect(layout.nodes.every((n) => !n.isDominant)).toBe(true);
    expect(layout.nodes.every((n) => n.emphasis === 'reached')).toBe(true);
  });

  it('gives reached waypoints reached emphasis and everything else subdued, absent dominance', () => {
    const waypoints = [
      waypoint({ id: 'a', position: 1, state: 'REACHED' }),
      waypoint({ id: 'b', position: 2, state: 'SKIPPED' }),
      waypoint({ id: 'c', position: 3, state: 'UPCOMING' }),
    ];
    const layout = buildCourseMapLayout(waypoints, null);
    expect(layout.nodes.map((n) => n.emphasis)).toEqual(['reached', 'subdued', 'subdued']);
  });

  it('produces stable node ids matching input waypoint ids in order', () => {
    const waypoints = [
      waypoint({ id: 'a', position: 1, state: 'REACHED' }),
      waypoint({ id: 'b', position: 2, state: 'CURRENT' }),
    ];
    const layout = buildCourseMapLayout(waypoints, 'b');
    expect(layout.nodes.map((n) => n.waypoint.id)).toEqual(['a', 'b']);
  });
});
