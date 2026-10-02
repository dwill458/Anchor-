import { toChartViewModel, type ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import type { CourseDetail, MoveSummary, WaypointSummary } from '@/types/chart';

/** Fixed local "now" shared by the panel tests: 30 Sep 2026, noon. */
export const NOW = new Date(2026, 8, 30, 12, 0, 0);
/** A local time earlier the same day. */
export const EARLIER_TODAY = new Date(2026, 8, 30, 9, 0, 0).toISOString();
/** plottedAt chosen so the course is on its 10th day at NOW. */
export const PLOTTED_AT = new Date(2026, 8, 21, 8, 0, 0).toISOString();

export function move(overrides: Partial<MoveSummary> & Pick<MoveSummary, 'id' | 'title'>): MoveSummary {
  return {
    courseId: 'course-1',
    waypointId: 'w2',
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

export function waypoint(overrides: Partial<WaypointSummary> & Pick<WaypointSummary, 'id' | 'title' | 'position'>): WaypointSummary {
  return {
    courseId: 'course-1',
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

export function course(overrides: Partial<CourseDetail> = {}): CourseDetail {
  return {
    id: 'course-1',
    destinationText: 'Reach 10,000 active users',
    status: 'ACTIVE',
    version: 5,
    currentWaypointId: 'w2',
    currentMoveId: 'm1',
    waypointCount: 3,
    reachedCount: 1,
    plottedAt: PLOTTED_AT,
    completedAt: null,
    archivedAt: null,
    destinationAnchorLink: null,
    anchorId: 'anchor-1',
    waypoints: [
      waypoint({ id: 'w1', position: 100, title: 'Validate acquisition', state: 'REACHED', reachedAt: '2026-09-22T00:00:00Z' }),
      waypoint({
        id: 'w2',
        position: 200,
        title: 'Reach 1,000 active users',
        description: 'Growth becomes visible.',
        kind: 'METRIC',
        metric: { label: 'active users', baseline: 0, target: 1000, current: 642 },
        state: 'CURRENT',
      }),
      waypoint({ id: 'w3', position: 300, title: 'Reach 10,000 active users' }),
    ],
    moves: [
      move({ id: 'm1', title: 'Finish onboarding redesign', isCurrent: true }),
      move({ id: 'm2', title: 'Launch creator campaign', position: 200 }),
      move({ id: 'm3', waypointId: 'w3', title: 'Plan the next push', position: 300 }),
    ],
    ...overrides,
  };
}

export function viewOf(courseDetail: CourseDetail = course()): ChartViewModel {
  return toChartViewModel(courseDetail, { completedMoveCount: 0, practiceCount: 0 });
}

/** A Chart whose current waypoint has no measure (moves draw the leg). */
export function movesOnlyCourse(): CourseDetail {
  const base = course();
  return {
    ...base,
    waypoints: base.waypoints.map((item) => (item.id === 'w2' ? { ...item, kind: 'MILESTONE', metric: null } : item)),
  };
}

/** The current waypoint's one move was completed earlier today; another is waiting. */
export function dayClosedCourse(): CourseDetail {
  const base = course();
  return {
    ...base,
    currentMoveId: 'm2',
    moves: [
      move({ id: 'm1', title: 'Finish onboarding redesign', status: 'COMPLETED', completedAt: EARLIER_TODAY }),
      move({ id: 'm2', title: 'Launch creator campaign', position: 200, isCurrent: true }),
      move({ id: 'm3', waypointId: 'w3', title: 'Plan the next push', position: 300 }),
    ],
  };
}

/** Closed for the day with nothing left on the waypoint. */
export function dayClosedNoNextCourse(): CourseDetail {
  const base = course();
  return {
    ...base,
    currentMoveId: null,
    moves: [move({ id: 'm1', title: 'Finish onboarding redesign', status: 'COMPLETED', completedAt: EARLIER_TODAY })],
  };
}

export function finishedCourse(): CourseDetail {
  const base = course();
  return {
    ...base,
    status: 'COMPLETED',
    currentWaypointId: null,
    currentMoveId: null,
    completedAt: '2026-09-29T00:00:00Z',
    waypoints: base.waypoints.map((item) => ({ ...item, state: 'REACHED', reachedAt: '2026-09-29T00:00:00Z' })),
  };
}

export function chartActions(overrides: Record<string, unknown> = {}) {
  return {
    busy: null,
    addMove: jest.fn(async () => true),
    acceptMove: jest.fn(async () => true),
    completeMove: jest.fn(async () => true),
    dismissMove: jest.fn(async () => true),
    suggestMoves: jest.fn(async () => 'ok' as const),
    updateProgress: jest.fn(async () => true),
    reachWaypoint: jest.fn(async () => null),
    editWaypoint: jest.fn(async () => true),
    removeWaypoint: jest.fn(async () => true),
    setCurrentMove: jest.fn(async () => true),
    ...overrides,
  };
}
