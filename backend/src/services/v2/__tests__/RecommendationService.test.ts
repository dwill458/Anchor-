const mockPrisma = {
  anchor: {
    findFirst: jest.fn(),
  },
  courseAnchorLink: {
    findMany: jest.fn(),
  },
  recommendationSignalAck: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockGetAnchorVision = jest.fn();
const mockGetDelta7d = jest.fn().mockResolvedValue(null);

jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../VisionService', () => ({
  visionService: {
    getAnchorVision: (...args: unknown[]) => mockGetAnchorVision(...args),
  },
}));
jest.mock('../ThreadStrengthService', () => ({
  threadStrengthService: { getDelta7d: (...args: unknown[]) => mockGetDelta7d(...args) },
}));

import { buildCourseSignalKey, recommendationService } from '../RecommendationService';

describe('RecommendationService (CCR-2 & Recommended Today)', () => {
  const USER_ID = 'user-test-1';
  const ANCHOR_ID = 'anchor-test-1';
  const COURSE_ID = 'course-test-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Signal detection and priority', () => {
    it('waypoint reached event produces pending waypoint_reached signal', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValueOnce({
        id: ANCHOR_ID,
        intentionText: 'Launch beta product',
        category: 'career',
        intentionCompletedAt: null,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      mockPrisma.recommendationSignalAck.findMany.mockResolvedValueOnce([]); // no acks

      const linkDate = new Date('2026-08-01T12:00:00.000Z');
      const eventDate = new Date('2026-08-05T14:00:00.000Z');

      mockPrisma.courseAnchorLink.findMany.mockResolvedValueOnce([
        {
          id: 'link-1',
          userId: USER_ID,
          courseId: COURSE_ID,
          anchorId: ANCHOR_ID,
          linkedAt: linkDate,
          unlinkedAt: null,
          course: {
            id: COURSE_ID,
            destinationText: 'Launch product to 100 users',
            events: [
              {
                id: 'evt-wp-1',
                eventType: 'WAYPOINT_REACHED',
                waypointId: 'wp-1',
                occurredAt: eventDate,
                snapshot: { waypointTitle: 'Complete MVP Wireframes' },
                waypoint: { title: 'Complete MVP Wireframes' },
              },
            ],
          },
        },
      ]);
      mockGetAnchorVision.mockResolvedValueOnce(null);

      const ctx = await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);

      expect(ctx.completionSignal).not.toBeNull();
      expect(ctx.completionSignal?.type).toBe('waypoint_reached');
      expect((ctx.completionSignal as any).waypointTitle).toBe('Complete MVP Wireframes');
      expect(ctx.recommendation.action).toBe('Release');
      expect(ctx.recommendation.reason).toBe('waypoint_reached');
    });

    it('course completion produces destination_reached signal and takes priority over waypoint signal', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValueOnce({
        id: ANCHOR_ID,
        intentionText: 'Launch beta product',
        category: 'career',
        intentionCompletedAt: null,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      mockPrisma.recommendationSignalAck.findMany.mockResolvedValueOnce([]); // no acks

      const linkDate = new Date('2026-08-01T12:00:00.000Z');

      mockPrisma.courseAnchorLink.findMany.mockResolvedValueOnce([
        {
          id: 'link-1',
          userId: USER_ID,
          courseId: COURSE_ID,
          anchorId: ANCHOR_ID,
          linkedAt: linkDate,
          unlinkedAt: null,
          course: {
            id: COURSE_ID,
            destinationText: 'Launch product to 100 users',
            events: [
              {
                id: 'evt-wp-2',
                eventType: 'WAYPOINT_REACHED',
                waypointId: 'wp-2',
                occurredAt: new Date('2026-08-04T10:00:00.000Z'),
                snapshot: { waypointTitle: 'QA Testing' },
              },
              {
                id: 'evt-course-comp',
                eventType: 'COURSE_COMPLETED',
                waypointId: null,
                occurredAt: new Date('2026-08-05T10:00:00.000Z'),
                snapshot: null,
              },
            ],
          },
        },
      ]);
      mockGetAnchorVision.mockResolvedValueOnce(null);

      const ctx = await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);

      expect(ctx.completionSignal).not.toBeNull();
      expect(ctx.completionSignal?.type).toBe('destination_reached');
      expect((ctx.completionSignal as any).destinationTitle).toBe('Launch product to 100 users');
      expect(ctx.recommendation.action).toBe('Release');
    });

    it('intention completion produces intention_completed signal when no course signals exist', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValueOnce({
        id: ANCHOR_ID,
        intentionText: 'I am healthy and vibrant',
        category: 'health',
        intentionCompletedAt: new Date('2026-09-01T10:00:00.000Z'),
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      mockPrisma.recommendationSignalAck.findMany.mockResolvedValueOnce([]); // no acks
      mockPrisma.courseAnchorLink.findMany.mockResolvedValueOnce([]); // no linked course events
      mockGetAnchorVision.mockResolvedValueOnce(null);

      const ctx = await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);

      expect(ctx.completionSignal).not.toBeNull();
      expect(ctx.completionSignal?.type).toBe('intention_completed');
      expect((ctx.completionSignal as any).intentionText).toBe('I am healthy and vibrant');
      expect(ctx.recommendation.action).toBe('Release');
    });
  });

  describe('Consumption and Acknowledgement Semantics', () => {
    it('fetching context does NOT consume the signal', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValue({
        id: ANCHOR_ID,
        intentionText: 'Intention',
        category: 'health',
        intentionCompletedAt: new Date('2026-09-01T10:00:00.000Z'),
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      mockPrisma.recommendationSignalAck.findMany.mockResolvedValue([]);
      mockPrisma.courseAnchorLink.findMany.mockResolvedValue([]);
      mockGetAnchorVision.mockResolvedValue(null);

      await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);
      await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);

      // Verify no ack records were created merely by reading the context
      expect(mockPrisma.recommendationSignalAck.create).not.toHaveBeenCalled();
    });

    it('repeated context reads return the same pending signal', async () => {
      const anchor = {
        id: ANCHOR_ID,
        intentionText: 'Intention',
        category: 'career',
        intentionCompletedAt: null,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      };
      const link = {
        id: 'link-1',
        userId: USER_ID,
        courseId: COURSE_ID,
        anchorId: ANCHOR_ID,
        linkedAt: new Date('2026-08-01T00:00:00.000Z'),
        unlinkedAt: null,
        course: {
          id: COURSE_ID,
          destinationText: 'Dest',
          events: [
            {
              id: 'evt-repeat',
              eventType: 'WAYPOINT_REACHED',
              waypointId: 'wp-repeat',
              occurredAt: new Date('2026-08-02T00:00:00.000Z'),
              snapshot: { waypointTitle: 'Repeatable signal' },
            },
          ],
        },
      };
      mockPrisma.anchor.findFirst.mockResolvedValue(anchor);
      mockPrisma.recommendationSignalAck.findMany.mockResolvedValue([]);
      mockPrisma.courseAnchorLink.findMany.mockResolvedValue([link]);
      mockGetAnchorVision.mockResolvedValue(null);

      const first = await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);
      const second = await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);

      expect(second.completionSignal?.id).toBe(first.completionSignal?.id);
      expect(mockPrisma.recommendationSignalAck.create).not.toHaveBeenCalled();
    });

    it('explicit acknowledgement consumes the signal and prevents it from reappearing', async () => {
      const signalKey = buildCourseSignalKey({
        userId: USER_ID,
        courseEventId: 'evt-wp-1',
        courseId: COURSE_ID,
        waypointId: 'wp-1',
        signalType: 'waypoint_reached',
      });
      mockPrisma.recommendationSignalAck.findUnique.mockResolvedValueOnce(null);
      mockPrisma.recommendationSignalAck.create.mockResolvedValueOnce({
        id: 'ack-1',
        userId: USER_ID,
        signalKey,
        signalType: 'waypoint_reached',
        acknowledgedAt: new Date(),
      });

      const ackResult = await recommendationService.acknowledgeSignal(
        USER_ID,
        signalKey,
        'waypoint_reached'
      );
      expect(ackResult.success).toBe(true);
      expect(ackResult.signalKey).toBe(signalKey);

      // Now query context: ackSet contains signalKey
      mockPrisma.anchor.findFirst.mockResolvedValueOnce({
        id: ANCHOR_ID,
        intentionText: 'Intention',
        category: 'career',
        intentionCompletedAt: null,
        createdAt: new Date(),
      });
      mockPrisma.recommendationSignalAck.findMany.mockResolvedValueOnce([{ signalKey }]);
      mockPrisma.courseAnchorLink.findMany.mockResolvedValueOnce([
        {
          id: 'link-1',
          userId: USER_ID,
          courseId: COURSE_ID,
          anchorId: ANCHOR_ID,
          linkedAt: new Date('2026-08-01T00:00:00.000Z'),
          unlinkedAt: null,
          course: {
            id: COURSE_ID,
            destinationText: 'Dest',
            events: [
              {
                id: 'evt-wp-1',
                eventType: 'WAYPOINT_REACHED',
                waypointId: 'wp-1',
                occurredAt: new Date('2026-08-02T00:00:00.000Z'),
                snapshot: { waypointTitle: 'Done WP' },
              },
            ],
          },
        },
      ]);
      mockGetAnchorVision.mockResolvedValueOnce(null);

      const ctx = await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);
      expect(ctx.completionSignal).toBeNull();
      // Falls back to Focus when no signals and no vision
      expect(ctx.recommendation.action).toBe('Focus');
    });

    it('duplicate acknowledgement is idempotent and does not create another row', async () => {
      const signalKey = buildCourseSignalKey({
        userId: USER_ID,
        courseEventId: 'evt-duplicate',
        courseId: COURSE_ID,
        waypointId: 'wp-duplicate',
        signalType: 'waypoint_reached',
      });
      const acknowledgedAt = new Date('2026-09-08T00:00:00.000Z');
      mockPrisma.recommendationSignalAck.findUnique.mockResolvedValueOnce({
        signalKey,
        acknowledgedAt,
      });

      const result = await recommendationService.acknowledgeSignal(
        USER_ID,
        signalKey,
        'waypoint_reached'
      );

      expect(result).toEqual({
        success: true,
        signalKey,
        acknowledgedAt: acknowledgedAt.toISOString(),
      });
      expect(mockPrisma.recommendationSignalAck.create).not.toHaveBeenCalled();
    });

    it('a later CourseEvent produces a distinct pending signal after the prior one is acknowledged', async () => {
      const oldSignalKey = buildCourseSignalKey({
        userId: USER_ID,
        courseEventId: 'evt-old',
        courseId: COURSE_ID,
        waypointId: 'wp-old',
        signalType: 'waypoint_reached',
      });
      const newSignalKey = buildCourseSignalKey({
        userId: USER_ID,
        courseEventId: 'evt-new',
        courseId: COURSE_ID,
        waypointId: 'wp-new',
        signalType: 'waypoint_reached',
      });
      mockPrisma.anchor.findFirst.mockResolvedValueOnce({
        id: ANCHOR_ID,
        intentionText: 'Intention',
        category: 'career',
        intentionCompletedAt: null,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      mockPrisma.recommendationSignalAck.findMany.mockResolvedValueOnce([
        { signalKey: oldSignalKey },
      ]);
      mockPrisma.courseAnchorLink.findMany.mockResolvedValueOnce([
        {
          id: 'link-1',
          userId: USER_ID,
          courseId: COURSE_ID,
          anchorId: ANCHOR_ID,
          linkedAt: new Date('2026-08-01T00:00:00.000Z'),
          unlinkedAt: null,
          course: {
            id: COURSE_ID,
            destinationText: 'Dest',
            events: [
              {
                id: 'evt-old',
                eventType: 'WAYPOINT_REACHED',
                waypointId: 'wp-old',
                occurredAt: new Date('2026-08-02T00:00:00.000Z'),
                snapshot: { waypointTitle: 'Old waypoint' },
              },
              {
                id: 'evt-new',
                eventType: 'WAYPOINT_REACHED',
                waypointId: 'wp-new',
                occurredAt: new Date('2026-08-03T00:00:00.000Z'),
                snapshot: { waypointTitle: 'New waypoint' },
              },
            ],
          },
        },
      ]);
      mockGetAnchorVision.mockResolvedValueOnce(null);

      const ctx = await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);

      expect(ctx.completionSignal?.id).toBe(newSignalKey);
      expect(ctx.completionSignal?.id).not.toBe(oldSignalKey);
    });

    it('unrelated historical events (before anchor was linked) do not produce a recommendation signal', async () => {
      const linkDate = new Date('2026-08-10T12:00:00.000Z');
      const priorEventDate = new Date('2026-08-05T10:00:00.000Z'); // BEFORE linkDate

      mockPrisma.anchor.findFirst.mockResolvedValueOnce({
        id: ANCHOR_ID,
        intentionText: 'Intention',
        category: 'career',
        intentionCompletedAt: null,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      mockPrisma.recommendationSignalAck.findMany.mockResolvedValueOnce([]);
      mockPrisma.courseAnchorLink.findMany.mockResolvedValueOnce([
        {
          id: 'link-1',
          userId: USER_ID,
          courseId: COURSE_ID,
          anchorId: ANCHOR_ID,
          linkedAt: linkDate,
          unlinkedAt: null,
          course: {
            id: COURSE_ID,
            destinationText: 'Dest',
            events: [
              {
                id: 'evt-old-wp',
                eventType: 'WAYPOINT_REACHED',
                waypointId: 'wp-old',
                occurredAt: priorEventDate,
                snapshot: { waypointTitle: 'Prior WP' },
              },
            ],
          },
        },
      ]);
      mockGetAnchorVision.mockResolvedValueOnce(null);

      const ctx = await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);
      expect(ctx.completionSignal).toBeNull();
      expect(ctx.recommendation.action).toBe('Focus');
    });
  });

  describe('First-Match-Wins Evaluation Order', () => {
    it('selects Visualize when Vision exists and has NOT been seen today', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValueOnce({
        id: ANCHOR_ID,
        intentionText: 'Intention',
        category: 'career',
        intentionCompletedAt: null,
        createdAt: new Date(),
      });
      mockPrisma.recommendationSignalAck.findMany.mockResolvedValueOnce([]);
      mockPrisma.courseAnchorLink.findMany.mockResolvedValueOnce([]);
      mockGetAnchorVision.mockResolvedValueOnce({
        id: 'vis-1',
        status: 'ACTIVE',
        seenToday: false,
      });

      const ctx = await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);
      expect(ctx.completionSignal).toBeNull();
      expect(ctx.vision.exists).toBe(true);
      expect(ctx.vision.seenToday).toBe(false);
      expect(ctx.recommendation.action).toBe('Visualize');
      expect(ctx.recommendation.reason).toBe('unseen_vision');
    });

    it('falls back to Focus when Vision exists but HAS been seen today', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValueOnce({
        id: ANCHOR_ID,
        intentionText: 'Intention',
        category: 'career',
        intentionCompletedAt: null,
        createdAt: new Date(),
      });
      mockPrisma.recommendationSignalAck.findMany.mockResolvedValueOnce([]);
      mockPrisma.courseAnchorLink.findMany.mockResolvedValueOnce([]);
      mockGetAnchorVision.mockResolvedValueOnce({
        id: 'vis-1',
        status: 'ACTIVE',
        seenToday: true,
      });

      const ctx = await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);
      expect(ctx.completionSignal).toBeNull();
      expect(ctx.vision.exists).toBe(true);
      expect(ctx.vision.seenToday).toBe(true);
      expect(ctx.recommendation.action).toBe('Focus');
      expect(ctx.recommendation.reason).toBe('daily_focus');
    });

    it('documents THREAD_DELTA7D_BLOCKER in thread context', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValueOnce({
        id: ANCHOR_ID,
        intentionText: 'Intention',
        category: 'career',
        intentionCompletedAt: null,
        createdAt: new Date(),
      });
      mockPrisma.recommendationSignalAck.findMany.mockResolvedValueOnce([]);
      mockPrisma.courseAnchorLink.findMany.mockResolvedValueOnce([]);
      mockGetAnchorVision.mockResolvedValueOnce(null);

      const ctx = await recommendationService.getRecommendationContext(USER_ID, ANCHOR_ID);
      expect(ctx.thread.delta7d).toBeNull();
      expect(ctx.thread.delta7dStatus).toBe('UNAVAILABLE');
      expect(ctx.thread.status).toBe('UNAVAILABLE');
      expect(ctx.thread.blockerReason).toContain('THREAD_DELTA7D_BLOCKER');
    });
  });

  describe('Locked recommendation matrix', () => {
    const evaluate = (
      completionSignal: any,
      vision: { exists: boolean; seenToday: boolean },
      delta7d: number | null
    ) => recommendationService.evaluateFirstMatchRecommendation(completionSignal, vision, delta7d);

    it.each([
      ['intention_completed', { id: 'i', type: 'intention_completed' }],
      ['waypoint_reached', { id: 'w', type: 'waypoint_reached' }],
      ['destination_reached', { id: 'd', type: 'destination_reached' }],
    ])('%s produces Release', (_type, signal) => {
      expect(evaluate(signal, { exists: false, seenToday: false }, null).action).toBe('Release');
    });

    it('unseen Vision produces Visualize before a negative delta7d', () => {
      expect(evaluate(null, { exists: true, seenToday: false }, -1)).toMatchObject({
        action: 'Visualize',
        reason: 'unseen_vision',
      });
    });

    it('seen Vision plus delta7d = -1 produces Deep Prime', () => {
      expect(evaluate(null, { exists: true, seenToday: true }, -1).action).toBe('Deep Prime');
    });

    it('no Vision plus delta7d = -1 produces Deep Prime', () => {
      expect(evaluate(null, { exists: false, seenToday: false }, -1).action).toBe('Deep Prime');
    });

    it.each([
      ['delta7d unavailable', null],
      ['delta7d = 0', 0],
      ['delta7d > 0', 5],
    ])('%s produces Focus when no higher rule matches', (_label, delta7d) => {
      expect(evaluate(null, { exists: false, seenToday: false }, delta7d).action).toBe('Focus');
    });

    it('strength=20 and delta7d=null produces Focus', () => {
      // The evaluator intentionally has no absolute-strength input. A strength
      // of 20 therefore has no path to Deep Prime without delta7d < 0.
      expect(evaluate(null, { exists: false, seenToday: false }, null).action).toBe('Focus');
    });

    it('strength=20 and delta7d=+5 produces Focus', () => {
      // Same contract: strength=20 is ignored; only the injected trend can
      // select Deep Prime, and +5 does not match it.
      expect(evaluate(null, { exists: false, seenToday: false }, 5).action).toBe('Focus');
    });

    it('completion signal wins over unseen Vision', () => {
      expect(
        evaluate({ id: 'w', type: 'waypoint_reached' }, { exists: true, seenToday: false }, -1)
          .action
      ).toBe('Release');
    });

    it('no completion and unseen Vision wins over negative delta7d', () => {
      expect(evaluate(null, { exists: true, seenToday: false }, -1).action).toBe('Visualize');
    });

    it('negative delta7d alone produces Deep Prime', () => {
      expect(evaluate(null, { exists: false, seenToday: false }, -1).action).toBe('Deep Prime');
    });

    it('no matching rule produces Focus', () => {
      expect(evaluate(null, { exists: false, seenToday: false }, null).action).toBe('Focus');
    });
  });

  describe('Deterministic signal keys', () => {
    it('includes every stable Course signal identity component', () => {
      const key = buildCourseSignalKey({
        userId: USER_ID,
        courseEventId: 'event-1',
        courseId: COURSE_ID,
        waypointId: 'waypoint-1',
        signalType: 'waypoint_reached',
      });

      expect(key).toContain('user=user-test-1');
      expect(key).toContain('course=course-test-1');
      expect(key).toContain('event=event-1');
      expect(key).toContain('waypoint=waypoint-1');
      expect(key).toContain('type=waypoint_reached');
      expect(key).toBe(
        buildCourseSignalKey({
          userId: USER_ID,
          courseEventId: 'event-1',
          courseId: COURSE_ID,
          waypointId: 'waypoint-1',
          signalType: 'waypoint_reached',
        })
      );
    });
  });
});
