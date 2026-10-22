/**
 * Regression suite for H-002 / H-003.
 *
 * `CourseEvent.idempotencyKey` is globally unique and derived from a
 * client-supplied string, so a replay pre-read can return an event belonging to
 * another account, Course, waypoint, or operation. `completeWaypoint` and
 * `transitionWaypoint` (skip) used to return early on that raw lookup without
 * re-checking ownership, which leaked a foreign CourseEvent UUID and reported a
 * transition that never happened.
 *
 * These tests pin the four-field guard (userId, courseId, waypointId,
 * eventType) on every replay path. They assert only on ids and derived state,
 * never on private text.
 */

import { CourseEventType, CourseStatus } from '@prisma/client';

const mockPrisma = {
  $transaction: jest.fn(),
  course: { findFirst: jest.fn(), update: jest.fn() },
  waypoint: { update: jest.fn() },
  courseEvent: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  courseAnchorLink: { findMany: jest.fn(), update: jest.fn() },
  reflection: { findMany: jest.fn(), create: jest.fn() },
  practiceSession: { findMany: jest.fn(), findUnique: jest.fn() },
};

jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

import { courseService } from '../CourseService';

const now = new Date('2026-08-04T12:00:00.000Z');

type WaypointOverrides = { reachedAt?: Date | null; skippedAt?: Date | null };

function courseRow(currentOverrides: WaypointOverrides = {}, currentWaypointId = 'waypoint-current') {
  return {
    id: 'course-1',
    userId: 'user-1',
    destinationText: 'A private destination',
    status: CourseStatus.ACTIVE,
    currentWaypointId,
    version: 4,
    createdFromProposalId: null,
    plottedAt: now,
    completedAt: null,
    archivedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    idempotencyKey: 'course-key',
    schemaVersion: 1,
    waypoints: [
      {
        id: 'waypoint-current',
        userId: 'user-1',
        courseId: 'course-1',
        position: 100,
        title: 'Current private waypoint',
        description: 'Private description',
        reachedAt: currentOverrides.reachedAt ?? null,
        skippedAt: currentOverrides.skippedAt ?? null,
        cancelledAt: null,
        supportingPracticeSessionId: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'waypoint-next',
        userId: 'user-1',
        courseId: 'course-1',
        position: 200,
        title: 'Next private waypoint',
        description: null,
        reachedAt: null,
        skippedAt: null,
        cancelledAt: null,
        supportingPracticeSessionId: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    anchorLinks: [],
  };
}

/** An event the caller legitimately owns. */
const ownEvent = (eventType: CourseEventType, overrides: Record<string, unknown> = {}) => ({
  id: 'own-event-id',
  userId: 'user-1',
  courseId: 'course-1',
  waypointId: 'waypoint-current',
  eventType,
  ...overrides,
});

/** An event that belongs to a different account entirely. */
const foreignEvent = (eventType: CourseEventType) => ({
  id: 'foreign-event-id',
  userId: 'user-2',
  courseId: 'course-2',
  waypointId: 'waypoint-of-user-2',
  eventType,
});

function expectNoMutation() {
  expect(mockPrisma.waypoint.update).not.toHaveBeenCalled();
  expect(mockPrisma.course.update).not.toHaveBeenCalled();
  expect(mockPrisma.courseEvent.create).not.toHaveBeenCalled();
}

describe('waypoint replay ownership (H-002 / H-003)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma)
    );
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    mockPrisma.courseAnchorLink.findMany.mockResolvedValue([]);
    mockPrisma.courseEvent.findMany.mockResolvedValue([]);
    mockPrisma.reflection.findMany.mockResolvedValue([]);
    mockPrisma.practiceSession.findMany.mockResolvedValue([]);
  });

  const complete = () =>
    courseService.completeWaypoint('user-1', 'course-1', 'waypoint-current', {
      idempotencyKey: 'collided-key',
      expectedCourseVersion: 4,
    });

  const skip = () =>
    courseService.skipWaypoint('user-1', 'course-1', 'waypoint-current', {
      idempotencyKey: 'collided-key',
      expectedCourseVersion: 4,
    });

  const cancel = () =>
    courseService.cancelWaypoint('user-1', 'course-1', 'waypoint-next', {
      idempotencyKey: 'collided-key',
      expectedCourseVersion: 4,
    });

  describe('completeWaypoint', () => {
    it('replays its own completion for the same account, Course and waypoint', async () => {
      // Scenario 1 + 11: the legitimate replay contract is unchanged.
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ reachedAt: now }, 'waypoint-next'));
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        ownEvent(CourseEventType.WAYPOINT_REACHED)
      );

      const result = await complete();

      expect(result.replayed).toBe(true);
      expect(result.completionEventId).toBe('own-event-id');
      expect(result.completedWaypoint.state).toBe('REACHED');
      expectNoMutation();
    });

    it('denies a replay whose event belongs to another account', async () => {
      // Scenario 4.
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        foreignEvent(CourseEventType.WAYPOINT_REACHED)
      );

      await expect(complete()).rejects.toMatchObject({
        code: 'IDEMPOTENCY_CONFLICT',
        statusCode: 409,
      });
      expectNoMutation();
    });

    it('denies a replay whose event belongs to another Course of the same account', async () => {
      // Scenario 2.
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        ownEvent(CourseEventType.WAYPOINT_REACHED, { courseId: 'course-9' })
      );

      await expect(complete()).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expectNoMutation();
    });

    it('denies a replay whose event belongs to a different waypoint', async () => {
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        ownEvent(CourseEventType.WAYPOINT_REACHED, { waypointId: 'waypoint-next' })
      );

      await expect(complete()).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expectNoMutation();
    });

    it('denies a replay recorded under a different event type', async () => {
      // Scenario 3: the same key must not let a skip masquerade as a completion.
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        ownEvent(CourseEventType.WAYPOINT_SKIPPED)
      );

      await expect(complete()).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expectNoMutation();
    });

    it('never leaks a foreign event id, Course id, or waypoint id to the caller', async () => {
      // Scenarios 5 + 6: the denial is indistinguishable from any other
      // idempotency conflict and carries no foreign identifiers.
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        foreignEvent(CourseEventType.WAYPOINT_REACHED)
      );

      const error = await complete().catch((caught: unknown) => caught);
      const serialized = JSON.stringify({
        message: (error as Error).message,
        ...(error as Record<string, unknown>),
      });

      expect(serialized).not.toContain('foreign-event-id');
      expect(serialized).not.toContain('course-2');
      expect(serialized).not.toContain('waypoint-of-user-2');
      expect(serialized).not.toContain('user-2');
    });

    it('leaves the waypoint unreached after a denied replay', async () => {
      // Scenario 7: the caller's own state is untouched, so a later legitimate
      // completion is still possible.
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        foreignEvent(CourseEventType.WAYPOINT_REACHED)
      );

      await complete().catch(() => undefined);

      const detail = await courseService.getCourse('user-1', 'course-1');
      const current = detail.waypoints.find(item => item.id === 'waypoint-current');
      expect(current?.state).not.toBe('REACHED');
      expect(mockPrisma.waypoint.update).not.toHaveBeenCalled();
    });

    it('stays idempotent across concurrent legitimate retries', async () => {
      // Scenario 10: three simultaneous retries of the caller's own key resolve
      // to the same event and write nothing.
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ reachedAt: now }, 'waypoint-next'));
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        ownEvent(CourseEventType.WAYPOINT_REACHED)
      );

      const results = await Promise.all([complete(), complete(), complete()]);

      expect(results.map(item => item.completionEventId)).toEqual([
        'own-event-id',
        'own-event-id',
        'own-event-id',
      ]);
      expect(results.every(item => item.replayed)).toBe(true);
      expectNoMutation();
    });
  });

  describe('skipWaypoint', () => {
    it('replays its own skip for the same account, Course and waypoint', async () => {
      // Scenario 1 + 11.
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ skippedAt: now }, 'waypoint-next'));
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        ownEvent(CourseEventType.WAYPOINT_SKIPPED)
      );

      const result = await skip();

      expect(result.waypoints.find(item => item.id === 'waypoint-current')?.state).toBe('SKIPPED');
      expectNoMutation();
    });

    it('denies a replay whose event belongs to another account', async () => {
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        foreignEvent(CourseEventType.WAYPOINT_SKIPPED)
      );

      await expect(skip()).rejects.toMatchObject({
        code: 'IDEMPOTENCY_CONFLICT',
        statusCode: 409,
      });
      expectNoMutation();
    });

    it('denies a replay whose event belongs to another Course of the same account', async () => {
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        ownEvent(CourseEventType.WAYPOINT_SKIPPED, { courseId: 'course-9' })
      );

      await expect(skip()).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expectNoMutation();
    });

    it('denies same-account key reuse against a different waypoint', async () => {
      // The silent no-op in H-003: the second skip used to resolve 200 with an
      // unchanged Course and no error at all.
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        ownEvent(CourseEventType.WAYPOINT_SKIPPED, { waypointId: 'waypoint-next' })
      );

      await expect(skip()).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expectNoMutation();
    });

    it('denies a replay recorded under a different event type', async () => {
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        ownEvent(CourseEventType.WAYPOINT_REACHED)
      );

      await expect(skip()).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expectNoMutation();
    });

    it('never leaks foreign identifiers and leaves the waypoint unskipped', async () => {
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        foreignEvent(CourseEventType.WAYPOINT_SKIPPED)
      );

      const error = await skip().catch((caught: unknown) => caught);
      const serialized = JSON.stringify({
        message: (error as Error).message,
        ...(error as Record<string, unknown>),
      });

      expect(serialized).not.toContain('foreign-event-id');
      expect(serialized).not.toContain('course-2');
      expect(serialized).not.toContain('user-2');

      const detail = await courseService.getCourse('user-1', 'course-1');
      expect(detail.waypoints.find(item => item.id === 'waypoint-current')?.state).not.toBe(
        'SKIPPED'
      );
    });
  });

  describe('cancelWaypoint', () => {
    it('keeps its existing guard against a foreign replay', async () => {
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        foreignEvent(CourseEventType.WAYPOINT_CANCELLED)
      );

      await expect(cancel()).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expectNoMutation();
    });

    it('denies a replay recorded under a different event type', async () => {
      mockPrisma.courseEvent.findUnique.mockResolvedValue(
        ownEvent(CourseEventType.WAYPOINT_SKIPPED, { waypointId: 'waypoint-next' })
      );

      await expect(cancel()).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expectNoMutation();
    });
  });
});
