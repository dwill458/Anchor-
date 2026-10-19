import express from 'express';
import request from 'supertest';
import { AppError, errorHandler } from '../../../middleware/errorHandler';

jest.mock('../../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'auth-user-1' };
    req.dbUser = { id: 'db-user-1' };
    next();
  },
}));
const reconcileAndList = jest.fn();
const markCelebrated = jest.fn();
jest.mock('../../../../services/v2/milestones/MilestoneService', () => ({
  milestoneService: {
    reconcileAndList: (...args: unknown[]) => reconcileAndList(...args),
    markCelebrated: (...args: unknown[]) => markCelebrated(...args),
  },
}));
import router from '../milestoneRoutes';

const app = express();
app.use(express.json());
app.use('/api/v2', router);
app.use(errorHandler);

const record = {
  id: 'm1',
  anchorId: 'a1',
  definitionId: 'commitment.practices.1',
  definitionVersion: 1,
  earnedAt: '2026-10-01T12:00:00.000Z',
  sourceKind: 'PRACTICE_COMPLETION',
  sourceEntityId: 's1',
  metadata: {},
  celebratedAt: null,
};

describe('milestone routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /api/v2/anchors/:anchorId/milestones', () => {
    it('returns the permanent record and only what this read newly recorded', async () => {
      reconcileAndList.mockResolvedValue({ milestones: [record], created: [record] });
      const response = await request(app).get('/api/v2/anchors/a1/milestones').expect(200);
      expect(response.body).toEqual({ success: true, data: { milestones: [record], created: [record] } });
      expect(reconcileAndList).toHaveBeenCalledWith('db-user-1', 'a1');
    });

    it('is safe to repeat: a second read records nothing new', async () => {
      reconcileAndList.mockResolvedValue({ milestones: [record], created: [] });
      const response = await request(app).get('/api/v2/anchors/a1/milestones').expect(200);
      expect(response.body.data.created).toEqual([]);
      expect(response.body.data.milestones).toHaveLength(1);
    });

    it('answers 404 for an Anchor the account does not own', async () => {
      reconcileAndList.mockRejectedValue(new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND'));
      const response = await request(app).get('/api/v2/anchors/someone-elses/milestones').expect(404);
      expect(response.body.error.code).toBe('ANCHOR_NOT_FOUND');
      expect(reconcileAndList).toHaveBeenCalledWith('db-user-1', 'someone-elses');
    });
  });

  describe('POST /api/v2/milestones/:milestoneId/celebrated', () => {
    it('stamps the presentation receipt for the signed-in account only', async () => {
      markCelebrated.mockResolvedValue({ ...record, celebratedAt: '2026-10-01T12:05:00.000Z' });
      const response = await request(app).post('/api/v2/milestones/m1/celebrated').expect(200);
      expect(response.body.data.milestone.celebratedAt).toBe('2026-10-01T12:05:00.000Z');
      expect(markCelebrated).toHaveBeenCalledWith('db-user-1', 'm1');
    });

    it('is idempotent: repeating returns the same record', async () => {
      const settled = { ...record, celebratedAt: '2026-10-01T12:05:00.000Z' };
      markCelebrated.mockResolvedValue(settled);
      const first = await request(app).post('/api/v2/milestones/m1/celebrated').expect(200);
      const second = await request(app).post('/api/v2/milestones/m1/celebrated').expect(200);
      expect(second.body).toEqual(first.body);
    });

    it("answers 404 for another account's milestone", async () => {
      markCelebrated.mockRejectedValue(new AppError('Milestone not found', 404, 'MILESTONE_NOT_FOUND'));
      const response = await request(app).post('/api/v2/milestones/not-mine/celebrated').expect(404);
      expect(response.body.error.code).toBe('MILESTONE_NOT_FOUND');
    });
  });
});
