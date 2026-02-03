import express from 'express';
import request from 'supertest';

jest.mock('@prisma/client', () => require('../../../../__mocks__/@prisma/client'));
jest.mock('../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'auth-uid', email: 'user@example.com' };
    next();
  },
}));

const { __prismaMock } = jest.requireMock('@prisma/client') as { __prismaMock: any };
const anchorRoutes = require('../anchors').default;

const app = express();
app.use(express.json());
app.use('/api/anchors', anchorRoutes);

describe('Anchor routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an anchor', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (__prismaMock.anchor.create as jest.Mock).mockResolvedValue({
      id: 'anchor-1',
      intentionText: 'Focus',
    });
    (__prismaMock.user.update as jest.Mock).mockResolvedValue({});

    const response = await request(app)
      .post('/api/anchors')
      .send({
        intentionText: 'Focus',
        category: 'clarity',
        distilledLetters: ['F', 'C'],
        baseSigilSvg: '<svg/>',
        structureVariant: 'balanced',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe('anchor-1');
  });

  it('lists anchors with filters', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (__prismaMock.anchor.findMany as jest.Mock).mockResolvedValue([
      { id: 'anchor-1' },
      { id: 'anchor-2' },
    ]);

    const response = await request(app)
      .get('/api/anchors')
      .query({ category: 'clarity', isCharged: 'true', limit: '1' });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(__prismaMock.anchor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: 'clarity',
          isCharged: true,
        }),
      })
    );
  });

  it('fetches anchor by id', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (__prismaMock.anchor.findFirst as jest.Mock).mockResolvedValue({
      id: 'anchor-1',
      activations: [],
      charges: [],
    });

    const response = await request(app).get('/api/anchors/anchor-1');

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('anchor-1');
  });

  it('updates an anchor', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (__prismaMock.anchor.findFirst as jest.Mock).mockResolvedValue({ id: 'anchor-1' });
    (__prismaMock.anchor.update as jest.Mock).mockResolvedValue({
      id: 'anchor-1',
      mantraText: 'OM',
    });

    const response = await request(app)
      .put('/api/anchors/anchor-1')
      .send({ mantraText: 'OM' });

    expect(response.status).toBe(200);
    expect(response.body.data.mantraText).toBe('OM');
  });

  it('archives an anchor on delete', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (__prismaMock.anchor.findFirst as jest.Mock).mockResolvedValue({ id: 'anchor-1' });
    (__prismaMock.anchor.update as jest.Mock).mockResolvedValue({});

    const response = await request(app).delete('/api/anchors/anchor-1');

    expect(response.status).toBe(200);
    expect(response.body.data.message).toContain('archived');
  });

  it('charges an anchor', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (__prismaMock.anchor.findFirst as jest.Mock).mockResolvedValue({ id: 'anchor-1' });
    (__prismaMock.charge.create as jest.Mock).mockResolvedValue({});
    (__prismaMock.anchor.update as jest.Mock).mockResolvedValue({
      id: 'anchor-1',
      isCharged: true,
    });

    const response = await request(app)
      .post('/api/anchors/anchor-1/charge')
      .send({ chargeType: 'initial_quick', durationSeconds: 120 });

    expect(response.status).toBe(200);
    expect(response.body.data.isCharged).toBe(true);
  });

  it('logs an activation', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (__prismaMock.anchor.findFirst as jest.Mock).mockResolvedValue({ id: 'anchor-1' });
    (__prismaMock.activation.create as jest.Mock).mockResolvedValue({});
    (__prismaMock.anchor.update as jest.Mock).mockResolvedValue({
      id: 'anchor-1',
      activationCount: 1,
    });
    (__prismaMock.user.update as jest.Mock).mockResolvedValue({});

    const response = await request(app)
      .post('/api/anchors/anchor-1/activate')
      .send({ activationType: 'visual', durationSeconds: 60 });

    expect(response.status).toBe(200);
    expect(response.body.data.activationCount).toBe(1);
  });
});
