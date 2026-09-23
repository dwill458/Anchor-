import { formatJourneyDate, liveWaypoints, toChartSummary, toChartViewModel, toMetricView } from '../chartV2Model';
import type { CourseDetail, MoveSummary, WaypointSummary } from '@/types/chart';

function waypoint(id: string, position: number, overrides: Partial<WaypointSummary> = {}): WaypointSummary {
  return {
    id,
    courseId: 'course-1',
    position,
    title: `Waypoint ${id}`,
    description: null,
    state: 'UPCOMING',
    blockedReason: null,
    reachedAt: null,
    skippedAt: null,
    cancelledAt: null,
    anchorLink: null,
    ...overrides,
  };
}

function move(id: string, waypointId: string, overrides: Partial<MoveSummary> = {}): MoveSummary {
  return {
    id,
    courseId: 'course-1',
    waypointId,
    title: `Move ${id}`,
    rationale: null,
    source: 'USER',
    status: 'ACTIVE',
    position: 100,
    isCurrent: false,
    completedAt: null,
    createdAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

function course(overrides: Partial<CourseDetail> = {}): CourseDetail {
  return {
    id: 'course-1',
    destinationText: 'Reach 10,000 active users',
    status: 'ACTIVE',
    version: 4,
    currentWaypointId: 'w2',
    currentMoveId: 'm2',
    waypointCount: 4,
    reachedCount: 1,
    plottedAt: '2026-05-31T12:00:00Z',
    completedAt: null,
    archivedAt: null,
    destinationAnchorLink: null,
    anchorId: 'anchor-1',
    waypoints: [
      waypoint('w1', 100, { state: 'REACHED', reachedAt: '2026-06-10T00:00:00Z' }),
      waypoint('w2', 200, {
        state: 'CURRENT',
        title: 'Reach 1,000 active users',
        kind: 'METRIC',
        metric: { label: 'active users', baseline: null, target: 1000, current: 642 },
      }),
      waypoint('gone', 250, { state: 'CANCELLED', cancelledAt: '2026-06-12T00:00:00Z' }),
      waypoint('w3', 300),
      waypoint('w4', 400, { title: 'Reach 10,000 active users' }),
    ],
    moves: [
      move('m1', 'w1', { status: 'COMPLETED', completedAt: '2026-06-09T00:00:00Z' }),
      move('m2', 'w2', { isCurrent: true, title: 'Finish onboarding redesign' }),
      move('s1', 'w2', { status: 'SUGGESTED', source: 'AI' }),
      move('d1', 'w2', { status: 'DISMISSED' }),
    ],
    ...overrides,
  };
}

describe('toChartViewModel', () => {
  it('reads the current waypoint from the server pointer and drops cancelled waypoints', () => {
    const view = toChartViewModel(course());
    expect(view.total).toBe(4);
    expect(view.waypoints.map((w) => w.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
    expect(view.current?.id).toBe('w2');
    expect(view.currentIndex).toBe(1);
    expect(view.positionLabel).toBe('2 of 4');
    expect(view.reachedCount).toBe(1);
    expect(view.waypoints.map((w) => w.state)).toEqual(['completed', 'current', 'upcoming', 'upcoming']);
    expect(view.waypoints[3].isDestination).toBe(true);
  });

  it('surfaces exactly one One Move: the server current Move', () => {
    const view = toChartViewModel(course());
    expect(view.oneMove?.title).toBe('Finish onboarding redesign');
    expect(view.current?.moves.map((m) => m.id)).toEqual(['m2']);
    expect(view.current?.suggestedMoves.map((m) => m.id)).toEqual(['s1']);
    expect(toChartViewModel(course({ currentMoveId: null })).oneMove).toBeNull();
  });

  it('shows metric progress when the waypoint has a measure, and none otherwise', () => {
    const view = toChartViewModel(course());
    expect(view.current?.metric).toMatchObject({ display: '642 / 1,000', fraction: 0.642, percentLabel: '64%' });
    expect(view.waypoints[2].metric).toBeNull();
  });

  it('describes waypoint state in words for screen readers', () => {
    const view = toChartViewModel(course());
    expect(view.waypoints[0].accessibilityLabel).toBe('Waypoint 1 of 4: Waypoint w1, reached');
    expect(view.waypoints[1].accessibilityLabel).toContain('current waypoint, 642 / 1,000 active users');
    expect(view.waypoints[3].accessibilityLabel).toContain('destination');
  });

  it('marks a completed Chart as finished with no One Move', () => {
    const view = toChartViewModel(
      course({ status: 'COMPLETED', currentWaypointId: null, completedAt: '2026-12-14T00:00:00Z' }),
      { completedMoveCount: 28, practiceCount: 74 }
    );
    expect(view.isFinished).toBe(true);
    expect(view.current).toBeNull();
    expect(view.oneMove).toBeNull();
    expect(view.completedMoveCount).toBe(28);
    expect(view.practiceCount).toBe(74);
  });
});

describe('toMetricView', () => {
  it('uses the baseline so progress starts where the person started', () => {
    expect(toMetricView({ label: 'users', baseline: 100, target: 1100, current: 600 })?.fraction).toBe(0.5);
  });
  it('shows an honest dash before any value is recorded', () => {
    expect(toMetricView({ label: null, baseline: null, target: 5, current: null })).toMatchObject({
      display: '— / 5',
      fraction: null,
      percentLabel: null,
    });
  });
  it('rejects a metric with no usable target', () => {
    expect(toMetricView({ label: null, baseline: null, target: 0, current: 2 })).toBeNull();
    expect(toMetricView(null)).toBeNull();
  });
});

describe('toChartSummary', () => {
  it('summarizes the live route for Home and Vision', () => {
    expect(toChartSummary(course())).toEqual({
      courseId: 'course-1',
      waypointNumber: 2,
      total: 4,
      waypointTitle: 'Reach 1,000 active users',
      oneMoveTitle: 'Finish onboarding redesign',
      isFinished: false,
      destination: 'Reach 10,000 active users',
    });
  });
  it('returns null without a live route', () => {
    expect(toChartSummary(null)).toBeNull();
    expect(toChartSummary(course({ status: 'ARCHIVED' }))).toBeNull();
  });
  it('reports a reached destination without inventing a next step', () => {
    const summary = toChartSummary(course({ status: 'COMPLETED', currentWaypointId: null }));
    expect(summary).toMatchObject({ isFinished: true, oneMoveTitle: null, waypointTitle: 'Reach 10,000 active users' });
  });
});

describe('helpers', () => {
  it('sorts by position', () => {
    const shuffled = course({ waypoints: [waypoint('b', 200), waypoint('a', 100)] });
    expect(liveWaypoints(shuffled).map((w) => w.id)).toEqual(['a', 'b']);
  });
  it('formats journey dates and ignores invalid ones', () => {
    expect(formatJourneyDate('2026-05-31T12:00:00Z')).toMatch(/May 31, 2026/);
    expect(formatJourneyDate('not a date')).toBeNull();
    expect(formatJourneyDate(null)).toBeNull();
  });
});
