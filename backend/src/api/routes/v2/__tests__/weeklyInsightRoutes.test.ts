import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../../middleware/errorHandler';

jest.mock('../../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => { req.user = { uid: 'auth-1' }; req.dbUser = { id: 'u1' }; next(); },
}));
const mockEnv = { ENABLE_WEEKLY_RECAP_V2: true };
jest.mock('../../../../config/env', () => ({ env: mockEnv }));
const mockSnapshot = { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() };
jest.mock('../../../../lib/prisma', () => ({ prisma: { weeklyInsightSnapshot: mockSnapshot } }));

const mockRows = new Map<string, any>();
const mockReader: Record<string, jest.Mock<Promise<any>, any[]>> = {
  hasAnyHistory: jest.fn(async () => true), practices: jest.fn(async () => []), priorPracticeAt: jest.fn(async () => null),
  chart: jest.fn(async () => ({ waypoints: [], courses: [] })), moves: jest.fn(async () => []), completions: jest.fn(async () => []),
  releases: jest.fn(async () => []), milestones: jest.fn(async () => []), visions: jest.fn(async () => []), anchors: jest.fn(async () => []),
};
const mockStore = {
  find: jest.fn(async (u: string, w: string) => mockRows.get(`${u}|${w}`) ?? null),
  create: jest.fn(async (i: any) => {
    const row = { id: 's1', userId: i.userId, weekKey: i.weekKey, timeZone: i.timeZone, status: i.recap.status, provenance: i.recap.provenance, snapshot: i.recap, feedback: null, finalizedAt: null, updatedAt: new Date('2026-10-21T12:00:00Z') };
    mockRows.set(`${i.userId}|${i.weekKey}`, row); return row;
  }),
  updateDraft: jest.fn(async () => true), finalize: jest.fn(async () => true), list: jest.fn(async () => []),
};
jest.mock('../../../../services/v2/WeeklyRecapPrisma', () => ({ prismaRecapReader: mockReader, prismaSnapshotStore: mockStore }));

import router from '../weeklyInsightRoutes';

const app = express();
app.use(express.json());
app.use('/api/v2', router);
app.use(errorHandler);

beforeEach(() => { jest.clearAllMocks(); mockRows.clear(); mockEnv.ENABLE_WEEKLY_RECAP_V2 = true; jest.useFakeTimers({ now: new Date('2026-10-21T12:00:00Z'), doNotFake: ['setImmediate', 'nextTick', 'setTimeout', 'queueMicrotask'] }); });
afterEach(() => jest.useRealTimers());

describe('Weekly Insight 2.0 endpoints', () => {
  it('are dark when the flag is off, so legacy clients are unaffected', async () => {
    mockEnv.ENABLE_WEEKLY_RECAP_V2 = false;
    const res = await request(app).get('/api/v2/weekly-recap/latest?timeZone=America/New_York').expect(403);
    expect(res.body.error.code).toBe('FEATURE_DISABLED');
    expect(mockReader.practices).not.toHaveBeenCalled();
  });
  it('returns the latest recap and the server-chosen week', async () => {
    mockReader.moves.mockResolvedValueOnce([{ id: 'm1', courseId: 'c', waypointId: 'w', anchorId: 'a1', title: 'Book the race', completedAt: new Date('2026-10-14T14:00:00Z') }]);
    const res = await request(app).get('/api/v2/weekly-recap/latest?timeZone=America/New_York').expect(200);
    expect(res.body.data.recap.weekKey).toBe('2026-10-12');
    expect(res.body.data.recap.hero.kind).toBe('MOVES_PROGRESS');
    expect(res.headers['server-timing']).toMatch(/recap;dur=/);
  });
  it('validates timeZone and weekKey', async () => {
    expect((await request(app).get('/api/v2/weekly-recap/latest').expect(400)).body.error.code).toBe('INVALID_TIME_ZONE');
    expect((await request(app).get('/api/v2/weekly-recap/2026-10-13?timeZone=UTC').expect(400)).body.error.code).toBe('INVALID_WEEK_KEY');
    expect((await request(app).get('/api/v2/weekly-recap/2030-01-07?timeZone=UTC').expect(404)).body.error.code).toBe('WEEK_NOT_AVAILABLE');
  });
  it('says so plainly when there is no history', async () => {
    mockReader.hasAnyHistory.mockResolvedValueOnce(false);
    const res = await request(app).get('/api/v2/weekly-recap/latest?timeZone=UTC').expect(200);
    expect(res.body.data).toMatchObject({ recap: null, reason: 'NO_HISTORY' });
  });
  it('lists history', async () => {
    await request(app).get('/api/v2/weekly-recaps?limit=5&before=2026-10-12').expect(200);
    expect(mockStore.list).toHaveBeenCalledWith('u1', { before: '2026-10-12', limit: 6 });
  });
});

describe('legacy endpoints stay compatible', () => {
  it('GET returns only legacy (schema 1) snapshots', async () => {
    mockSnapshot.findMany.mockResolvedValue([]);
    await request(app).get('/api/v2/weekly-insights').expect(200);
    expect(mockSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1', schemaVersion: 1 } }));
  });
  it('POST rejects client-authored v2 recaps', async () => {
    await request(app).post('/api/v2/weekly-insights').send({ weekStart: '2026-10-12', weekEnd: '2026-10-18', snapshot: { recapVersion: 2 } }).expect(400);
    expect(mockSnapshot.create).not.toHaveBeenCalled();
  });
  it('POST with no anchor finds-or-creates instead of an invalid NULL upsert', async () => {
    mockSnapshot.findFirst.mockResolvedValue(null);
    mockSnapshot.create.mockResolvedValue({ id: 'x', snapshot: { v: 1 }, feedback: null });
    await request(app).post('/api/v2/weekly-insights').send({ weekStart: '2026-10-12', weekEnd: '2026-10-18', snapshot: { v: 1 } }).expect(200);
    expect(mockSnapshot.upsert).not.toHaveBeenCalled();
    expect(mockSnapshot.create).toHaveBeenCalledTimes(1);
  });
  it('POST with an anchor still upserts', async () => {
    mockSnapshot.upsert.mockResolvedValue({ id: 'x', snapshot: { v: 1 }, feedback: null });
    await request(app).post('/api/v2/weekly-insights').send({ anchorId: 'a1', weekStart: '2026-10-12', weekEnd: '2026-10-18', snapshot: { v: 1 } }).expect(200);
    expect(mockSnapshot.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('feedback is collected against finalized content', () => {
  it('refuses a provisional v2 recap', async () => {
    mockSnapshot.findFirst.mockResolvedValue({ id: 's1', status: 'DRAFT', schemaVersion: 2 });
    const res = await request(app).post('/api/v2/weekly-insights/s1/feedback').send({ rating: 'Yes' }).expect(409);
    expect(res.body.error.code).toBe('RECAP_NOT_FINAL');
    expect(mockSnapshot.updateMany).not.toHaveBeenCalled();
  });
  it('accepts a final v2 recap and any legacy snapshot', async () => {
    mockSnapshot.findFirst.mockResolvedValue({ id: 's1', status: 'FINAL', schemaVersion: 2 });
    await request(app).post('/api/v2/weekly-insights/s1/feedback').send({ rating: 'Mostly' }).expect(200);
    mockSnapshot.findFirst.mockResolvedValue({ id: 'l1', status: 'FINAL', schemaVersion: 1 });
    await request(app).post('/api/v2/weekly-insights/l1/feedback').send({ rating: 'Yes' }).expect(200);
    expect(mockSnapshot.updateMany).toHaveBeenCalledTimes(2);
  });
  it('404s for someone else’s snapshot and 400s on a bad rating', async () => {
    mockSnapshot.findFirst.mockResolvedValue(null);
    await request(app).post('/api/v2/weekly-insights/zzz/feedback').send({ rating: 'Yes' }).expect(404);
    await request(app).post('/api/v2/weekly-insights/s1/feedback').send({ rating: 'Great' }).expect(400);
  });
});
