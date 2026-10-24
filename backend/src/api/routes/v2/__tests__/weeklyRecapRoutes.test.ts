import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../../middleware/errorHandler';

jest.mock('../../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'auth-user-1' };
    req.dbUser = { id: 'db-user-1' };
    next();
  },
}));
jest.mock('../../../../lib/prisma', () => ({ prisma: { $queryRawUnsafe: jest.fn(), user: { findUnique: jest.fn() } } }));

import { createWeeklyRecapRouter } from '../weeklyRecapRoutes';
import { RecapError } from '../../../../services/v2/WeeklyRecapService';

const service = { getRecap: jest.fn(), submitFeedback: jest.fn(), listRecaps: jest.fn() };
const app = express();
app.use(express.json());
app.use('/api/v2', createWeeklyRecapRouter(service as any));
app.get('/api/v2/unrelated-later-route', (_req, res) => res.json({ ok: true }));
app.use(errorHandler);

describe('weekly recap routes', () => {
  const prev = process.env.WEEKLY_INSIGHT_V2_ENABLED;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEEKLY_INSIGHT_V2_ENABLED = 'true';
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.WEEKLY_INSIGHT_V2_ENABLED;
    else process.env.WEEKLY_INSIGHT_V2_ENABLED = prev;
  });

  it('is dark by default: 403 FEATURE_DISABLED when the flag is off', async () => {
    delete process.env.WEEKLY_INSIGHT_V2_ENABLED;
    const res = await request(app).get('/api/v2/weekly-recap/latest?timeZone=UTC');
    expect(res.status).toBe(403);
    expect(res.body.error?.code ?? res.body.code).toBe('FEATURE_DISABLED');
    expect(service.getRecap).not.toHaveBeenCalled();
  });

  it('does not gate or authenticate unrelated routes mounted after it (flag off)', async () => {
    delete process.env.WEEKLY_INSIGHT_V2_ENABLED;
    const res = await request(app).get('/api/v2/unrelated-later-route');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('GET latest passes the authenticated user and the device time zone', async () => {
    service.getRecap.mockResolvedValue({ available: false });
    const res = await request(app).get('/api/v2/weekly-recap/latest?timeZone=America/New_York');
    expect(res.status).toBe(200);
    expect(service.getRecap).toHaveBeenCalledWith('db-user-1', { timeZone: 'America/New_York' });
  });

  it('GET by week key forwards the key', async () => {
    service.getRecap.mockResolvedValue({ available: true });
    await request(app).get('/api/v2/weekly-recap/2026-10-12?timeZone=UTC');
    expect(service.getRecap).toHaveBeenCalledWith('db-user-1', { weekKey: '2026-10-12', timeZone: 'UTC' });
  });

  it('translates domain errors to HTTP statuses', async () => {
    service.getRecap.mockRejectedValue(new RecapError('INVALID_TIME_ZONE'));
    expect((await request(app).get('/api/v2/weekly-recap/latest?timeZone=nope')).status).toBe(400);
    service.submitFeedback.mockRejectedValue(new RecapError('NOT_FINAL'));
    expect((await request(app).post('/api/v2/weekly-recap/2026-10-12/feedback').send({ rating: 'Yes' })).status).toBe(409);
    service.submitFeedback.mockRejectedValue(new RecapError('NOT_FOUND'));
    expect((await request(app).post('/api/v2/weekly-recap/2026-10-12/feedback').send({ rating: 'Yes' })).status).toBe(404);
  });

  it('feedback posts the rating for the week', async () => {
    service.submitFeedback.mockResolvedValue({ feedback: 'Mostly' });
    const res = await request(app).post('/api/v2/weekly-recap/2026-10-12/feedback').send({ rating: 'Mostly' });
    expect(res.status).toBe(200);
    expect(service.submitFeedback).toHaveBeenCalledWith('db-user-1', '2026-10-12', 'Mostly');
  });

  it('lists recaps in the mobile-facing camelCase shape', async () => {
    service.listRecaps.mockResolvedValue([{ week_key: '2026-10-12', time_zone: 'UTC', status: 'FINAL', headline: 'h', hero_kind: 'QUIET', has_feedback: false }]);
    const res = await request(app).get('/api/v2/weekly-recaps?limit=5');
    expect(res.body.data[0]).toEqual({ weekKey: '2026-10-12', timeZone: 'UTC', status: 'FINAL', headline: 'h', heroKind: 'QUIET', hasFeedback: false });
    expect(service.listRecaps).toHaveBeenCalledWith('db-user-1', 5);
  });
});
