import { AppError } from '../../api/middleware/errorHandler';
import { COURSE_EVENT_MESSAGES, CourseEventService } from '../CourseEventService';

describe('CourseEventService', () => {
  const service = new CourseEventService();
  let tx: any;

  it('defines the approved user-facing cancellation meaning', () => {
    expect(COURSE_EVENT_MESSAGES.WAYPOINT_CANCELLED).toBe('Waypoint removed from the course.');
  });

  beforeEach(() => {
    tx = {
      courseEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'event-1',
          userId: 'user-1',
          courseId: 'course-1',
          eventType: 'COURSE_CREATED',
        }),
      },
    };
  });

  it('persists only the allowlisted snapshot fields', async () => {
    await service.append(tx, {
      userId: 'user-1',
      courseId: 'course-1',
      eventType: 'COURSE_CREATED',
      snapshot: { waypointTitle: 'First step', durationSeconds: 30 },
      idempotencyKey: 'event-key-1',
    });

    expect(tx.courseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshot: { waypointTitle: 'First step', durationSeconds: 30 },
        }),
      })
    );
  });

  it('rejects private or oversized snapshot content', async () => {
    await expect(
      service.append(tx, {
        userId: 'user-1',
        courseId: 'course-1',
        eventType: 'COURSE_CREATED',
        snapshot: { body: 'private reflection' } as any,
        idempotencyKey: 'event-key-2',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(
      service.append(tx, {
        userId: 'user-1',
        courseId: 'course-1',
        eventType: 'COURSE_CREATED',
        snapshot: { waypointTitle: 'x'.repeat(600) },
        idempotencyKey: 'event-key-3',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('replays the same idempotency key and rejects cross-event reuse', async () => {
    const existing = {
      id: 'event-1',
      userId: 'user-1',
      courseId: 'course-1',
      eventType: 'COURSE_CREATED',
    };
    tx.courseEvent.findUnique.mockResolvedValue(existing);
    await expect(
      service.append(tx, {
        userId: 'user-1',
        courseId: 'course-1',
        eventType: 'COURSE_CREATED',
        idempotencyKey: 'same-key',
      })
    ).resolves.toBe(existing);
    expect(tx.courseEvent.create).not.toHaveBeenCalled();

    tx.courseEvent.findUnique.mockResolvedValue({ ...existing, eventType: 'COURSE_ARCHIVED' });
    await expect(
      service.append(tx, {
        userId: 'user-1',
        courseId: 'course-1',
        eventType: 'COURSE_CREATED',
        idempotencyKey: 'same-key',
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
});
