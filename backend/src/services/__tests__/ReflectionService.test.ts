const mockPrisma = {
  $transaction: jest.fn(),
  reflection: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  anchor: { findFirst: jest.fn() },
  practiceSession: { findUnique: jest.fn() },
  course: { findFirst: jest.fn() },
  waypoint: { findFirst: jest.fn() },
  courseEvent: { findUnique: jest.fn(), create: jest.fn() },
};

jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

import { reflectionService } from '../ReflectionService';

const baseReflection = {
  id: 'reflection-1',
  userId: 'user-1',
  source: 'MANUAL_COURSE',
  promptType: 'COURSE_STATUS',
  promptVersion: 1,
  body: 'A private note',
  structuredContent: null,
  moodBefore: null,
  moodAfter: null,
  practiceSessionId: null,
  anchorId: null,
  courseId: 'course-1',
  waypointId: null,
  aiConsentGrantedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  idempotencyKey: 'reflection-key',
  schemaVersion: 1,
};

describe('ReflectionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
    mockPrisma.reflection.findUnique.mockResolvedValue(null);
    mockPrisma.reflection.create.mockImplementation(async ({ data }: any) => ({
      ...baseReflection,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    mockPrisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
    mockPrisma.anchor.findFirst.mockResolvedValue({ id: 'anchor-1' });
    mockPrisma.courseEvent.findUnique.mockResolvedValue(null);
    mockPrisma.courseEvent.create.mockResolvedValue({ id: 'event-1' });
  });

  it('enforces exactly one content shape and preserves structured waypoint completions', async () => {
    await expect(
      reflectionService.create('user-1', {
        idempotencyKey: 'invalid',
        source: 'MANUAL_COURSE',
        promptType: 'COURSE_STATUS',
        promptVersion: 1,
        body: 'body',
        structuredContent: { whatHelped: 'also structured' },
        courseId: 'course-1',
      })
    ).rejects.toMatchObject({ code: 'REFLECTION_INVALID' });

    mockPrisma.waypoint.findFirst.mockResolvedValue({ id: 'waypoint-1' });
    const result = await reflectionService.create('user-1', {
      idempotencyKey: 'structured',
      source: 'WAYPOINT_COMPLETION',
      promptType: 'WAYPOINT_COMPLETION',
      promptVersion: 1,
      structuredContent: { whatHelped: 'The practice helped.' },
      courseId: 'course-1',
      waypointId: 'waypoint-1',
    });
    expect(result).toEqual(
      expect.objectContaining({ structuredContent: { whatHelped: 'The practice helped.' } })
    );
  });

  it('validates owned relationships and supports Anchor-release reflections', async () => {
    mockPrisma.anchor.findFirst.mockResolvedValue(null);
    await expect(
      reflectionService.create('user-1', {
        idempotencyKey: 'foreign-anchor',
        source: 'ANCHOR_RELEASE',
        promptType: 'WHAT_CAME_UP',
        promptVersion: 1,
        body: 'Release note',
        anchorId: 'foreign-anchor',
      })
    ).rejects.toMatchObject({ code: 'REFLECTION_INVALID' });

    mockPrisma.anchor.findFirst.mockResolvedValue({ id: 'anchor-1' });
    const result = await reflectionService.create('user-1', {
      idempotencyKey: 'release-note',
      source: 'ANCHOR_RELEASE',
      promptType: 'WHAT_CAME_UP',
      promptVersion: 1,
      body: 'Release note',
      anchorId: 'anchor-1',
    });
    expect(result).toEqual(expect.objectContaining({ anchorId: 'anchor-1' }));
    expect(mockPrisma.courseEvent.create).not.toHaveBeenCalled();
  });

  it('tombstones text and never resurrects it on an idempotent replay', async () => {
    mockPrisma.reflection.findFirst.mockResolvedValue(baseReflection);
    mockPrisma.reflection.updateMany.mockResolvedValue({ count: 1 });
    await reflectionService.delete('user-1', 'reflection-1');
    // The schema's content checks require exactly one content column to stay
    // populated and to match the prompt type, so a tombstone empties the text
    // in place. Nulling both columns is rejected by PostgreSQL outright.
    expect(mockPrisma.reflection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: '',
          structuredContent: expect.anything(),
          deletedAt: expect.any(Date),
        }),
      })
    );
    const [{ data }] = mockPrisma.reflection.updateMany.mock.calls[0];
    expect(JSON.stringify(data)).not.toContain('A private note');

    mockPrisma.reflection.findUnique.mockResolvedValue({
      ...baseReflection,
      body: '',
      structuredContent: null,
      deletedAt: new Date(),
    });
    const replay = await reflectionService.create('user-1', {
      idempotencyKey: 'reflection-key',
      source: 'MANUAL_COURSE',
      promptType: 'COURSE_STATUS',
      promptVersion: 1,
      body: 'the original private note',
      courseId: 'course-1',
    });
    expect(replay).toEqual(
      expect.objectContaining({ body: '', structuredContent: null, deletedAt: expect.anything() })
    );
    expect(mockPrisma.reflection.create).not.toHaveBeenCalled();
  });

  it('keeps reflection text out of the CourseEvent snapshot', async () => {
    await reflectionService.create('user-1', {
      idempotencyKey: 'manual-event',
      source: 'MANUAL_COURSE',
      promptType: 'COURSE_STATUS',
      promptVersion: 1,
      body: 'private course note',
      courseId: 'course-1',
    });
    expect(mockPrisma.courseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ snapshot: { reflectionPromptType: 'COURSE_STATUS' } }),
      })
    );
  });
});
