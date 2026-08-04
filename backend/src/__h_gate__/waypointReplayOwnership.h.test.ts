/**
 * Workstream H release-gate harness — TEST ONLY.
 *
 * `CourseEvent.idempotencyKey` is globally unique (`prisma/schema.prisma`), and
 * the key is derived from a client-supplied string. `CourseEventService.append`
 * therefore guards a replayed event with an explicit owner/course/eventType
 * check, and `cancelWaypoint` repeats that guard on its own pre-read.
 *
 * `completeWaypoint` and `transitionWaypoint` (skip) perform the same pre-read
 * but return early WITHOUT any ownership check, so `append`'s guard is never
 * reached on the replay path. These tests pin the guard that those two paths
 * are missing.
 */

import { CourseEventType, CourseStatus } from '@prisma/client';

/**
 * These assertions encode behaviour the baseline does NOT yet have, so they are
 * opt-in (`H_GATE_DEFECTS=1`) and do not colour the standard suite totals.
 * They become the regression tests once the owning workstream lands the fix.
 */
const describeDefect = process.env.H_GATE_DEFECTS ? describe : describe.skip;

const mockPrisma = {
  $transaction: jest.fn(),
  course: { findFirst: jest.fn(), update: jest.fn() },
  waypoint: { update: jest.fn() },
  courseEvent: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  courseAnchorLink: { findMany: jest.fn(), update: jest.fn() },
  reflection: { findMany: jest.fn(), create: jest.fn() },
  practiceSession: { findMany: jest.fn(), findUnique: jest.fn() },
};

jest.mock('../lib/prisma', () => ({ prisma: mockPrisma }));

import { courseService } from '../services/CourseService';

const now = new Date('2026-08-04T12:00:00.000Z');

function courseRow() {
  return {
    id: 'course-1',
    userId: 'user-1',
    destinationText: 'A private destination',
    status: CourseStatus.ACTIVE,
    currentWaypointId: 'waypoint-current',
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
        reachedAt: null,
        skippedAt: null,
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

/** A CourseEvent that belongs to a different account entirely. */
const foreignEvent = (eventType: CourseEventType) => ({
  id: 'foreign-event-id',
  userId: 'user-2',
  courseId: 'course-2',
  waypointId: 'waypoint-of-user-2',
  eventType,
});

describeDefect('H gate — waypoint replay must verify event ownership', () => {
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

  it('completeWaypoint rejects a replay whose CourseEvent belongs to another account', async () => {
    mockPrisma.courseEvent.findUnique.mockResolvedValue(
      foreignEvent(CourseEventType.WAYPOINT_REACHED)
    );

    await expect(
      courseService.completeWaypoint('user-1', 'course-1', 'waypoint-current', {
        idempotencyKey: 'collided-key',
        expectedCourseVersion: 4,
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    expect(mockPrisma.waypoint.update).not.toHaveBeenCalled();
  });

  it('completeWaypoint never returns another account CourseEvent id to the caller', async () => {
    mockPrisma.courseEvent.findUnique.mockResolvedValue(
      foreignEvent(CourseEventType.WAYPOINT_REACHED)
    );

    const result = await courseService
      .completeWaypoint('user-1', 'course-1', 'waypoint-current', {
        idempotencyKey: 'collided-key',
        expectedCourseVersion: 4,
      })
      .catch(() => null);

    if (result) {
      expect(result.completionEventId).not.toBe('foreign-event-id');
      // A replay that reports success must correspond to a waypoint that is
      // actually reached; otherwise the client is told a lie.
      expect(result.completedWaypoint.state).toBe('REACHED');
    }
  });

  it('skipWaypoint rejects a replay whose CourseEvent belongs to another account', async () => {
    mockPrisma.courseEvent.findUnique.mockResolvedValue(
      foreignEvent(CourseEventType.WAYPOINT_SKIPPED)
    );

    await expect(
      courseService.skipWaypoint('user-1', 'course-1', 'waypoint-current', {
        idempotencyKey: 'collided-key',
        expectedCourseVersion: 4,
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    expect(mockPrisma.waypoint.update).not.toHaveBeenCalled();
  });
});
