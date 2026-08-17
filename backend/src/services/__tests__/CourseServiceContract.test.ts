/**
 * Phase 0 backend contract verification.
 *
 * Covers the prerequisites the gap report listed as unproven: Course/Waypoint
 * response shapes, derived Waypoint states, `Course.currentWaypointId` as the
 * only pointer authority, completion idempotency and expected-version checks,
 * atomic completion-plus-reflection, Anchor-link/blocked behavior, Course Log
 * pagination, and error codes/ownership.
 *
 * The existing CourseService.test.ts covers cancellation and burn link closure;
 * this file deliberately does not repeat those.
 */

import { CourseAnchorRole, CourseEventType, CourseStatus } from '@prisma/client';

const mockPrisma = {
  $transaction: jest.fn(),
  course: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  waypoint: { update: jest.fn() },
  courseEvent: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  courseAnchorLink: { findMany: jest.fn(), update: jest.fn(), create: jest.fn() },
  anchor: { findFirst: jest.fn() },
  reflection: { create: jest.fn(), findMany: jest.fn() },
  practiceSession: { findUnique: jest.fn(), findMany: jest.fn() },
};

jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

import { courseService } from '../CourseService';
import { AppError } from '../../api/middleware/errorHandler';

// Deterministic values from docs/chart/PHASE_0_FIXTURE_MATRIX.md.
const NOW = new Date('2026-08-04T15:00:00.000Z');
const PLOTTED_AT = new Date('2026-03-04T10:00:00.000Z');
const COURSE_ID = 'course-chart-phase0';
const USER_ID = 'acct-chart-phase0';
const COURSE_VERSION = 7;
const DESTINATION = 'Anchor has ten thousand users';

const WP = {
  start: 'wp-start',
  hundred: 'wp-100',
  current: 'wp-current',
  fiveK: 'wp-5k',
  tenK: 'wp-10k',
};

function waypointRow(
  id: string,
  position: number,
  title: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    userId: USER_ID,
    courseId: COURSE_ID,
    position,
    title,
    description: null,
    reachedAt: null,
    skippedAt: null,
    cancelledAt: null,
    supportingPracticeSessionId: null,
    createdAt: PLOTTED_AT,
    updatedAt: PLOTTED_AT,
    ...overrides,
  };
}

function anchorLinkRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'link-current',
    userId: USER_ID,
    courseId: COURSE_ID,
    waypointId: WP.current,
    role: CourseAnchorRole.WAYPOINT_PRIMARY,
    anchorId: 'anchor-current',
    anchorSnapshot: {
      snapshotVersion: 1,
      anchorId: 'anchor-current',
      intentionText: DESTINATION,
      category: 'career',
      planetaryTier: null,
      enhancedImageUrl: null,
      releasedAtUnlink: false,
      capturedAt: PLOTTED_AT.toISOString(),
    },
    linkedAt: PLOTTED_AT,
    unlinkedAt: null,
    anchor: {
      id: 'anchor-current',
      isArchived: false,
      intentionText: DESTINATION,
      category: 'career',
      planetaryTier: null,
      enhancedImageUrl: null,
    },
    ...overrides,
  };
}

/** The `active-current` fixture as a Prisma row. */
function courseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COURSE_ID,
    userId: USER_ID,
    destinationText: DESTINATION,
    status: CourseStatus.ACTIVE,
    currentWaypointId: WP.current,
    version: COURSE_VERSION,
    createdFromProposalId: null,
    plottedAt: PLOTTED_AT,
    completedAt: null,
    archivedAt: null,
    deletedAt: null,
    createdAt: PLOTTED_AT,
    updatedAt: PLOTTED_AT,
    idempotencyKey: 'course-key',
    schemaVersion: 1,
    waypoints: [
      waypointRow(WP.start, 100, 'START', { reachedAt: PLOTTED_AT }),
      waypointRow(WP.hundred, 200, '100 USERS', { reachedAt: PLOTTED_AT }),
      waypointRow(WP.current, 300, '1K USERS'),
      waypointRow(WP.fiveK, 400, '5K USERS'),
      waypointRow(WP.tenK, 500, '10K USERS'),
    ],
    anchorLinks: [anchorLinkRow()],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma),
  );
  mockPrisma.courseEvent.findUnique.mockResolvedValue(null);
  mockPrisma.courseEvent.findFirst.mockResolvedValue(null);
  let eventSeq = 0;
  mockPrisma.courseEvent.create.mockImplementation(async ({ data }: any) => {
    eventSeq += 1;
    return { ...data, id: `event-${eventSeq}` };
  });
  mockPrisma.courseEvent.findMany.mockResolvedValue([]);
  mockPrisma.course.update.mockResolvedValue({});
  mockPrisma.course.findMany.mockResolvedValue([]);
  mockPrisma.waypoint.update.mockResolvedValue({});
  mockPrisma.courseAnchorLink.update.mockResolvedValue({});
  mockPrisma.courseAnchorLink.findMany.mockResolvedValue([]);
  mockPrisma.courseAnchorLink.create.mockImplementation(async ({ data }: any) => data);
  mockPrisma.anchor.findFirst.mockResolvedValue(null);
  mockPrisma.reflection.findMany.mockResolvedValue([]);
  mockPrisma.reflection.create.mockImplementation(async ({ data }: any) => data);
  mockPrisma.practiceSession.findMany.mockResolvedValue([]);
  mockPrisma.practiceSession.findUnique.mockResolvedValue(null);
});

// ── Response shapes ─────────────────────────────────────────────────────────

describe('Course and Waypoint response shapes', () => {
  it('returns the frozen CourseDetail keys and nothing else', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    const course = await courseService.getCourse(USER_ID, COURSE_ID);

    expect(Object.keys(course).sort()).toEqual(
      [
        'id',
        'destinationText',
        'status',
        'version',
        'currentWaypointId',
        'waypointCount',
        'reachedCount',
        'plottedAt',
        'completedAt',
        'archivedAt',
        'destinationAnchorLink',
        'observations',
        'waypoints',
      ].sort(),
    );
    // No `needsRepair` on a healthy course.
    expect(course).not.toHaveProperty('needsRepair');
  });

  it('returns the frozen WaypointSummary keys with ISO timestamps', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    const course = await courseService.getCourse(USER_ID, COURSE_ID);

    for (const waypoint of course.waypoints) {
      expect(Object.keys(waypoint).sort()).toEqual(
        [
          'id',
          'courseId',
          'position',
          'title',
          'description',
          'state',
          'blockedReason',
          'reachedAt',
          'skippedAt',
          'cancelledAt',
          'anchorLink',
        ].sort(),
      );
    }
    const reached = course.waypoints.find(item => item.id === WP.start)!;
    expect(reached.reachedAt).toBe(PLOTTED_AT.toISOString());
    expect(typeof course.plottedAt).toBe('string');
  });

  it('exposes the destination as a Course property, never as a waypoint state', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    const course = await courseService.getCourse(USER_ID, COURSE_ID);

    expect(course.destinationText).toBe(DESTINATION);
    for (const waypoint of course.waypoints) {
      expect(['UPCOMING', 'CURRENT', 'REACHED', 'BLOCKED', 'SKIPPED', 'CANCELLED']).toContain(
        waypoint.state,
      );
      expect(waypoint.state as string).not.toBe('DESTINATION');
    }
  });

  it('reports counts consistent with the returned waypoints', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    const course = await courseService.getCourse(USER_ID, COURSE_ID);

    expect(course.waypointCount).toBe(5);
    expect(course.reachedCount).toBe(2);
    expect(course.waypoints.filter(item => item.state === 'REACHED')).toHaveLength(2);
  });
});

// ── Derived states and pointer authority ────────────────────────────────────

describe('Derived Waypoint states and currentWaypointId authority', () => {
  it('derives exactly one CURRENT, matching Course.currentWaypointId', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    const course = await courseService.getCourse(USER_ID, COURSE_ID);

    const currents = course.waypoints.filter(item => item.state === 'CURRENT');
    expect(currents).toHaveLength(1);
    expect(currents[0].id).toBe(course.currentWaypointId);
    expect(currents[0].id).toBe(WP.current);
  });

  it('derives every terminal state from its own timestamp, not from the pointer', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(
      courseRow({
        waypoints: [
          waypointRow(WP.start, 100, 'START', { reachedAt: PLOTTED_AT }),
          waypointRow(WP.hundred, 200, '100 USERS', { skippedAt: NOW }),
          waypointRow(WP.current, 300, '1K USERS'),
          waypointRow(WP.fiveK, 400, '5K USERS', { cancelledAt: NOW }),
          waypointRow(WP.tenK, 500, '10K USERS'),
        ],
      }),
    );
    const course = await courseService.getCourse(USER_ID, COURSE_ID);
    const byId = new Map(course.waypoints.map(item => [item.id, item.state]));

    expect(byId.get(WP.start)).toBe('REACHED');
    expect(byId.get(WP.hundred)).toBe('SKIPPED');
    expect(byId.get(WP.current)).toBe('CURRENT');
    expect(byId.get(WP.fiveK)).toBe('CANCELLED');
    expect(byId.get(WP.tenK)).toBe('UPCOMING');
  });

  it('flags a course whose pointer is corrupt and withholds a derived CURRENT', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(
      courseRow({ currentWaypointId: 'wp-does-not-exist' }),
    );
    const course = await courseService.getCourse(USER_ID, COURSE_ID);

    expect(course.needsRepair).toBe(true);
    // No client-side pointer inference: nothing becomes CURRENT.
    expect(course.waypoints.some(item => item.state === 'CURRENT')).toBe(false);
    // The raw (untrusted) pointer is still reported so the client can show it.
    expect(course.currentWaypointId).toBe('wp-does-not-exist');
  });

  it('clears the derived CURRENT for a completed course', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(
      courseRow({
        status: CourseStatus.COMPLETED,
        currentWaypointId: null,
        completedAt: NOW,
        waypoints: [
          waypointRow(WP.start, 100, 'START', { reachedAt: PLOTTED_AT }),
          waypointRow(WP.current, 300, '1K USERS', { reachedAt: NOW }),
        ],
      }),
    );
    const course = await courseService.getCourse(USER_ID, COURSE_ID);

    expect(course.currentWaypointId).toBeNull();
    expect(course.waypoints.every(item => item.state === 'REACHED')).toBe(true);
    expect(course.completedAt).toBe(NOW.toISOString());
  });
});

// ── Completion: idempotency, version, atomicity ─────────────────────────────

describe('Waypoint completion — expected version and pointer advance', () => {
  it('advances the pointer to the next non-terminal waypoint and increments once', async () => {
    mockPrisma.course.findFirst
      .mockResolvedValueOnce(courseRow())
      .mockResolvedValue(
        courseRow({
          version: COURSE_VERSION + 1,
          currentWaypointId: WP.fiveK,
          waypoints: [
            waypointRow(WP.start, 100, 'START', { reachedAt: PLOTTED_AT }),
            waypointRow(WP.hundred, 200, '100 USERS', { reachedAt: PLOTTED_AT }),
            waypointRow(WP.current, 300, '1K USERS', { reachedAt: NOW }),
            waypointRow(WP.fiveK, 400, '5K USERS'),
            waypointRow(WP.tenK, 500, '10K USERS'),
          ],
        }),
      );

    const result = await courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, {
      idempotencyKey: 'complete-1',
      expectedCourseVersion: COURSE_VERSION,
    });

    expect(result.replayed).toBe(false);
    expect(result.courseCompleted).toBe(false);
    expect(result.completedWaypoint.state).toBe('REACHED');
    expect(result.nextWaypoint?.id).toBe(WP.fiveK);
    expect(result.course.currentWaypointId).toBe(WP.fiveK);
    expect(result.course.version).toBe(COURSE_VERSION + 1);

    // Exactly one version increment, and the pointer came from the server.
    expect(mockPrisma.course.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.course.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentWaypointId: WP.fiveK,
          version: { increment: 1 },
        }),
      }),
    );
  });

  it('rejects a stale expected version and returns the refreshed course', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());

    await expect(
      courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, {
        idempotencyKey: 'complete-stale',
        expectedCourseVersion: COURSE_VERSION - 1,
      }),
    ).rejects.toMatchObject({ code: 'COURSE_VERSION_CONFLICT', statusCode: 409 });

    // Fail closed: no state was touched.
    expect(mockPrisma.waypoint.update).not.toHaveBeenCalled();
    expect(mockPrisma.course.update).not.toHaveBeenCalled();
    expect(mockPrisma.courseEvent.create).not.toHaveBeenCalled();
  });

  it('includes the refreshed course in the conflict payload', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    const error = await courseService
      .completeWaypoint(USER_ID, COURSE_ID, WP.current, {
        idempotencyKey: 'complete-stale-2',
        expectedCourseVersion: 1,
      })
      .catch((caught: AppError) => caught);

    // AppError.meta is what errorHandler serializes as `error.details`, which is
    // where ChartApiClient.getConflictCourse() reads the refreshed course from.
    const meta = (error as AppError).meta as { course: { version: number; currentWaypointId: string } };
    expect(meta.course.version).toBe(COURSE_VERSION);
    expect(meta.course.currentWaypointId).toBe(WP.current);
  });

  it('refuses to complete a waypoint that is not the current one', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());

    await expect(
      courseService.completeWaypoint(USER_ID, COURSE_ID, WP.fiveK, {
        idempotencyKey: 'complete-not-current',
        expectedCourseVersion: COURSE_VERSION,
      }),
    ).rejects.toMatchObject({ code: 'WAYPOINT_NOT_CURRENT', statusCode: 409 });
    expect(mockPrisma.course.update).not.toHaveBeenCalled();
  });

  it('refuses to re-complete an already reached waypoint', async () => {
    // Pointer stays on a healthy current waypoint; the target is a past one.
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());

    await expect(
      courseService.completeWaypoint(USER_ID, COURSE_ID, WP.start, {
        idempotencyKey: 'complete-again',
        expectedCourseVersion: COURSE_VERSION,
      }),
    ).rejects.toMatchObject({ code: 'WAYPOINT_ALREADY_REACHED', statusCode: 409 });
  });

  it('completes the course when no non-terminal waypoint follows', async () => {
    const finalRow = courseRow({
      currentWaypointId: WP.tenK,
      waypoints: [
        waypointRow(WP.start, 100, 'START', { reachedAt: PLOTTED_AT }),
        waypointRow(WP.tenK, 500, '10K USERS'),
      ],
      // The final waypoint carries its own primary link. Since D10 this is no
      // longer required to reach it — see the "no Anchor link at all" block —
      // but the anchored path is the one this test is about.
      anchorLinks: [anchorLinkRow({ id: 'link-10k', waypointId: WP.tenK })],
    });
    mockPrisma.course.findFirst.mockResolvedValueOnce(finalRow).mockResolvedValue(
      courseRow({
        status: CourseStatus.COMPLETED,
        currentWaypointId: null,
        completedAt: NOW,
        version: COURSE_VERSION + 1,
        waypoints: [
          waypointRow(WP.start, 100, 'START', { reachedAt: PLOTTED_AT }),
          waypointRow(WP.tenK, 500, '10K USERS', { reachedAt: NOW }),
        ],
        anchorLinks: [anchorLinkRow({ id: 'link-10k', waypointId: WP.tenK })],
      }),
    );

    const result = await courseService.completeWaypoint(USER_ID, COURSE_ID, WP.tenK, {
      idempotencyKey: 'complete-final',
      expectedCourseVersion: COURSE_VERSION,
    });

    expect(result.courseCompleted).toBe(true);
    expect(result.nextWaypoint).toBeNull();
    expect(result.course.currentWaypointId).toBeNull();
    expect(result.course.status).toBe('COMPLETED');

    const eventTypes = mockPrisma.courseEvent.create.mock.calls.map(
      ([args]: any) => args.data.eventType,
    );
    expect(eventTypes).toContain(CourseEventType.WAYPOINT_REACHED);
    expect(eventTypes).toContain(CourseEventType.COURSE_COMPLETED);
    // Completion is committed in the same transaction as the reach.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('Waypoint completion — idempotency', () => {
  it('replays a committed completion without a second event or version bump', async () => {
    mockPrisma.courseEvent.findUnique.mockResolvedValue({
      id: 'event-existing',
      userId: USER_ID,
      courseId: COURSE_ID,
      waypointId: WP.current,
      eventType: CourseEventType.WAYPOINT_REACHED,
      idempotencyKey: 'chart:waypoint-complete:complete-1:reached',
    });
    mockPrisma.course.findFirst.mockResolvedValue(
      courseRow({
        version: COURSE_VERSION + 1,
        currentWaypointId: WP.fiveK,
        waypoints: [
          waypointRow(WP.start, 100, 'START', { reachedAt: PLOTTED_AT }),
          waypointRow(WP.hundred, 200, '100 USERS', { reachedAt: PLOTTED_AT }),
          waypointRow(WP.current, 300, '1K USERS', { reachedAt: NOW }),
          waypointRow(WP.fiveK, 400, '5K USERS'),
          waypointRow(WP.tenK, 500, '10K USERS'),
        ],
      }),
    );

    const result = await courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, {
      idempotencyKey: 'complete-1',
      // A replay is accepted even though the caller's version is now stale —
      // otherwise a lost response would be unrecoverable.
      expectedCourseVersion: COURSE_VERSION,
    });

    expect(result.replayed).toBe(true);
    expect(result.completionEventId).toBe('event-existing');
    expect(result.completedWaypoint.state).toBe('REACHED');
    expect(result.course.currentWaypointId).toBe(WP.fiveK);
    expect(result.course.version).toBe(COURSE_VERSION + 1);

    expect(mockPrisma.courseEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.course.update).not.toHaveBeenCalled();
    expect(mockPrisma.waypoint.update).not.toHaveBeenCalled();
  });

  it('scopes the completion idempotency key to the reach event', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    await courseService
      .completeWaypoint(USER_ID, COURSE_ID, WP.current, {
        idempotencyKey: 'complete-key-shape',
        expectedCourseVersion: COURSE_VERSION,
      })
      .catch(() => undefined);

    expect(mockPrisma.courseEvent.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'chart:waypoint-complete:complete-key-shape:reached' },
    });
  });
});

describe('Waypoint completion — atomic reflection', () => {
  const completionWithReflection = {
    idempotencyKey: 'complete-with-reflection',
    expectedCourseVersion: COURSE_VERSION,
    reflection: {
      structuredContent: {
        whatHelped: 'Showing up on the days it felt pointless.',
        whatLearned: 'Consistency beats intensity.',
      },
      moodAfter: 'FOCUSED' as const,
      promptType: 'WAYPOINT_COMPLETION' as const,
      promptVersion: 1,
      idempotencyKey: 'reflection-1',
    },
  };

  function stageCompletion() {
    mockPrisma.course.findFirst.mockResolvedValueOnce(courseRow()).mockResolvedValue(
      courseRow({
        version: COURSE_VERSION + 1,
        currentWaypointId: WP.fiveK,
        waypoints: [
          waypointRow(WP.start, 100, 'START', { reachedAt: PLOTTED_AT }),
          waypointRow(WP.hundred, 200, '100 USERS', { reachedAt: PLOTTED_AT }),
          waypointRow(WP.current, 300, '1K USERS', { reachedAt: NOW }),
          waypointRow(WP.fiveK, 400, '5K USERS'),
          waypointRow(WP.tenK, 500, '10K USERS'),
        ],
      }),
    );
  }

  it('writes the reflection inside the completion transaction', async () => {
    stageCompletion();
    mockPrisma.reflection.create.mockImplementation(async ({ data }: any) => ({
      ...data,
      id: 'reflection-row-1',
    }));

    const result = await courseService.completeWaypoint(
      USER_ID,
      COURSE_ID,
      WP.current,
      completionWithReflection,
    );

    expect(result.reflectionId).toBe('reflection-row-1');
    // One transaction for the reach, the pointer advance, the reflection, and
    // both events. A separate reflection POST could be orphaned.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.reflection.create).toHaveBeenCalledTimes(1);
  });

  it('binds the reflection to the course, waypoint, and linked anchor', async () => {
    stageCompletion();
    await courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, completionWithReflection);

    const [args] = mockPrisma.reflection.create.mock.calls[0] as any[];
    expect(args.data).toMatchObject({
      userId: USER_ID,
      courseId: COURSE_ID,
      waypointId: WP.current,
      source: 'WAYPOINT_COMPLETION',
      promptType: 'WAYPOINT_COMPLETION',
      promptVersion: 1,
      anchorId: 'anchor-current',
      idempotencyKey: 'reflection-1',
      // The ceremony has no freeform field.
      body: null,
    });
    expect(args.data.structuredContent).toEqual({
      whatHelped: 'Showing up on the days it felt pointless.',
      whatLearned: 'Consistency beats intensity.',
    });
  });

  it('emits REFLECTION_ADDED alongside WAYPOINT_REACHED, under its own key', async () => {
    stageCompletion();
    await courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, completionWithReflection);

    const events = mockPrisma.courseEvent.create.mock.calls.map(([args]: any) => args.data);
    const reached = events.find(item => item.eventType === CourseEventType.WAYPOINT_REACHED);
    const added = events.find(item => item.eventType === CourseEventType.REFLECTION_ADDED);

    expect(reached?.idempotencyKey).toBe(
      'chart:waypoint-complete:complete-with-reflection:reached',
    );
    expect(added?.idempotencyKey).toBe('chart:reflection-added:reflection-1');
    expect(added?.snapshot).toEqual({ reflectionPromptType: 'WAYPOINT_COMPLETION' });
    // The event snapshot carries no reflection text.
    expect(JSON.stringify(added?.snapshot)).not.toContain('Consistency');
  });

  it('completes without a reflection when the user skips it', async () => {
    stageCompletion();
    const result = await courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, {
      idempotencyKey: 'complete-skip-reflection',
      expectedCourseVersion: COURSE_VERSION,
    });

    expect(result.reflectionId).toBeUndefined();
    expect(mockPrisma.reflection.create).not.toHaveBeenCalled();
    expect(result.completedWaypoint.state).toBe('REACHED');
  });

  it('creates no reflection when both prompts are left blank', async () => {
    stageCompletion();
    const result = await courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, {
      idempotencyKey: 'complete-blank-reflection',
      expectedCourseVersion: COURSE_VERSION,
      reflection: {
        structuredContent: { whatHelped: '   ', whatLearned: '' },
        promptType: 'WAYPOINT_COMPLETION',
        promptVersion: 1,
        idempotencyKey: 'reflection-blank',
      },
    });

    expect(result.reflectionId).toBeUndefined();
    expect(mockPrisma.reflection.create).not.toHaveBeenCalled();
    const events = mockPrisma.courseEvent.create.mock.calls.map(
      ([args]: any) => args.data.eventType,
    );
    expect(events).not.toContain(CourseEventType.REFLECTION_ADDED);
  });
});

describe('Waypoint completion — supporting practice session', () => {
  it('rejects a supporting session that belongs to another account', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    mockPrisma.practiceSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'someone-else',
      completedAt: NOW,
    });

    await expect(
      courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, {
        idempotencyKey: 'complete-cross-account',
        expectedCourseVersion: COURSE_VERSION,
        supportingPracticeSessionId: 'session-1',
      }),
    ).rejects.toMatchObject({
      code: 'PRACTICE_SESSION_ACCOUNT_MISMATCH',
      statusCode: 403,
    });
    expect(mockPrisma.course.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown supporting session', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    mockPrisma.practiceSession.findUnique.mockResolvedValue(null);

    await expect(
      courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, {
        idempotencyKey: 'complete-missing-session',
        expectedCourseVersion: COURSE_VERSION,
        supportingPracticeSessionId: 'session-missing',
      }),
    ).rejects.toMatchObject({ code: 'PRACTICE_SESSION_INVALID', statusCode: 422 });
  });

  it('records the supporting session on the reached waypoint', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    mockPrisma.practiceSession.findUnique.mockResolvedValue({
      id: 'session-ok',
      userId: USER_ID,
      completedAt: new Date(),
    });

    await courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, {
      idempotencyKey: 'complete-with-session',
      expectedCourseVersion: COURSE_VERSION,
      supportingPracticeSessionId: 'session-ok',
    });

    expect(mockPrisma.waypoint.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ supportingPracticeSessionId: 'session-ok' }),
      }),
    );
  });
});

// ── Blocked / anchor-link behavior ──────────────────────────────────────────

describe('Anchor-link and blocked-state behavior', () => {
  const releasedLink = anchorLinkRow({
    anchorId: null,
    unlinkedAt: NOW,
    anchor: null,
    anchorSnapshot: {
      snapshotVersion: 1,
      anchorId: 'anchor-current',
      intentionText: DESTINATION,
      category: 'career',
      planetaryTier: null,
      enhancedImageUrl: null,
      releasedAtUnlink: true,
      capturedAt: PLOTTED_AT.toISOString(),
    },
  });

  it('derives BLOCKED with ANCHOR_RELEASED and keeps the historical snapshot', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [releasedLink] }));
    const course = await courseService.getCourse(USER_ID, COURSE_ID);
    const current = course.waypoints.find(item => item.id === WP.current)!;

    expect(current.state).toBe('BLOCKED');
    expect(current.blockedReason).toBe('ANCHOR_RELEASED');
    expect(current.anchorLink?.anchorId).toBeNull();
    expect(current.anchorLink?.anchorAvailable).toBe(false);
    expect(current.anchorLink?.snapshot.intentionText).toBe(DESTINATION);
    expect(current.anchorLink?.snapshot.releasedAtUnlink).toBe(true);
  });

  it('refuses to complete a blocked waypoint and does not advance the pointer', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [releasedLink] }));

    await expect(
      courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, {
        idempotencyKey: 'complete-blocked',
        expectedCourseVersion: COURSE_VERSION,
      }),
    ).rejects.toMatchObject({ code: 'WAYPOINT_BLOCKED', statusCode: 409 });

    expect(mockPrisma.course.update).not.toHaveBeenCalled();
    expect(mockPrisma.waypoint.update).not.toHaveBeenCalled();
  });

  it('refuses to skip a blocked waypoint', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [releasedLink] }));

    await expect(
      courseService.skipWaypoint(USER_ID, COURSE_ID, WP.current, {
        idempotencyKey: 'skip-blocked',
        expectedCourseVersion: COURSE_VERSION,
      }),
    ).rejects.toMatchObject({ code: 'WAYPOINT_BLOCKED', statusCode: 409 });
  });

  it('does not block a non-current waypoint whose anchor was released', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(
      courseRow({
        anchorLinks: [
          releasedLink,
          anchorLinkRow({ id: 'link-5k', waypointId: WP.fiveK }),
        ],
        currentWaypointId: WP.fiveK,
        waypoints: [
          waypointRow(WP.current, 300, '1K USERS'),
          waypointRow(WP.fiveK, 400, '5K USERS'),
        ],
      }),
    );
    const course = await courseService.getCourse(USER_ID, COURSE_ID);

    // BLOCKED is a property of the current waypoint only.
    expect(course.waypoints.find(item => item.id === WP.current)?.state).toBe('UPCOMING');
    expect(course.waypoints.find(item => item.id === WP.fiveK)?.state).toBe('CURRENT');
  });

  /**
   * DECISION D10 — docs/chart/PHASE_0_D10_DECISION.md.
   *
   * A current waypoint that has never had a primary Anchor link is CURRENT, not
   * BLOCKED, and both of its transitions stay open. BLOCKED is reserved for a
   * link that existed and stopped working — the only case any code path emits
   * WAYPOINT_BLOCKED for. Practice is unavailable until an Anchor is linked,
   * but the Course is never stuck.
   */
  describe('a current waypoint with no Anchor link at all (D10)', () => {
    const noLinkRow = (overrides: Record<string, unknown> = {}) =>
      courseRow({
        anchorLinks: [],
        waypoints: [
          waypointRow(WP.start, 100, 'START', { reachedAt: PLOTTED_AT }),
          waypointRow(WP.current, 300, '1K USERS'),
          waypointRow(WP.fiveK, 400, '5K USERS'),
        ],
        ...overrides,
      });

    it('derives CURRENT with no blocked reason and no Anchor link', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(noLinkRow());
      const course = await courseService.getCourse(USER_ID, COURSE_ID);
      const current = course.waypoints.find(item => item.id === WP.current)!;

      expect(current.state).toBe('CURRENT');
      expect(current.blockedReason).toBeNull();
      // The absence of an Anchor is carried by anchorLink, not by a new state.
      expect(current.anchorLink).toBeNull();
    });

    it('can be reached, and the pointer advances', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(noLinkRow());

      const result = await courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, {
        idempotencyKey: 'complete-unanchored',
        expectedCourseVersion: COURSE_VERSION,
      });

      expect(result.replayed).toBe(false);
      expect(mockPrisma.course.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentWaypointId: WP.fiveK }),
        }),
      );
      const eventTypes = mockPrisma.courseEvent.create.mock.calls.map(
        ([args]: any) => args.data.eventType,
      );
      expect(eventTypes).toContain(CourseEventType.WAYPOINT_REACHED);
      expect(eventTypes).not.toContain(CourseEventType.WAYPOINT_BLOCKED);
    });

    it('can be skipped', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(noLinkRow());

      await courseService.skipWaypoint(USER_ID, COURSE_ID, WP.current, {
        idempotencyKey: 'skip-unanchored',
        expectedCourseVersion: COURSE_VERSION,
      });

      expect(mockPrisma.waypoint.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: WP.current } }),
      );
    });

    it('attaches a null anchorId to a reflection written on the reach', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(noLinkRow());

      await courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, {
        idempotencyKey: 'complete-unanchored-reflection',
        expectedCourseVersion: COURSE_VERSION,
        reflection: {
          idempotencyKey: 'reflection-unanchored',
          promptType: 'WAYPOINT_COMPLETION',
          promptVersion: 1,
          structuredContent: { whatHelped: 'Kept showing up.' },
        },
      });

      expect(mockPrisma.reflection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ anchorId: null, waypointId: WP.current }),
        }),
      );
    });

    it('emits WAYPOINT_ANCHOR_LINKED without WAYPOINT_UNBLOCKED on the first link', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(noLinkRow());
      mockPrisma.anchor.findFirst.mockResolvedValue({
        id: 'anchor-new',
        isArchived: false,
        intentionText: 'A new thread.',
        category: 'career',
        planetaryTier: null,
        enhancedImageUrl: null,
      });

      await courseService.linkAnchor(USER_ID, COURSE_ID, {
        idempotencyKey: 'link-first',
        expectedCourseVersion: COURSE_VERSION,
        anchorId: 'anchor-new',
        role: CourseAnchorRole.WAYPOINT_PRIMARY,
        waypointId: WP.current,
      });

      const eventTypes = mockPrisma.courseEvent.create.mock.calls.map(
        ([args]: any) => args.data.eventType,
      );
      expect(eventTypes).toContain(CourseEventType.WAYPOINT_ANCHOR_LINKED);
      // Nothing was ever blocked, so nothing may be reported as unblocked.
      expect(eventTypes).not.toContain(CourseEventType.WAYPOINT_UNBLOCKED);
    });
  });

  it('reports an unavailable anchor on a still-linked waypoint as blocked', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(
      courseRow({
        anchorLinks: [
          anchorLinkRow({
            anchor: { id: 'anchor-current', isArchived: true, intentionText: DESTINATION, category: 'career', planetaryTier: null, enhancedImageUrl: null },
          }),
        ],
      }),
    );
    const course = await courseService.getCourse(USER_ID, COURSE_ID);
    const current = course.waypoints.find(item => item.id === WP.current)!;

    expect(current.state).toBe('BLOCKED');
    expect(current.blockedReason).toBe('ANCHOR_RELEASED');
  });
});

// ── One live Course (D9) ────────────────────────────────────────────────────

/**
 * Decision D9 — "Plot what comes next" and the one-live-Course invariant.
 *
 * The invariant is enforced by the `courses_one_active_per_user` partial unique
 * index (`WHERE status = 'ACTIVE' AND deleted_at IS NULL`) with an application
 * pre-check that only improves the error. A DRAFT can always be created;
 * *publishing* is what a live Course blocks, and a COMPLETED or ARCHIVED Course
 * does not occupy the slot.
 */
describe('One live Course', () => {
  // These tests queue exact call sequences on course.findFirst (the Course read,
  // then the active-Course pre-check). jest.clearAllMocks() clears call records
  // but not queued implementations, so reset it explicitly per test.
  beforeEach(() => {
    mockPrisma.course.findFirst.mockReset();
  });

  const draftRow = (overrides: Record<string, unknown> = {}) =>
    courseRow({
      status: CourseStatus.DRAFT,
      currentWaypointId: null,
      anchorLinks: [],
      waypoints: [waypointRow(WP.start, 100, 'START')],
      ...overrides,
    });

  it('refuses to publish a draft while another Course is ACTIVE', async () => {
    mockPrisma.course.findFirst
      .mockResolvedValueOnce(draftRow())
      .mockResolvedValueOnce({ id: 'course-other-active' });

    await expect(
      courseService.updateCourse(USER_ID, COURSE_ID, {
        expectedCourseVersion: COURSE_VERSION,
        status: 'ACTIVE',
      }),
    ).rejects.toMatchObject({ code: 'ACTIVE_COURSE_EXISTS', statusCode: 409 });

    expect(mockPrisma.course.update).not.toHaveBeenCalled();
  });

  it('publishes when no other Course is ACTIVE, and sets the pointer to the first waypoint', async () => {
    mockPrisma.course.findFirst
      .mockResolvedValueOnce(draftRow())
      .mockResolvedValueOnce(null)
      .mockResolvedValue(
        draftRow({ status: CourseStatus.ACTIVE, currentWaypointId: WP.start }),
      );

    await courseService.updateCourse(USER_ID, COURSE_ID, {
      expectedCourseVersion: COURSE_VERSION,
      status: 'ACTIVE',
    });

    expect(mockPrisma.course.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CourseStatus.ACTIVE,
          currentWaypointId: WP.start,
        }),
      }),
    );
  });

  it('refuses to restore an archived Course while another is ACTIVE', async () => {
    // Restore returns the Course to whatever it was archived from, so only a
    // Course archived *from ACTIVE* competes for the single live slot.
    mockPrisma.courseEvent.findFirst.mockResolvedValue({
      id: 'event-archived',
      snapshot: { previousStatus: CourseStatus.ACTIVE },
    });
    mockPrisma.course.findFirst
      .mockResolvedValueOnce(
        courseRow({
          status: CourseStatus.ARCHIVED,
          currentWaypointId: null,
          archivedAt: NOW,
        }),
      )
      .mockResolvedValueOnce({ id: 'course-other-active' });

    await expect(
      courseService.restoreCourse(USER_ID, COURSE_ID, COURSE_VERSION),
    ).rejects.toMatchObject({ code: 'ACTIVE_COURSE_EXISTS', statusCode: 409 });
  });

  it('scopes the active-Course check to the owner and excludes the Course being published', async () => {
    mockPrisma.course.findFirst
      .mockResolvedValueOnce(draftRow())
      .mockResolvedValueOnce(null)
      .mockResolvedValue(draftRow({ status: CourseStatus.ACTIVE }));

    await courseService.updateCourse(USER_ID, COURSE_ID, {
      expectedCourseVersion: COURSE_VERSION,
      status: 'ACTIVE',
    });

    expect(mockPrisma.course.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER_ID,
          status: CourseStatus.ACTIVE,
          deletedAt: null,
          id: { not: COURSE_ID },
        },
      }),
    );
  });

  it('refuses to publish a Course with no non-terminal waypoint', async () => {
    mockPrisma.course.findFirst.mockResolvedValueOnce(
      draftRow({ waypoints: [waypointRow(WP.start, 100, 'START', { skippedAt: NOW })] }),
    );

    await expect(
      courseService.updateCourse(USER_ID, COURSE_ID, {
        expectedCourseVersion: COURSE_VERSION,
        status: 'ACTIVE',
      }),
    ).rejects.toMatchObject({ code: 'WAYPOINT_NOT_FOUND', statusCode: 422 });
  });
});

// ── Anchor link lifecycle (D5/D6 behavioral closure) ────────────────────────

/**
 * The blocked/unblocked half of decisions D5 and D6: every way an Anchor can
 * arrive at, leave, or stop working on a waypoint, and what each one does to
 * the derived state, the pointer, the Course version, and the event log.
 *
 * Visual treatment and copy for these states remain product decisions (D5).
 * What is frozen and tested here is the behavior underneath them.
 */
describe('Anchor link lifecycle', () => {
  const NEW_ANCHOR = {
    id: 'anchor-replacement',
    isArchived: false,
    intentionText: 'A thread I can still pull.',
    category: 'career',
    planetaryTier: null,
    enhancedImageUrl: null,
  };

  /** The link a burn leaves behind: closed, anchor hard-deleted, snapshot kept. */
  const burnedLink = () =>
    anchorLinkRow({
      anchorId: null,
      unlinkedAt: NOW,
      anchor: null,
      anchorSnapshot: {
        snapshotVersion: 1,
        anchorId: 'anchor-current',
        intentionText: DESTINATION,
        category: 'career',
        planetaryTier: null,
        enhancedImageUrl: null,
        releasedAtUnlink: true,
        capturedAt: PLOTTED_AT.toISOString(),
      },
    });

  const eventTypes = () =>
    mockPrisma.courseEvent.create.mock.calls.map(([args]: any) => args.data.eventType);

  const eventKeys = () =>
    mockPrisma.courseEvent.create.mock.calls.map(([args]: any) => args.data.idempotencyKey);

  beforeEach(() => {
    mockPrisma.anchor.findFirst.mockResolvedValue(NEW_ANCHOR);
  });

  describe('linking to a current waypoint', () => {
    it('refuses a second active link without a replacement id', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow());

      await expect(
        courseService.linkAnchor(USER_ID, COURSE_ID, {
          idempotencyKey: 'link-duplicate',
          expectedCourseVersion: COURSE_VERSION,
          anchorId: NEW_ANCHOR.id,
          role: CourseAnchorRole.WAYPOINT_PRIMARY,
          waypointId: WP.current,
        }),
      ).rejects.toMatchObject({ code: 'ANCHOR_LINK_INVALID', statusCode: 422 });

      expect(mockPrisma.courseAnchorLink.create).not.toHaveBeenCalled();
      expect(mockPrisma.course.update).not.toHaveBeenCalled();
    });

    it('refuses to link an archived Anchor', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [] }));
      mockPrisma.anchor.findFirst.mockResolvedValue({ ...NEW_ANCHOR, isArchived: true });

      await expect(
        courseService.linkAnchor(USER_ID, COURSE_ID, {
          idempotencyKey: 'link-archived',
          expectedCourseVersion: COURSE_VERSION,
          anchorId: NEW_ANCHOR.id,
          role: CourseAnchorRole.WAYPOINT_PRIMARY,
          waypointId: WP.current,
        }),
      ).rejects.toMatchObject({ code: 'ANCHOR_UNAVAILABLE', statusCode: 409 });
    });

    it('refuses an Anchor belonging to another account', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [] }));
      // findFirst is scoped by userId, so another account's Anchor is simply absent.
      mockPrisma.anchor.findFirst.mockResolvedValue(null);

      await expect(
        courseService.linkAnchor(USER_ID, COURSE_ID, {
          idempotencyKey: 'link-foreign',
          expectedCourseVersion: COURSE_VERSION,
          anchorId: 'anchor-someone-else',
          role: CourseAnchorRole.WAYPOINT_PRIMARY,
          waypointId: WP.current,
        }),
      ).rejects.toMatchObject({ code: 'ANCHOR_LINK_INVALID', statusCode: 422 });
      expect(mockPrisma.anchor.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'anchor-someone-else', userId: USER_ID } }),
      );
    });

    it('increments the Course version exactly once', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [] }));

      await courseService.linkAnchor(USER_ID, COURSE_ID, {
        idempotencyKey: 'link-once',
        expectedCourseVersion: COURSE_VERSION,
        anchorId: NEW_ANCHOR.id,
        role: CourseAnchorRole.WAYPOINT_PRIMARY,
        waypointId: WP.current,
      });

      expect(mockPrisma.course.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.course.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { version: { increment: 1 } } }),
      );
    });

    it('captures a fresh snapshot at link time', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [] }));

      await courseService.linkAnchor(USER_ID, COURSE_ID, {
        idempotencyKey: 'link-snapshot',
        expectedCourseVersion: COURSE_VERSION,
        anchorId: NEW_ANCHOR.id,
        role: CourseAnchorRole.WAYPOINT_PRIMARY,
        waypointId: WP.current,
      });

      const [{ data }] = mockPrisma.courseAnchorLink.create.mock.calls[0] as any[];
      expect(data.anchorSnapshot).toMatchObject({
        snapshotVersion: 1,
        anchorId: NEW_ANCHOR.id,
        intentionText: NEW_ANCHOR.intentionText,
        releasedAtUnlink: false,
      });
    });

    it('does not move the pointer', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [] }));

      await courseService.linkAnchor(USER_ID, COURSE_ID, {
        idempotencyKey: 'link-pointer',
        expectedCourseVersion: COURSE_VERSION,
        anchorId: NEW_ANCHOR.id,
        role: CourseAnchorRole.WAYPOINT_PRIMARY,
        waypointId: WP.current,
      });

      const [{ data }] = mockPrisma.course.update.mock.calls[0] as any[];
      expect(data).not.toHaveProperty('currentWaypointId');
    });

    it('rejects a stale expected version before touching anything', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [] }));

      await expect(
        courseService.linkAnchor(USER_ID, COURSE_ID, {
          idempotencyKey: 'link-stale',
          expectedCourseVersion: COURSE_VERSION - 1,
          anchorId: NEW_ANCHOR.id,
          role: CourseAnchorRole.WAYPOINT_PRIMARY,
          waypointId: WP.current,
        }),
      ).rejects.toMatchObject({ code: 'COURSE_VERSION_CONFLICT', statusCode: 409 });

      expect(mockPrisma.courseAnchorLink.create).not.toHaveBeenCalled();
      expect(mockPrisma.course.update).not.toHaveBeenCalled();
    });

    it('returns the refreshed course as the new authority', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [] }));

      const result = await courseService.linkAnchor(USER_ID, COURSE_ID, {
        idempotencyKey: 'link-authority',
        expectedCourseVersion: COURSE_VERSION,
        anchorId: NEW_ANCHOR.id,
        role: CourseAnchorRole.WAYPOINT_PRIMARY,
        waypointId: WP.current,
      });

      expect(result.id).toBe(COURSE_ID);
      expect(result.waypoints).toHaveLength(5);
      expect(result.currentWaypointId).toBe(WP.current);
    });
  });

  describe('replacing an unavailable Anchor', () => {
    /** Still linked, but the Anchor was archived out from under the link. */
    const archivedRow = () =>
      courseRow({
        anchorLinks: [
          anchorLinkRow({
            anchor: {
              id: 'anchor-current',
              isArchived: true,
              intentionText: DESTINATION,
              category: 'career',
              planetaryTier: null,
              enhancedImageUrl: null,
            },
          }),
        ],
      });

    it('closes the old link, opens a new one, and unblocks in one version bump', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(archivedRow());

      await courseService.linkAnchor(USER_ID, COURSE_ID, {
        idempotencyKey: 'replace-1',
        expectedCourseVersion: COURSE_VERSION,
        anchorId: NEW_ANCHOR.id,
        role: CourseAnchorRole.WAYPOINT_PRIMARY,
        waypointId: WP.current,
        replaceLinkId: 'link-current',
      });

      expect(mockPrisma.courseAnchorLink.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'link-current' },
          data: expect.objectContaining({ unlinkedAt: expect.any(Date) }),
        }),
      );
      expect(mockPrisma.courseAnchorLink.create).toHaveBeenCalledTimes(1);
      expect(eventTypes()).toEqual([
        CourseEventType.WAYPOINT_ANCHOR_LINKED,
        CourseEventType.WAYPOINT_UNBLOCKED,
      ]);
      // Two events, one version increment.
      expect(mockPrisma.course.update).toHaveBeenCalledTimes(1);
    });

    it('marks the replaced snapshot as released because the Anchor was unavailable', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(archivedRow());

      await courseService.linkAnchor(USER_ID, COURSE_ID, {
        idempotencyKey: 'replace-snapshot',
        expectedCourseVersion: COURSE_VERSION,
        anchorId: NEW_ANCHOR.id,
        role: CourseAnchorRole.WAYPOINT_PRIMARY,
        waypointId: WP.current,
        replaceLinkId: 'link-current',
      });

      const [{ data }] = mockPrisma.courseAnchorLink.update.mock.calls[0] as any[];
      expect(data.anchorSnapshot).toMatchObject({
        anchorId: 'anchor-current',
        intentionText: DESTINATION,
        releasedAtUnlink: true,
      });
    });

    it('scopes the link and unblock events under separate idempotency keys', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(archivedRow());

      await courseService.linkAnchor(USER_ID, COURSE_ID, {
        idempotencyKey: 'replace-keys',
        expectedCourseVersion: COURSE_VERSION,
        anchorId: NEW_ANCHOR.id,
        role: CourseAnchorRole.WAYPOINT_PRIMARY,
        waypointId: WP.current,
        replaceLinkId: 'link-current',
      });

      expect(eventKeys()).toEqual([
        'chart:anchor-link:replace-keys',
        'chart:waypoint-unblocked:replace-keys',
      ]);
      expect(new Set(eventKeys()).size).toBe(eventKeys().length);
    });

    it('rejects a replacement id that is not the active link', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(archivedRow());

      await expect(
        courseService.linkAnchor(USER_ID, COURSE_ID, {
          idempotencyKey: 'replace-wrong-id',
          expectedCourseVersion: COURSE_VERSION,
          anchorId: NEW_ANCHOR.id,
          role: CourseAnchorRole.WAYPOINT_PRIMARY,
          waypointId: WP.current,
          replaceLinkId: 'link-that-is-not-active',
        }),
      ).rejects.toMatchObject({ code: 'ANCHOR_LINK_INVALID', statusCode: 422 });
    });

    it('relinks after a burn without a replacement id, since the link is already closed', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [burnedLink()] }));

      await courseService.linkAnchor(USER_ID, COURSE_ID, {
        idempotencyKey: 'relink-after-burn',
        expectedCourseVersion: COURSE_VERSION,
        anchorId: NEW_ANCHOR.id,
        role: CourseAnchorRole.WAYPOINT_PRIMARY,
        waypointId: WP.current,
      });

      // The burn already closed the link, so no second close happens here.
      expect(mockPrisma.courseAnchorLink.update).not.toHaveBeenCalled();
      expect(eventTypes()).toEqual([
        CourseEventType.WAYPOINT_ANCHOR_LINKED,
        CourseEventType.WAYPOINT_UNBLOCKED,
      ]);
    });

    it('restores the waypoint to CURRENT after a relink', async () => {
      mockPrisma.course.findFirst
        .mockResolvedValueOnce(courseRow({ anchorLinks: [burnedLink()] }))
        .mockResolvedValue(
          courseRow({
            version: COURSE_VERSION + 1,
            anchorLinks: [
              burnedLink(),
              anchorLinkRow({ id: 'link-new', anchorId: NEW_ANCHOR.id, anchor: NEW_ANCHOR }),
            ],
          }),
        );

      const result = await courseService.linkAnchor(USER_ID, COURSE_ID, {
        idempotencyKey: 'relink-state',
        expectedCourseVersion: COURSE_VERSION,
        anchorId: NEW_ANCHOR.id,
        role: CourseAnchorRole.WAYPOINT_PRIMARY,
        waypointId: WP.current,
      });

      const current = result.waypoints.find(item => item.id === WP.current)!;
      expect(current.state).toBe('CURRENT');
      expect(current.blockedReason).toBeNull();
      expect(current.anchorLink?.anchorAvailable).toBe(true);
      expect(current.anchorLink?.anchorId).toBe(NEW_ANCHOR.id);
    });
  });

  describe('unlinking and releasing', () => {
    it('emits WAYPOINT_BLOCKED with a reason when the current waypoint loses its Anchor', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow());

      await courseService.unlinkAnchor(USER_ID, COURSE_ID, 'link-current', COURSE_VERSION);

      expect(eventTypes()).toEqual([CourseEventType.WAYPOINT_BLOCKED]);
      const [{ data }] = mockPrisma.courseEvent.create.mock.calls[0] as any[];
      expect(data.snapshot).toEqual({ blockedReason: 'ANCHOR_UNLINKED' });
      expect(data.waypointId).toBe(WP.current);
    });

    it('emits no WAYPOINT_BLOCKED when the waypoint is not current', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(
        courseRow({
          anchorLinks: [anchorLinkRow({ id: 'link-5k', waypointId: WP.fiveK })],
        }),
      );

      await courseService.unlinkAnchor(USER_ID, COURSE_ID, 'link-5k', COURSE_VERSION);

      expect(eventTypes()).toEqual([]);
      expect(mockPrisma.course.update).toHaveBeenCalledTimes(1);
    });

    it('keeps the snapshot as history and never advances the pointer', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow());

      await courseService.unlinkAnchor(USER_ID, COURSE_ID, 'link-current', COURSE_VERSION);

      const [{ data }] = mockPrisma.courseAnchorLink.update.mock.calls[0] as any[];
      expect(data.unlinkedAt).toBeInstanceOf(Date);
      expect(data.anchorSnapshot).toMatchObject({ intentionText: DESTINATION });
      const [{ data: courseData }] = mockPrisma.course.update.mock.calls[0] as any[];
      expect(courseData).not.toHaveProperty('currentWaypointId');
    });

    it('records ANCHOR_RELEASED rather than ANCHOR_UNLINKED when the Anchor is already gone', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(
        courseRow({ anchorLinks: [anchorLinkRow({ anchor: null })] }),
      );

      await courseService.unlinkAnchor(USER_ID, COURSE_ID, 'link-current', COURSE_VERSION);

      const [{ data }] = mockPrisma.courseEvent.create.mock.calls[0] as any[];
      expect(data.snapshot).toEqual({ blockedReason: 'ANCHOR_RELEASED' });
    });

    it('refuses to unlink a link that is already closed', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [burnedLink()] }));

      await expect(
        courseService.unlinkAnchor(USER_ID, COURSE_ID, 'link-current', COURSE_VERSION),
      ).rejects.toMatchObject({ code: 'ANCHOR_LINK_INVALID', statusCode: 422 });
      expect(mockPrisma.course.update).not.toHaveBeenCalled();
    });

    it('rejects a stale expected version before closing anything', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow());

      await expect(
        courseService.unlinkAnchor(USER_ID, COURSE_ID, 'link-current', COURSE_VERSION - 1),
      ).rejects.toMatchObject({ code: 'COURSE_VERSION_CONFLICT', statusCode: 409 });
      expect(mockPrisma.courseAnchorLink.update).not.toHaveBeenCalled();
    });
  });

  describe('blocked and unblocked transitions', () => {
    it('derives ANCHOR_UNLINKED from an explicitly closed link, not from an absent one', async () => {
      const unlinked = anchorLinkRow({
        anchorId: null,
        unlinkedAt: NOW,
        anchor: null,
        anchorSnapshot: {
          snapshotVersion: 1,
          anchorId: 'anchor-current',
          intentionText: DESTINATION,
          category: 'career',
          planetaryTier: null,
          enhancedImageUrl: null,
          releasedAtUnlink: false,
          capturedAt: PLOTTED_AT.toISOString(),
        },
      });
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [unlinked] }));

      const course = await courseService.getCourse(USER_ID, COURSE_ID);
      const current = course.waypoints.find(item => item.id === WP.current)!;
      expect(current.state).toBe('BLOCKED');
      expect(current.blockedReason).toBe('ANCHOR_UNLINKED');
      // The history that explains the block survives the block.
      expect(current.anchorLink?.snapshot.intentionText).toBe(DESTINATION);
    });

    it('derives ANCHOR_DELETED when the link is open but its Anchor row is gone', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(
        courseRow({ anchorLinks: [anchorLinkRow({ anchorId: null, anchor: null })] }),
      );

      const course = await courseService.getCourse(USER_ID, COURSE_ID);
      const current = course.waypoints.find(item => item.id === WP.current)!;
      expect(current.state).toBe('BLOCKED');
      expect(current.blockedReason).toBe('ANCHOR_DELETED');
    });

    it('never reports a blocked reason on a waypoint that is not BLOCKED', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [burnedLink()] }));
      const course = await courseService.getCourse(USER_ID, COURSE_ID);

      for (const waypoint of course.waypoints) {
        if (waypoint.state !== 'BLOCKED') expect(waypoint.blockedReason).toBeNull();
      }
    });

    it('blocks the current waypoint without changing any other waypoint state', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [burnedLink()] }));
      const course = await courseService.getCourse(USER_ID, COURSE_ID);

      expect(course.waypoints.map(item => item.state)).toEqual([
        'REACHED',
        'REACHED',
        'BLOCKED',
        'UPCOMING',
        'UPCOMING',
      ]);
      expect(course.currentWaypointId).toBe(WP.current);
      expect(course.reachedCount).toBe(2);
    });
  });

  describe('Anchor snapshot rendering', () => {
    it('returns the frozen AnchorLinkSummary keys', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow());
      const course = await courseService.getCourse(USER_ID, COURSE_ID);
      const current = course.waypoints.find(item => item.id === WP.current)!;

      expect(Object.keys(current.anchorLink!).sort()).toEqual(
        ['anchorAvailable', 'anchorId', 'id', 'linkedAt', 'role', 'snapshot'].sort(),
      );
      expect(Object.keys(current.anchorLink!.snapshot).sort()).toEqual(
        [
          'anchorId',
          'capturedAt',
          'category',
          'enhancedImageUrl',
          'intentionText',
          'planetaryTier',
          'releasedAtUnlink',
          'snapshotVersion',
        ].sort(),
      );
    });

    it('renders a burned Anchor from its snapshot with anchorAvailable false', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [burnedLink()] }));
      const course = await courseService.getCourse(USER_ID, COURSE_ID);
      const link = course.waypoints.find(item => item.id === WP.current)!.anchorLink!;

      expect(link.anchorId).toBeNull();
      expect(link.anchorAvailable).toBe(false);
      expect(link.snapshot.intentionText).toBe(DESTINATION);
      expect(link.snapshot.releasedAtUnlink).toBe(true);
    });

    it('normalizes a malformed snapshot rather than leaking partial data', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(
        courseRow({ anchorLinks: [anchorLinkRow({ anchorSnapshot: { intentionText: 42 } })] }),
      );
      const course = await courseService.getCourse(USER_ID, COURSE_ID);
      const snapshot = course.waypoints.find(item => item.id === WP.current)!.anchorLink!.snapshot;

      expect(snapshot.snapshotVersion).toBe(1);
      expect(snapshot.intentionText).toBe('');
      expect(snapshot.releasedAtUnlink).toBe(false);
      expect(typeof snapshot.capturedAt).toBe('string');
    });

    it('keeps a reached waypoint’s Anchor snapshot after the reach', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(
        courseRow({
          anchorLinks: [anchorLinkRow({ id: 'link-100', waypointId: WP.hundred })],
        }),
      );
      const course = await courseService.getCourse(USER_ID, COURSE_ID);
      const reached = course.waypoints.find(item => item.id === WP.hundred)!;

      expect(reached.state).toBe('REACHED');
      expect(reached.anchorLink?.snapshot.intentionText).toBe(DESTINATION);
    });
  });

  describe('Course Log events for the link lifecycle', () => {
    it('renders blocked and unblocked with their frozen meanings', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow());
      mockPrisma.courseEvent.findMany.mockResolvedValue([
        {
          id: 'e-unblocked',
          userId: USER_ID,
          courseId: COURSE_ID,
          waypointId: WP.current,
          eventType: CourseEventType.WAYPOINT_UNBLOCKED,
          sourceEntityType: 'CourseAnchorLink',
          sourceEntityId: 'link-new',
          snapshot: null,
          occurredAt: NOW,
          recordedAt: NOW,
          idempotencyKey: 'chart:waypoint-unblocked:k2',
        },
        {
          id: 'e-blocked',
          userId: USER_ID,
          courseId: COURSE_ID,
          waypointId: WP.current,
          eventType: CourseEventType.WAYPOINT_BLOCKED,
          sourceEntityType: 'CourseAnchorLink',
          sourceEntityId: 'link-current',
          snapshot: { blockedReason: 'ANCHOR_RELEASED' },
          occurredAt: PLOTTED_AT,
          recordedAt: PLOTTED_AT,
          idempotencyKey: 'chart:anchor-release-blocked:link-current',
        },
      ]);

      const log = await courseService.listLog(USER_ID, COURSE_ID, 25);

      expect(log.data.map(entry => entry.eventType)).toEqual([
        CourseEventType.WAYPOINT_UNBLOCKED,
        CourseEventType.WAYPOINT_BLOCKED,
      ]);
      expect(log.data[0].message).toBe('Waypoint unblocked.');
      expect(log.data[1].message).toBe('Waypoint blocked.');
      // The reason is carried as an approved snapshot key, not free text.
      expect(log.data[1].snapshot).toEqual({ blockedReason: 'ANCHOR_RELEASED' });
    });

    it('carries no Anchor intention text into a link event snapshot', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(courseRow({ anchorLinks: [] }));

      await courseService.linkAnchor(USER_ID, COURSE_ID, {
        idempotencyKey: 'link-privacy',
        expectedCourseVersion: COURSE_VERSION,
        anchorId: NEW_ANCHOR.id,
        role: CourseAnchorRole.WAYPOINT_PRIMARY,
        waypointId: WP.current,
      });

      const [{ data }] = mockPrisma.courseEvent.create.mock.calls[0] as any[];
      expect(data.snapshot).toEqual({ anchorRole: CourseAnchorRole.WAYPOINT_PRIMARY });
      expect(JSON.stringify(data)).not.toContain(NEW_ANCHOR.intentionText);
    });
  });

  describe('archived and completed courses', () => {
    it.each([CourseStatus.ARCHIVED, CourseStatus.COMPLETED])(
      'refuses to link an Anchor on a %s course',
      async status => {
        mockPrisma.course.findFirst.mockResolvedValue(
          courseRow({ status, currentWaypointId: null, anchorLinks: [] }),
        );

        await expect(
          courseService.linkAnchor(USER_ID, COURSE_ID, {
            idempotencyKey: `link-${status}`,
            expectedCourseVersion: COURSE_VERSION,
            anchorId: NEW_ANCHOR.id,
            role: CourseAnchorRole.WAYPOINT_PRIMARY,
            waypointId: WP.current,
          }),
        ).rejects.toMatchObject({ code: 'COURSE_NOT_ACTIVE', statusCode: 409 });
      },
    );
  });
});

// ── Skip ────────────────────────────────────────────────────────────────────

describe('Waypoint skip', () => {
  it('marks the waypoint skipped and advances the pointer once', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());

    await courseService.skipWaypoint(USER_ID, COURSE_ID, WP.current, {
      idempotencyKey: 'skip-1',
      expectedCourseVersion: COURSE_VERSION,
    });

    expect(mockPrisma.waypoint.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: WP.current },
        data: expect.objectContaining({ skippedAt: expect.any(Date) }),
      }),
    );
    expect(mockPrisma.course.update).toHaveBeenCalledTimes(1);
    const events = mockPrisma.courseEvent.create.mock.calls.map(
      ([args]: any) => args.data.eventType,
    );
    expect(events).toEqual([CourseEventType.WAYPOINT_SKIPPED]);
  });

  it('replays a committed skip without a second mutation', async () => {
    mockPrisma.courseEvent.findUnique.mockResolvedValue({
      id: 'event-skip',
      userId: USER_ID,
      courseId: COURSE_ID,
      waypointId: WP.current,
      eventType: CourseEventType.WAYPOINT_SKIPPED,
      idempotencyKey: 'chart:waypoint-transition:skip-1',
    });
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());

    await courseService.skipWaypoint(USER_ID, COURSE_ID, WP.current, {
      idempotencyKey: 'skip-1',
      expectedCourseVersion: COURSE_VERSION,
    });

    expect(mockPrisma.courseEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.course.update).not.toHaveBeenCalled();
  });

  it('refuses to skip a non-current waypoint', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    await expect(
      courseService.skipWaypoint(USER_ID, COURSE_ID, WP.fiveK, {
        idempotencyKey: 'skip-upcoming',
        expectedCourseVersion: COURSE_VERSION,
      }),
    ).rejects.toMatchObject({ code: 'WAYPOINT_NOT_CURRENT', statusCode: 409 });
  });
});

// ── Ownership and error codes ───────────────────────────────────────────────

describe('Ownership and error codes', () => {
  it('scopes every read and mutation by the authenticated user', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);

    await expect(courseService.getCourse(USER_ID, COURSE_ID)).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
      statusCode: 404,
    });
    expect(mockPrisma.course.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: COURSE_ID, userId: USER_ID, deletedAt: null }),
      }),
    );
  });

  it('returns COURSE_NOT_FOUND rather than leaking another account’s course', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);
    await expect(
      courseService.completeWaypoint('other-user', COURSE_ID, WP.current, {
        idempotencyKey: 'complete-other',
        expectedCourseVersion: COURSE_VERSION,
      }),
    ).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND', statusCode: 404 });
    expect(mockPrisma.course.update).not.toHaveBeenCalled();
  });

  it('returns WAYPOINT_NOT_FOUND for a waypoint outside the course', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
    await expect(
      courseService.completeWaypoint(USER_ID, COURSE_ID, 'wp-does-not-exist', {
        idempotencyKey: 'complete-unknown-wp',
        expectedCourseVersion: COURSE_VERSION,
      }),
    ).rejects.toMatchObject({ code: 'WAYPOINT_NOT_FOUND', statusCode: 404 });
  });

  it('returns COURSE_NOT_ACTIVE for completed and archived courses', async () => {
    for (const status of [CourseStatus.COMPLETED, CourseStatus.ARCHIVED]) {
      jest.clearAllMocks();
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma),
      );
      mockPrisma.courseEvent.findUnique.mockResolvedValue(null);
      mockPrisma.course.findFirst.mockResolvedValue(
        courseRow({ status, currentWaypointId: null }),
      );

      await expect(
        courseService.completeWaypoint(USER_ID, COURSE_ID, WP.current, {
          idempotencyKey: `complete-${status}`,
          expectedCourseVersion: COURSE_VERSION,
        }),
      ).rejects.toMatchObject({ code: 'COURSE_NOT_ACTIVE', statusCode: 409 });
    }
  });

  it('treats a soft-deleted course as not found', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);
    await expect(courseService.getCourse(USER_ID, COURSE_ID)).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
    });
  });
});

// ── Course Log pagination ───────────────────────────────────────────────────

describe('Course Log pagination and joins', () => {
  const event = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    userId: USER_ID,
    courseId: COURSE_ID,
    waypointId: WP.current,
    eventType: CourseEventType.WAYPOINT_REACHED,
    sourceEntityType: 'Waypoint',
    sourceEntityId: WP.current,
    snapshot: { waypointTitle: '1K USERS' },
    occurredAt: NOW,
    recordedAt: NOW,
    idempotencyKey: `key-${id}`,
    ...overrides,
  });

  beforeEach(() => {
    mockPrisma.course.findFirst.mockResolvedValue(courseRow());
  });

  it('requests one more row than the page size to detect hasMore', async () => {
    mockPrisma.courseEvent.findMany.mockResolvedValue([event('e1'), event('e2')]);
    const result = await courseService.listLog(USER_ID, COURSE_ID, 1);

    expect(mockPrisma.courseEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, courseId: COURSE_ID },
        take: 2,
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({ nextCursor: 'e1', hasMore: true });
  });

  it('reports the end of the log with a null cursor', async () => {
    mockPrisma.courseEvent.findMany.mockResolvedValue([event('e1')]);
    const result = await courseService.listLog(USER_ID, COURSE_ID, 25);

    expect(result.pagination).toEqual({ nextCursor: null, hasMore: false });
  });

  it('skips the cursor row so a page is never returned twice', async () => {
    mockPrisma.courseEvent.findMany.mockResolvedValue([]);
    await courseService.listLog(USER_ID, COURSE_ID, 25, 'e1');

    expect(mockPrisma.courseEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'e1' }, skip: 1 }),
    );
  });

  it('orders deterministically by recordedAt then id', async () => {
    mockPrisma.courseEvent.findMany.mockResolvedValue([]);
    await courseService.listLog(USER_ID, COURSE_ID, 25);

    const [args] = mockPrisma.courseEvent.findMany.mock.calls[0] as any[];
    // The id tiebreaker is what keeps two events in the same millisecond stable.
    expect(args.orderBy).toEqual([{ recordedAt: 'desc' }, { id: 'desc' }]);
  });

  it('joins a reflection, a practice session, and an anchor link by source entity', async () => {
    mockPrisma.courseEvent.findMany.mockResolvedValue([
      event('e-reflection', {
        eventType: CourseEventType.REFLECTION_ADDED,
        sourceEntityType: 'Reflection',
        sourceEntityId: 'reflection-1',
        snapshot: { reflectionPromptType: 'WAYPOINT_COMPLETION' },
      }),
      event('e-practice', {
        eventType: CourseEventType.PRACTICE_COMPLETED,
        sourceEntityType: 'PracticeSession',
        sourceEntityId: 'session-1',
        snapshot: { practiceMode: 'focus', durationSeconds: 60 },
      }),
      event('e-link', {
        eventType: CourseEventType.WAYPOINT_ANCHOR_LINKED,
        sourceEntityType: 'CourseAnchorLink',
        sourceEntityId: 'link-current',
        snapshot: { anchorRole: 'WAYPOINT_PRIMARY' },
      }),
    ]);
    mockPrisma.reflection.findMany.mockResolvedValue([
      {
        id: 'reflection-1',
        promptType: 'WAYPOINT_COMPLETION',
        body: null,
        structuredContent: { whatHelped: 'private' },
        moodAfter: 'FOCUSED',
        deletedAt: null,
      },
    ]);
    mockPrisma.practiceSession.findMany.mockResolvedValue([
      { id: 'session-1', practiceMode: 'focus', completedDurationSeconds: 60 },
    ]);
    mockPrisma.courseAnchorLink.findMany.mockResolvedValue([
      { ...anchorLinkRow(), anchor: { id: 'anchor-current', isArchived: false } },
    ]);

    const result = await courseService.listLog(USER_ID, COURSE_ID, 25);
    const byId = new Map(result.data.map(entry => [entry.id, entry]));

    expect(byId.get('e-reflection')?.reflection?.id).toBe('reflection-1');
    expect(byId.get('e-practice')?.practiceSession).toEqual({
      id: 'session-1',
      practiceMode: 'focus',
      completedDurationSeconds: 60,
    });
    expect(byId.get('e-link')?.anchorLink?.id).toBe('link-current');
    // Each join is scoped to the authenticated user.
    expect(mockPrisma.reflection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID }) }),
    );
    expect(mockPrisma.practiceSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID }) }),
    );
  });

  it('hides a soft-deleted reflection but keeps its event', async () => {
    mockPrisma.courseEvent.findMany.mockResolvedValue([
      event('e-deleted', {
        eventType: CourseEventType.REFLECTION_ADDED,
        sourceEntityType: 'Reflection',
        sourceEntityId: 'reflection-gone',
        snapshot: { reflectionPromptType: 'WAYPOINT_COMPLETION' },
      }),
    ]);
    mockPrisma.reflection.findMany.mockResolvedValue([
      {
        id: 'reflection-gone',
        promptType: 'WAYPOINT_COMPLETION',
        body: 'tombstoned text',
        structuredContent: null,
        moodAfter: null,
        deletedAt: NOW,
      },
    ]);

    const result = await courseService.listLog(USER_ID, COURSE_ID, 25);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].reflection).toBeNull();
    // The tombstoned body must not survive in the projection.
    expect(JSON.stringify(result.data)).not.toContain('tombstoned text');
  });

  it('drops a snapshot containing an unapproved key', async () => {
    mockPrisma.courseEvent.findMany.mockResolvedValue([
      event('e-unsafe', { snapshot: { waypointTitle: 'ok', destinationText: 'leak' } }),
    ]);
    const result = await courseService.listLog(USER_ID, COURSE_ID, 25);

    expect(result.data[0].snapshot).toBeNull();
    expect(JSON.stringify(result.data)).not.toContain('leak');
  });

  it('refuses to list the log for a course the user does not own', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);
    await expect(courseService.listLog(USER_ID, COURSE_ID, 25)).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
      statusCode: 404,
    });
    expect(mockPrisma.courseEvent.findMany).not.toHaveBeenCalled();
  });
});
