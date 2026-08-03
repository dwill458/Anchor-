import { CourseEventType, CourseStatus, CourseAnchorRole } from '@prisma/client';

const mockPrisma = {
  $transaction: jest.fn(),
  course: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  waypoint: { update: jest.fn() },
  courseEvent: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  courseAnchorLink: { findMany: jest.fn(), update: jest.fn() },
  reflection: { findMany: jest.fn() },
  practiceSession: { findMany: jest.fn() },
};

jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

import { courseService } from '../CourseService';

const now = new Date('2026-08-02T12:00:00.000Z');

function courseRow(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) =>
    callback(mockPrisma)
  );
  mockPrisma.courseEvent.findUnique.mockResolvedValue(null);
  mockPrisma.courseEvent.create.mockImplementation(async ({ data }: any) => ({
    ...data,
    id: 'event-1',
  }));
  mockPrisma.course.update.mockResolvedValue({});
  mockPrisma.waypoint.update.mockResolvedValue({});
  mockPrisma.courseAnchorLink.update.mockResolvedValue({});
  mockPrisma.courseEvent.findMany.mockResolvedValue([]);
  mockPrisma.reflection.findMany.mockResolvedValue([]);
  mockPrisma.practiceSession.findMany.mockResolvedValue([]);
});

describe('CourseService cancellation contract', () => {
  it('cancels an upcoming non-current waypoint, increments once, and emits WAYPOINT_CANCELLED', async () => {
    const initial = courseRow();
    const final = courseRow({
      version: 5,
      waypoints: initial.waypoints.map(waypoint =>
        waypoint.id === 'waypoint-next' ? { ...waypoint, cancelledAt: now } : waypoint
      ),
    });
    mockPrisma.course.findFirst.mockResolvedValueOnce(initial).mockResolvedValueOnce(final);

    const result = await courseService.cancelWaypoint('user-1', 'course-1', 'waypoint-next', {
      idempotencyKey: 'cancel-key',
      expectedCourseVersion: 4,
    });

    expect(result.version).toBe(5);
    expect(result.currentWaypointId).toBe('waypoint-current');
    expect(result.waypoints.find(item => item.id === 'waypoint-next')?.state).toBe('CANCELLED');
    expect(mockPrisma.waypoint.update).toHaveBeenCalledWith({
      where: { id: 'waypoint-next' },
      data: { cancelledAt: expect.any(Date) },
    });
    expect(mockPrisma.course.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.course.update).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      data: { version: { increment: 1 } },
    });
    expect(mockPrisma.courseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: CourseEventType.WAYPOINT_CANCELLED,
        waypointId: 'waypoint-next',
        snapshot: { waypointTitle: 'Next private waypoint' },
      }),
    });
  });

  it('replays cancellation idempotently without requiring the old version or creating a second event', async () => {
    const row = courseRow({
      version: 5,
      waypoints: courseRow().waypoints.map(item => ({
        ...item,
        cancelledAt: item.id === 'waypoint-next' ? now : null,
      })),
    });
    mockPrisma.course.findFirst.mockResolvedValue(row);
    mockPrisma.courseEvent.findUnique.mockResolvedValue({
      id: 'event-1',
      userId: 'user-1',
      courseId: 'course-1',
      waypointId: 'waypoint-next',
      eventType: CourseEventType.WAYPOINT_CANCELLED,
    });

    await expect(
      courseService.cancelWaypoint('user-1', 'course-1', 'waypoint-next', {
        idempotencyKey: 'cancel-key',
        expectedCourseVersion: 4,
      })
    ).resolves.toEqual(expect.objectContaining({ version: 5 }));
    expect(mockPrisma.waypoint.update).not.toHaveBeenCalled();
    expect(mockPrisma.course.update).not.toHaveBeenCalled();
    expect(mockPrisma.courseEvent.create).not.toHaveBeenCalled();
  });

  it.each([
    ['current', courseRow().currentWaypointId, courseRow(), 'WAYPOINT_TRANSITION_INVALID'],
    [
      'terminal',
      'waypoint-next',
      courseRow({
        waypoints: courseRow().waypoints.map(item =>
          item.id === 'waypoint-next' ? { ...item, reachedAt: now } : item
        ),
      }),
      'WAYPOINT_TRANSITION_INVALID',
    ],
  ])('rejects %s waypoints', async (_label, waypointId, row, code) => {
    mockPrisma.course.findFirst.mockResolvedValue(row);
    await expect(
      courseService.cancelWaypoint('user-1', 'course-1', waypointId as string, {
        idempotencyKey: `cancel-${_label}`,
        expectedCourseVersion: 4,
      })
    ).rejects.toMatchObject({ code });
    expect(mockPrisma.waypoint.update).not.toHaveBeenCalled();
    expect(mockPrisma.courseEvent.create).not.toHaveBeenCalled();
  });

  it('rejects ownership and stale-version conflicts before mutation', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);
    await expect(
      courseService.cancelWaypoint('other-user', 'course-1', 'waypoint-next', {
        idempotencyKey: 'foreign',
        expectedCourseVersion: 4,
      })
    ).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' });

    mockPrisma.course.findFirst.mockResolvedValue(courseRow({ version: 5 }));
    await expect(
      courseService.cancelWaypoint('user-1', 'course-1', 'waypoint-next', {
        idempotencyKey: 'stale',
        expectedCourseVersion: 4,
      })
    ).rejects.toMatchObject({ code: 'COURSE_VERSION_CONFLICT' });
    expect(mockPrisma.waypoint.update).not.toHaveBeenCalled();
  });

  it('renders the cancellation meaning in Course Log entries', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    mockPrisma.courseEvent.findMany.mockResolvedValue([
      {
        id: 'cancel-event',
        eventType: CourseEventType.WAYPOINT_CANCELLED,
        waypointId: 'waypoint-next',
        occurredAt: now,
        recordedAt: now,
        snapshot: { waypointTitle: 'Next private waypoint' },
        sourceEntityType: 'Waypoint',
        sourceEntityId: 'waypoint-next',
      },
    ]);

    const result = await courseService.listLog('user-1', 'course-1', 20);

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        eventType: CourseEventType.WAYPOINT_CANCELLED,
        message: 'Waypoint removed from the course.',
      })
    );
  });
});

describe('CourseService burn link closure', () => {
  it('refreshes every active snapshot before deletion and increments each Course once', async () => {
    const liveAnchor = {
      id: 'anchor-1',
      intentionText: 'Private intention',
      category: 'healing',
      planetaryTier: 'gold',
      enhancedImageUrl: 'private-image-url',
      isArchived: false,
    };
    const links = [
      {
        id: 'link-waypoint',
        userId: 'user-1',
        courseId: 'course-1',
        waypointId: 'waypoint-current',
        anchorId: 'anchor-1',
        role: CourseAnchorRole.WAYPOINT_PRIMARY,
        anchorSnapshot: {},
        linkedAt: now,
        unlinkedAt: null,
        createdAt: now,
        updatedAt: now,
        anchor: liveAnchor,
        course: { id: 'course-1', currentWaypointId: 'waypoint-current', version: 4 },
      },
      {
        id: 'link-destination',
        userId: 'user-1',
        courseId: 'course-1',
        waypointId: null,
        anchorId: 'anchor-1',
        role: CourseAnchorRole.DESTINATION,
        anchorSnapshot: {},
        linkedAt: now,
        unlinkedAt: null,
        createdAt: now,
        updatedAt: now,
        anchor: liveAnchor,
        course: { id: 'course-1', currentWaypointId: 'waypoint-current', version: 4 },
      },
    ];
    mockPrisma.courseAnchorLink.findMany.mockResolvedValue(links);

    await courseService.closeLinksForUnavailableAnchor(
      mockPrisma as never,
      'user-1',
      'anchor-1',
      'ANCHOR_RELEASED'
    );

    expect(mockPrisma.courseAnchorLink.update).toHaveBeenCalledTimes(2);
    for (const call of mockPrisma.courseAnchorLink.update.mock.calls) {
      expect(call[0].data.unlinkedAt).toBeInstanceOf(Date);
      expect(call[0].data.anchorSnapshot).toEqual(
        expect.objectContaining({
          anchorId: 'anchor-1',
          intentionText: 'Private intention',
          releasedAtUnlink: true,
        })
      );
    }
    expect(mockPrisma.course.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.courseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: CourseEventType.WAYPOINT_BLOCKED,
        waypointId: 'waypoint-current',
        snapshot: { blockedReason: 'ANCHOR_RELEASED' },
      }),
    });
    const firstUpdate = mockPrisma.courseAnchorLink.update.mock.invocationCallOrder[0];
    const blockedEvent = mockPrisma.courseEvent.create.mock.invocationCallOrder[0];
    const courseUpdate = mockPrisma.course.update.mock.invocationCallOrder[0];
    expect(firstUpdate).toBeLessThan(courseUpdate);
    expect(firstUpdate).toBeLessThan(blockedEvent);
    expect(blockedEvent).toBeLessThan(courseUpdate);
  });
});
