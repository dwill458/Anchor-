import express, { Application } from 'express';
import request from 'supertest';
import { AppError, errorHandler } from '../../middleware/errorHandler';

jest.mock('../../middleware/auth');

const mockPrisma = {
  user: { findUnique: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));

jest.mock('../../../config/chartFlags', () => ({
  requireChartEnabled: jest.fn(),
  requireChartWriteEnabled: jest.fn(),
  requireChartInitialized: jest.fn(),
}));

const mockCourseService = {
  initializeChartForUser: jest.fn(),
  listCourses: jest.fn(),
  getCourse: jest.fn(),
  listLog: jest.fn(),
  createCourse: jest.fn(),
  resolveForAnchor: jest.fn(),
  updateCourse: jest.fn(),
  archiveCourse: jest.fn(),
  restoreCourse: jest.fn(),
  softDeleteCourse: jest.fn(),
  addWaypoint: jest.fn(),
  editWaypoint: jest.fn(),
  reorderWaypoints: jest.fn(),
  completeWaypoint: jest.fn(),
  skipWaypoint: jest.fn(),
  cancelWaypoint: jest.fn(),
  linkAnchor: jest.fn(),
  unlinkAnchor: jest.fn(),
};
jest.mock('../../../services/CourseService', () => ({ courseService: mockCourseService }));

import { authMiddleware } from '../../middleware/auth';
import {
  requireChartEnabled,
  requireChartInitialized,
  requireChartWriteEnabled,
} from '../../../config/chartFlags';
import coursesRouter from '../courses';

const mockedAuth = authMiddleware as jest.Mock;
const mockedRequireChartEnabled = requireChartEnabled as jest.Mock;
const mockedRequireChartInitialized = requireChartInitialized as jest.Mock;
const mockedRequireChartWriteEnabled = requireChartWriteEnabled as jest.Mock;

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/courses', coursesRouter);
  app.use(errorHandler);
  return app;
}

describe('Chart course route boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { uid: 'firebase-user-1' };
      next();
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', chartSchemaVersion: 1 });
    mockedRequireChartEnabled.mockImplementation(() => undefined);
    mockedRequireChartWriteEnabled.mockImplementation(() => undefined);
    mockedRequireChartInitialized.mockImplementation((version: number) => {
      if (version !== 1)
        throw new AppError('Chart migration is required', 409, 'MIGRATION_REQUIRED');
    });
  });

  it('returns FEATURE_DISABLED while flags are off', async () => {
    mockedRequireChartEnabled.mockImplementation(() => {
      throw new AppError('Chart is currently disabled', 403, 'FEATURE_DISABLED');
    });
    const response = await request(buildApp()).get('/api/courses');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FEATURE_DISABLED');
  });

  it('returns an empty read with migrationRequired before initialization', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', chartSchemaVersion: 0 });
    const response = await request(buildApp()).get('/api/courses');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: [], migrationRequired: true });
    expect(mockCourseService.listCourses).not.toHaveBeenCalled();
  });

  it('fails writes closed before initialization and initializes without creating Chart rows', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', chartSchemaVersion: 0 });
    const blocked = await request(buildApp()).post('/api/courses').send({
      idempotencyKey: 'course-key',
      destinationText: 'A steady destination',
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('MIGRATION_REQUIRED');

    mockCourseService.initializeChartForUser.mockResolvedValue({ chartSchemaVersion: 1 });
    const initialized = await request(buildApp()).post('/api/courses/initialize').send({});
    expect(initialized.status).toBe(200);
    expect(initialized.body.data.chartSchemaVersion).toBe(1);
    expect(mockCourseService.initializeChartForUser).toHaveBeenCalledWith('user-1');
  });

  it('resolves Chart from an Anchor through the server contract, never by treating the Anchor ID as a Course ID', async () => {
    mockCourseService.resolveForAnchor.mockResolvedValue({
      id: 'course-1',
      destinationText: 'A destination',
    });
    const response = await request(buildApp()).post('/api/courses/resolve-for-anchor').send({
      anchorId: 'anchor-1',
      idempotencyKey: 'chart-entry-1',
    });
    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe('course-1');
    expect(mockCourseService.resolveForAnchor).toHaveBeenCalledWith(
      'user-1',
      'anchor-1',
      'chart-entry-1'
    );
    expect(mockCourseService.getCourse).not.toHaveBeenCalledWith('user-1', 'anchor-1');
  });

  it('rejects malformed resolver input before it can create a Course', async () => {
    const response = await request(buildApp())
      .post('/api/courses/resolve-for-anchor')
      .send({ anchorId: 'anchor-1' });
    expect(response.status).toBe(400);
    expect(mockCourseService.resolveForAnchor).not.toHaveBeenCalled();
  });

  it('honours the existing Chart write and initialization gates', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', chartSchemaVersion: 0 });
    const response = await request(buildApp()).post('/api/courses/resolve-for-anchor').send({
      anchorId: 'anchor-1',
      idempotencyKey: 'chart-entry-1',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('MIGRATION_REQUIRED');
    expect(mockCourseService.resolveForAnchor).not.toHaveBeenCalled();
  });
});
