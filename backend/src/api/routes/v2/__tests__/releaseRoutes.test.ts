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
const release = jest.fn();
jest.mock('../../../../services/v2/AnchorReleaseService', () => ({
  anchorReleaseService: { release },
}));
import router from '../releaseRoutes';

describe('POST /api/v2/anchors/:anchorId/release', () => {
  it('returns the server-owned, idempotent release lifecycle contract', async () => {
    release.mockResolvedValue({
      anchorId: 'a1',
      releasedAt: '2026-09-09T00:00:00.000Z',
      lifecycleState: 'released',
      archivedCourseCount: 1,
      archivedWaypointCount: 2,
      remindersStopped: true,
    });
    const app = express();
    app.use(express.json());
    app.use('/api/v2', router);
    app.use(errorHandler);
    const response = await request(app)
      .post('/api/v2/anchors/a1/release')
      .send({ idempotencyKey: 'release-a1-once' })
      .expect(200);
    expect(response.body.data).toMatchObject({
      releasedAt: '2026-09-09T00:00:00.000Z',
      lifecycleState: 'released',
      remindersStopped: true,
    });
    expect(release).toHaveBeenCalledWith('db-user-1', 'a1', 'release-a1-once');
  });
});
