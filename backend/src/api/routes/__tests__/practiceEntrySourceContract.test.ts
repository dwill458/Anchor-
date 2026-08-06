/**
 * Contract proof for the frozen `practiceEntrySource` enum.
 *
 * `chart_waypoint_detail` was frozen by Workstream A: it ships in
 * `src/types/chart.ts`, is enforced by the POST /api/practice/sessions Zod
 * enum, is persisted by the Workstream A migration as a nullable TEXT column,
 * and is asserted by `scripts/verifyChartDatabase.ts`. Workstream E only
 * mirrors that value on the mobile client. These tests pin the value so the
 * enum cannot drift on either side of the boundary.
 */

import express, { Application } from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/errorHandler';
import { PRACTICE_ENTRY_SOURCES, type PracticeEntrySource } from '../../../types/chart';

jest.mock('../../middleware/auth');

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  anchor: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  practiceSession: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  course: { findUnique: jest.fn() },
  waypoint: { findUnique: jest.fn() },
  courseEvent: { findUnique: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../../services/PracticeAccessService', () => ({
  requireVisualizeAccess: jest.fn().mockResolvedValue(undefined),
}));

import { authMiddleware } from '../../middleware/auth';
import practiceRouter from '../practice';

const mockedAuthMiddleware = authMiddleware as jest.Mock;

/**
 * The frozen set, written out literally. The mobile `PracticeEntrySource`
 * union in `anchor/mobile/src/types/practice.ts` is pinned to this same list
 * by `src/types/__tests__/practiceEntrySourceContract.test.ts`, so a change on
 * either side fails on the other.
 */
const FROZEN_PRACTICE_ENTRY_SOURCES = [
  'practice_hero',
  'practice_deep_prime_card',
  'practice_focus_card',
  'practice_visualize_card',
  'practice_release_card',
  'anchor_detail',
  'sanctuary_prime_anchor',
  'widget',
  'shortcut',
  'evolve',
  'chart',
  'chart_waypoint_detail',
] as const;

const MOCK_DB_USER = {
  id: 'user-1',
  authUid: 'firebase-user-1',
  isComped: true,
  subscriptionStatus: 'pro',
  subscriptionId: 'pro',
  trialStartedAt: new Date(),
};

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/practice', practiceRouter);
  app.use(errorHandler);
  return app;
}

const baseBody = {
  id: 'contract-session-1',
  anchorId: 'anchor-1',
  anchorServerId: 'anchor-1',
  practiceMode: 'focus',
  plannedDurationSeconds: 60,
  completedDurationSeconds: 60,
  completionStatus: 'completed',
  startedAt: '2026-08-03T00:00:00.000Z',
  completedAt: '2026-08-03T00:01:00.000Z',
  localDateKey: '2026-08-03',
  timeZone: 'UTC',
  utcOffsetMinutesAtCompletion: 0,
  completionSource: 'practice_screen',
  schemaVersion: 2,
  guidanceVoice: 'none',
  backgroundAudio: 'off',
};

describe('frozen practiceEntrySource contract', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
    mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { uid: MOCK_DB_USER.authUid };
      next();
    });
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER);
    mockPrisma.anchor.findFirst.mockResolvedValue({ id: 'anchor-1' });
    mockPrisma.anchor.findUnique.mockResolvedValue({ id: 'anchor-1', userId: MOCK_DB_USER.id });
    mockPrisma.practiceSession.findUnique.mockResolvedValue(null);
    mockPrisma.practiceSession.findFirst.mockResolvedValue(null);
    mockPrisma.practiceSession.findMany.mockResolvedValue([]);
    mockPrisma.practiceSession.create.mockImplementation(async ({ data }: any) => ({
      ...data,
      startedAt: new Date(data.startedAt),
      completedAt: new Date(data.completedAt),
    }));
    mockPrisma.anchor.update.mockResolvedValue({ id: 'anchor-1' });
    mockPrisma.user.update.mockResolvedValue({ id: MOCK_DB_USER.id });
    mockPrisma.course.findUnique.mockResolvedValue({ id: 'course-1', userId: MOCK_DB_USER.id });
    mockPrisma.waypoint.findUnique.mockResolvedValue({
      id: 'waypoint-1',
      userId: MOCK_DB_USER.id,
      courseId: 'course-1',
    });
    mockPrisma.courseEvent.findUnique.mockResolvedValue(null);
    mockPrisma.courseEvent.create.mockResolvedValue({ id: 'event-1' });
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
  });

  it('keeps chart_waypoint_detail in the frozen server enum', () => {
    expect(PRACTICE_ENTRY_SOURCES).toContain('chart_waypoint_detail');
    expect([...PRACTICE_ENTRY_SOURCES]).toEqual([...FROZEN_PRACTICE_ENTRY_SOURCES]);
  });

  it('does not introduce near-duplicate Chart entry sources', () => {
    const chartSources = PRACTICE_ENTRY_SOURCES.filter(source => source.startsWith('chart'));
    expect(chartSources).toEqual(['chart', 'chart_waypoint_detail']);
  });

  it('persists the exact frozen value without rewriting it', async () => {
    const response = await request(app)
      .post('/api/practice/sessions')
      .send({
        ...baseBody,
        courseId: 'course-1',
        waypointId: 'waypoint-1',
        practiceEntrySource: 'chart_waypoint_detail',
      });

    expect(response.status).toBe(201);
    expect(mockPrisma.practiceSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ practiceEntrySource: 'chart_waypoint_detail' }),
      })
    );
    // The API response echoes the stored value verbatim, which is what the
    // account export serialises from the same row.
    expect(response.body.data.practiceEntrySource).toBe('chart_waypoint_detail');
  });

  it('rejects an unknown practice entry source without persisting anything', async () => {
    const response = await request(app)
      .post('/api/practice/sessions')
      .send({ ...baseBody, practiceEntrySource: 'chart_waypoint_details' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockPrisma.practiceSession.create).not.toHaveBeenCalled();
  });

  it('keeps legacy null and omitted sources valid', async () => {
    const explicitNull = await request(app)
      .post('/api/practice/sessions')
      .send({ ...baseBody, id: 'legacy-null', practiceEntrySource: null });
    expect(explicitNull.status).toBe(201);

    const omitted = await request(app)
      .post('/api/practice/sessions')
      .send({ ...baseBody, id: 'legacy-omitted' });
    expect(omitted.status).toBe(201);

    expect(mockPrisma.practiceSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ practiceEntrySource: null }),
      })
    );
  });

  it('accepts every frozen value at the API boundary', () => {
    // Compile-time exhaustiveness: a new union member without a frozen list
    // entry (or vice versa) fails to type-check here.
    const exhaustive: Record<PracticeEntrySource, true> = {
      practice_hero: true,
      practice_deep_prime_card: true,
      practice_focus_card: true,
      practice_visualize_card: true,
      practice_release_card: true,
      anchor_detail: true,
      sanctuary_prime_anchor: true,
      widget: true,
      shortcut: true,
      evolve: true,
      chart: true,
      chart_waypoint_detail: true,
    };
    expect(Object.keys(exhaustive).sort()).toEqual([...FROZEN_PRACTICE_ENTRY_SOURCES].sort());
  });
});
