import {
  deriveWaypointDisplayState,
  extractWaypointMoves,
  toV2ChartPresentationState,
  toV2ChartCompactState,
} from '../chartAdapter';
import type { CourseDetail, WaypointSummary } from '@/types/chart';

describe('chartAdapter', () => {
  const mockWaypoint1: WaypointSummary = {
    id: 'wp-1',
    courseId: 'c-1',
    position: 0,
    title: '100 active users',
    description: 'First milestone of real users',
    state: 'REACHED',
    reachedAt: '2026-09-01T00:00:00Z',
    skippedAt: null,
    cancelledAt: null,
    blockedReason: null,
    anchorLink: null,
  };

  const mockWaypoint2: WaypointSummary = {
    id: 'wp-2',
    courseId: 'c-1',
    position: 1,
    title: '1,000 active users',
    description: 'Talk to 5 early users\nPost the first week build story',
    state: 'CURRENT',
    reachedAt: null,
    skippedAt: null,
    cancelledAt: null,
    blockedReason: null,
    anchorLink: null,
  };

  const mockWaypoint3: WaypointSummary = {
    id: 'wp-3',
    courseId: 'c-1',
    position: 2,
    title: '10,000 active users',
    description: 'Destination goal',
    state: 'UPCOMING',
    reachedAt: null,
    skippedAt: null,
    cancelledAt: null,
    blockedReason: null,
    anchorLink: null,
  };

  const mockCourse: CourseDetail = {
    id: 'c-1',
    destinationText: '10,000 active users',
    status: 'ACTIVE',
    version: 1,
    currentWaypointId: 'wp-2',
    waypointCount: 3,
    reachedCount: 1,
    plottedAt: '2026-09-01T00:00:00Z',
    completedAt: null,
    archivedAt: null,
    destinationAnchorLink: null,
    waypoints: [mockWaypoint1, mockWaypoint2, mockWaypoint3],
  };

  describe('deriveWaypointDisplayState', () => {
    it('returns completed when reachedAt is set', () => {
      expect(deriveWaypointDisplayState(mockWaypoint1, 0, 1)).toBe('completed');
    });

    it('returns current when index matches currentIndex', () => {
      expect(deriveWaypointDisplayState(mockWaypoint2, 1, 1)).toBe('current');
    });

    it('returns upcoming for future waypoints', () => {
      expect(deriveWaypointDisplayState(mockWaypoint3, 2, 1)).toBe('upcoming');
    });
  });

  describe('extractWaypointMoves', () => {
    it('extracts multi-line steps from description', () => {
      const moves = extractWaypointMoves(mockWaypoint2);
      expect(moves).toHaveLength(2);
      expect(moves[0].text).toBe('Talk to 5 early users');
      expect(moves[1].text).toBe('Post the first week build story');
      expect(moves[0].done).toBe(false);
    });
  });

  describe('toV2ChartPresentationState', () => {
    it('normalizes CourseDetail into presentation state with authoritative current waypoint', () => {
      const state = toV2ChartPresentationState(mockCourse);
      expect(state).not.toBeNull();
      if (state) {
        expect(state.courseId).toBe('c-1');
        expect(state.destinationText).toBe('10,000 active users');
        expect(state.waypoints).toHaveLength(3);
        expect(state.currentWaypointIndex).toBe(1);
        expect(state.currentWaypoint?.id).toBe('wp-2');
        expect(state.isFinished).toBe(false);
        expect(state.oneMove?.text).toBe('Talk to 5 early users');
        expect(state.hasConnectedVision).toBe(false);
      }
    });

    it('works fully without connected vision', () => {
      const state = toV2ChartPresentationState(mockCourse, { connectedVisionId: null });
      expect(state?.hasConnectedVision).toBe(false);
      expect(state?.connectedVisionId).toBeNull();
    });

    it('correctly detects finished state when course status is COMPLETED', () => {
      const completedCourse: CourseDetail = {
        ...mockCourse,
        status: 'COMPLETED',
        completedAt: '2026-09-08T00:00:00Z',
        waypoints: mockCourse.waypoints.map((w) => ({
          ...w,
          state: 'REACHED',
          reachedAt: '2026-09-08T00:00:00Z',
        })),
      };
      const state = toV2ChartPresentationState(completedCourse);
      expect(state?.isFinished).toBe(true);
      expect(state?.currentWaypoint).toBeNull();
    });
  });

  describe('toV2ChartCompactState', () => {
    it('returns none when course is null or not active', () => {
      expect(toV2ChartCompactState(null)).toEqual({ state: 'none' });
      expect(toV2ChartCompactState({ ...mockCourse, status: 'DRAFT' })).toEqual({
        state: 'none',
      });
    });

    it('returns ready summary for active course', () => {
      const compact = toV2ChartCompactState(mockCourse);
      expect(compact).toEqual({
        state: 'ready',
        courseId: 'c-1',
        destinationText: '10,000 active users',
        nextMove: '1,000 active users',
        reachedCount: 1,
        waypointCount: 3,
        isFinished: false,
      });
    });
  });
});
