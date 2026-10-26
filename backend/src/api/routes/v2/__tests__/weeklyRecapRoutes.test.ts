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
import { WeeklyRecapError } from '../../../../services/v2/WeeklyRecapService';

const service = { get: jest.fn(), history: jest.fn() };
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
    expect(service.get).not.toHaveBeenCalled();
  });

  it('does not gate or authenticate unrelated routes mounted after it (flag off)', async () => {
    delete process.env.WEEKLY_INSIGHT_V2_ENABLED;
    const res = await request(app).get('/api/v2/unrelated-later-route');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('GET latest passes the authenticated user and the device time zone', async () => {
    service.get.mockResolvedValue({ kind: 'NO_HISTORY', weekKey: '2026-10-19', timeZone: 'America/New_York' });
    const res = await request(app).get('/api/v2/weekly-recap/latest?timeZone=America/New_York');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ recap: null, reason: 'NO_HISTORY' });
    expect(service.get).toHaveBeenCalledWith('db-user-1', { weekKey: 'latest', timeZone: 'America/New_York' });
  });

  it('GET by week key forwards the key and returns the stored recap', async () => {
    service.get.mockResolvedValue({ kind: 'RECAP', id: 'r1', recap: { weekKey: '2026-10-12' }, feedback: null, updatedAt: new Date('2026-10-20T12:00:00Z') });
    const res = await request(app).get('/api/v2/weekly-recap/2026-10-12?timeZone=UTC');
    expect(service.get).toHaveBeenCalledWith('db-user-1', { weekKey: '2026-10-12', timeZone: 'UTC' });
    expect(res.body.data).toEqual({ id: 'r1', recap: { weekKey: '2026-10-12' }, feedback: null, updatedAt: '2026-10-20T12:00:00.000Z' });
  });

  it('keeps the service error code and status for the client', async () => {
    service.get.mockRejectedValue(new WeeklyRecapError('That week is not available yet.', 404, 'WEEK_NOT_AVAILABLE'));
    const res = await request(app).get('/api/v2/weekly-recap/2026-12-28?timeZone=UTC');
    expect(res.status).toBe(404);
    expect(res.body.error?.code ?? res.body.code).toBe('WEEK_NOT_AVAILABLE');
  });

  it('lists history with the cursor', async () => {
    service.history.mockResolvedValue({ items: [], nextCursor: null });
    const res = await request(app).get('/api/v2/weekly-recaps?limit=10&before=2026-10-12');
    expect(res.body.data).toEqual({ items: [], nextCursor: null });
    expect(service.history).toHaveBeenCalledWith('db-user-1', { before: '2026-10-12', limit: 10 });
  });
});
