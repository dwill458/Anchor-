import express, { Application } from 'express';
import request from 'supertest';
import { errorHandler, AppError } from '../../../middleware/errorHandler';

jest.mock('../../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'auth-user-1' };
    req.dbUser = { id: 'db-user-1' };
    next();
  },
}));
jest.mock('../../../middleware/aiRateLimit', () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return { globalAiCeilingLimiter: pass, chartAskLimiter: pass, chartAskConcurrencyGuard: pass };
});
const mockFlags = { enabled: true };
jest.mock('../../../../config/chartFlags', () => {
  const { AppError: Err } = jest.requireActual('../../../middleware/errorHandler');
  const guard = () => {
    if (!mockFlags.enabled) throw new Err('Chart is currently disabled', 403, 'FEATURE_DISABLED');
  };
  return { requireChartEnabled: guard, requireChartWriteEnabled: guard };
});
const mockPrisma = { course: { findFirst: jest.fn().mockResolvedValue({ id: 'course-1' }) } };
jest.mock('../../../../lib/prisma', () => ({ prisma: mockPrisma }));

const mockService = { turn: jest.fn(), approveMoves: jest.fn(), dismiss: jest.fn(), confirmRouteApplied: jest.fn() };
jest.mock('../../../../services/chart/ask/AskChartService', () => ({ askChartService: mockService }));
const mockStore = {
  assertOwnsAnchor: jest.fn(),
  getConversation: jest.fn(),
  clearConversation: jest.fn(),
  getProfile: jest.fn(),
  upsertMemory: jest.fn(),
  deleteMemory: jest.fn(),
  deleteAllMemories: jest.fn(),
  setStyle: jest.fn(),
};
jest.mock('../../../../services/chart/ask/askChartStore', () => ({ askChartStore: mockStore }));

const mockPhotos = { storeAskPhoto: jest.fn(), purgeExpiredAskPhotos: jest.fn().mockResolvedValue(0) };
jest.mock('../../../../services/chart/ask/askChartPhotos', () => ({
  ASK_PHOTO_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_ASK_PHOTO_BASE64_LENGTH: 9_000_000,
  storeAskPhoto: (...args: unknown[]) => mockPhotos.storeAskPhoto(...args),
  purgeExpiredAskPhotos: (...args: unknown[]) => mockPhotos.purgeExpiredAskPhotos(...args),
}));

import askChartRoutes from '../askChartRoutes';

const app: Application = express();
app.use(express.json());
app.use('/api/v2', askChartRoutes);
app.use(errorHandler);

const body = { idempotencyKey: 'message-key-1', text: 'It runs but needs work', attachments: [], skill: 'FREE' };
const result = { conversationId: 'c1', mode: 'ONGOING', assistantMessage: { id: 'm2', text: 'Hi' } };

const events = (text: string) =>
  text
    .split('\n\n')
    .filter(Boolean)
    .map(block => {
      const [event, data] = block.split('\n');
      return { event: event.replace('event: ', ''), data: JSON.parse(data.replace('data: ', '')) };
    });

beforeEach(() => {
  jest.clearAllMocks();
  mockFlags.enabled = true;
  mockPrisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
});

describe('POST /anchors/:anchorId/chart/ask', () => {
  it('returns the turn as JSON, scoped to the authenticated user', async () => {
    mockService.turn.mockResolvedValue(result);
    const response = await request(app).post('/api/v2/anchors/anchor-1/chart/ask').send(body);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: result });
    expect(mockService.turn).toHaveBeenCalledWith('db-user-1', expect.objectContaining({ anchorId: 'anchor-1', text: 'It runs but needs work', skill: 'FREE', targetMoveId: null }));
  });

  it('passes an opening turn through with no text', async () => {
    mockService.turn.mockResolvedValue(result);
    await request(app).post('/api/v2/anchors/anchor-1/chart/ask').send({ idempotencyKey: 'opening-key-1', opening: true });
    expect(mockService.turn).toHaveBeenCalledWith('db-user-1', expect.objectContaining({ opening: true, text: '' }));
  });

  it('rejects malformed bodies before any model work', async () => {
    for (const bad of [
      { ...body, idempotencyKey: 'short' },
      { ...body, skill: 'DELETE_EVERYTHING' },
      { ...body, text: 'x'.repeat(1001) },
      { ...body, attachments: ['not-a-uuid'] },
      { ...body, extra: true },
    ]) {
      const response = await request(app).post('/api/v2/anchors/anchor-1/chart/ask').send(bad);
      expect(response.status).toBe(400);
    }
    expect(mockService.turn).not.toHaveBeenCalled();
  });

  it('is blocked when Chart writes are disabled', async () => {
    mockFlags.enabled = false;
    const response = await request(app).post('/api/v2/anchors/anchor-1/chart/ask').send(body);
    expect(response.status).toBe(403);
    expect(mockService.turn).not.toHaveBeenCalled();
  });

  it('streams server-sent events: deltas, stages, then exactly one done', async () => {
    mockService.turn.mockImplementation(async (_user: string, _input: unknown, hooks: any) => {
      hooks.onReply('Start');
      hooks.onReply('Start with');
      hooks.onStage('preparing_change');
      await new Promise(resolve => setTimeout(resolve, 80));
      return result;
    });
    const response = await request(app).post('/api/v2/anchors/anchor-1/chart/ask').set('Accept', 'text/event-stream').send(body);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    const parsed = events(response.text);
    expect(parsed.map(item => item.event)).toEqual(expect.arrayContaining(['delta', 'stage', 'done']));
    expect(parsed.filter(item => item.event === 'done')).toHaveLength(1);
    expect(parsed[parsed.length - 1].event).toBe('done');
    const lastDelta = parsed.filter(item => item.event === 'delta').pop();
    expect(lastDelta?.data.text).toBe('Start with');
    expect(parsed.find(item => item.event === 'stage')?.data).toEqual({ stage: 'preparing_change' });
  });

  it('reports a failed stream as one error event with a retryable flag', async () => {
    mockService.turn.mockRejectedValue(new AppError('down', 503, 'ASK_UNAVAILABLE'));
    const response = await request(app).post('/api/v2/anchors/anchor-1/chart/ask').set('Accept', 'text/event-stream').send(body);
    expect(events(response.text)).toEqual([{ event: 'error', data: { code: 'ASK_UNAVAILABLE', message: 'down', status: 503, retryable: true } }]);
  });

  it('does not treat a validation failure as retryable', async () => {
    mockService.turn.mockRejectedValue(new AppError('bad', 400, 'VALIDATION_ERROR'));
    const response = await request(app).post('/api/v2/anchors/anchor-1/chart/ask').set('Accept', 'text/event-stream').send(body);
    expect(events(response.text)[0].data.retryable).toBe(false);
  });

  it('passes service errors to the error handler in JSON mode', async () => {
    mockService.turn.mockRejectedValue(new AppError('down', 503, 'ASK_UNAVAILABLE'));
    const response = await request(app).post('/api/v2/anchors/anchor-1/chart/ask').send(body);
    expect(response.status).toBe(503);
  });
});

describe('POST /anchors/:anchorId/chart/ask/photo', () => {
  it('stores one photo for the signed-in person’s own Anchor and returns only its id', async () => {
    mockPhotos.storeAskPhoto.mockResolvedValue({ assetId: 'asset-9', width: 1600, height: 900, bytes: 1, expiresInMs: 1 });
    const response = await request(app).post('/api/v2/anchors/anchor-1/chart/ask/photo').send({ base64Image: 'AAAA', mimeType: 'image/jpeg' });
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ assetId: 'asset-9', width: 1600, height: 900 });
    expect(mockStore.assertOwnsAnchor).toHaveBeenCalledWith('db-user-1', 'anchor-1');
    expect(mockPhotos.storeAskPhoto).toHaveBeenCalledWith('db-user-1', 'anchor-1', 'AAAA', 'image/jpeg');
    expect(mockPhotos.purgeExpiredAskPhotos).toHaveBeenCalledWith({ userId: 'db-user-1' });
  });

  it('rejects bad bodies and unsupported types before storing anything', async () => {
    for (const bad of [{}, { base64Image: '' }, { base64Image: 'AAAA', mimeType: 'image/gif' }, { base64Image: 'AAAA', extra: 1 }]) {
      expect((await request(app).post('/api/v2/anchors/anchor-1/chart/ask/photo').send(bad)).status).toBe(400);
    }
    expect(mockPhotos.storeAskPhoto).not.toHaveBeenCalled();
  });

  it('does not store a photo for an Anchor the person does not own', async () => {
    mockStore.assertOwnsAnchor.mockRejectedValueOnce(new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND'));
    const response = await request(app).post('/api/v2/anchors/someone-elses/chart/ask/photo').send({ base64Image: 'AAAA' });
    expect(response.status).toBe(404);
    expect(mockPhotos.storeAskPhoto).not.toHaveBeenCalled();
  });
});

describe('conversation, profile and memory', () => {
  it('restores the conversation for the current Chart', async () => {
    mockStore.getConversation.mockResolvedValue({ conversationId: 'c1', messages: [] });
    const response = await request(app).get('/api/v2/anchors/anchor-1/chart/ask');
    expect(mockStore.assertOwnsAnchor).toHaveBeenCalledWith('db-user-1', 'anchor-1');
    expect(mockStore.getConversation).toHaveBeenCalledWith('db-user-1', 'anchor-1', 'course-1');
    expect(response.body.data).toMatchObject({ conversationId: 'c1', mode: 'ONGOING', courseId: 'course-1' });
  });

  it('restores the creation conversation before a Chart exists', async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);
    mockStore.getConversation.mockResolvedValue({ conversationId: null, messages: [] });
    const response = await request(app).get('/api/v2/anchors/anchor-1/chart/ask');
    expect(mockStore.getConversation).toHaveBeenCalledWith('db-user-1', 'anchor-1', null);
    expect(response.body.data.mode).toBe('CREATE');
  });

  it('clears the conversation', async () => {
    mockStore.clearConversation.mockResolvedValue(1);
    const response = await request(app).delete('/api/v2/anchors/anchor-1/chart/ask');
    expect(response.body.data).toEqual({ cleared: 1 });
  });

  it('lets the person correct and delete remembered preferences, and rejects unknown keys', async () => {
    mockStore.upsertMemory.mockResolvedValue({ key: 'availability', value: 'Evenings' });
    const put = await request(app).put('/api/v2/anchors/anchor-1/chart/ask/memory/availability').send({ value: 'Evenings' });
    expect(put.status).toBe(200);
    expect(mockStore.upsertMemory).toHaveBeenCalledWith('db-user-1', 'anchor-1', 'availability', 'Evenings', 'USER_EDITED');
    expect((await request(app).put('/api/v2/anchors/anchor-1/chart/ask/memory/passwords').send({ value: 'x' })).status).toBe(400);
    expect((await request(app).delete('/api/v2/anchors/anchor-1/chart/ask/memory/availability')).status).toBe(200);
    expect(mockStore.deleteMemory).toHaveBeenCalledWith('db-user-1', 'anchor-1', 'availability');
    mockStore.deleteAllMemories.mockResolvedValue(2);
    expect((await request(app).delete('/api/v2/anchors/anchor-1/chart/ask/memory')).body.data).toEqual({ deleted: 2 });
  });

  it('sets the coaching style from the three supported values only', async () => {
    mockStore.setStyle.mockResolvedValue('DIRECT');
    expect((await request(app).put('/api/v2/chart-coach/style').send({ style: 'DIRECT' })).body.data).toEqual({ style: 'DIRECT' });
    expect((await request(app).put('/api/v2/chart-coach/style').send({ style: 'HARSH' })).status).toBe(400);
  });
});

describe('proposal approval', () => {
  it('applies from what the server stored: the client sends no move content', async () => {
    mockService.approveMoves.mockResolvedValue({ chart: { id: 'course-1' }, added: 2 });
    const response = await request(app).post('/api/v2/charts/course-1/ask/msg-1/approve').send({ title: 'tampered' });
    expect(response.status).toBe(200);
    expect(mockService.approveMoves).toHaveBeenCalledWith('db-user-1', 'course-1', 'msg-1');
    expect(response.body.data.added).toBe(2);
  });

  it('surfaces a stale proposal as a conflict', async () => {
    mockService.approveMoves.mockRejectedValue(new AppError('stale', 409, 'PROPOSAL_STALE'));
    expect((await request(app).post('/api/v2/charts/course-1/ask/msg-1/approve')).status).toBe(409);
  });

  it('dismisses and confirms route applications', async () => {
    expect((await request(app).post('/api/v2/charts/course-1/ask/msg-1/dismiss')).body.data).toEqual({ dismissed: true });
    expect((await request(app).post('/api/v2/charts/course-1/ask/msg-1/route-applied')).body.data).toEqual({ applied: true });
    expect(mockService.dismiss).toHaveBeenCalledWith('db-user-1', 'course-1', 'msg-1');
    expect(mockService.confirmRouteApplied).toHaveBeenCalledWith('db-user-1', 'course-1', 'msg-1');
  });
});
