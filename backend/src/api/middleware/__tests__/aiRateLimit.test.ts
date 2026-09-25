import express, { Application, Request, Response } from 'express';
import request from 'supertest';
import {
  createAiRateLimiter,
  createConcurrencyGuard,
  isAiDeveloper,
  getAiDevAllowlist,
  chartPlanLimiter,
  chartAdjustLimiter,
  visionGenerationLimiter,
  globalAiCeilingLimiter,
  chartPlanConcurrencyGuard,
} from '../aiRateLimit';
import { AuthRequest, DEV_MASTER_UID } from '../auth';

describe('aiRateLimit middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isAiDeveloper identity verification', () => {
    it('identifies deontrezwilliams@gmail.com by default from verified auth email', () => {
      const req = {
        user: { uid: 'user-123', email: 'deontrezwilliams@gmail.com' },
      } as unknown as Request;
      expect(isAiDeveloper(req)).toBe(true);
    });

    it('matches developer email case-insensitively with whitespace trimmed', () => {
      const req = {
        user: { uid: 'user-123', email: '  DeontreZWilliams@Gmail.Com  ' },
      } as unknown as Request;
      expect(isAiDeveloper(req)).toBe(true);
    });

    it('recognizes DEV_MASTER_UID', () => {
      const req = {
        user: { uid: DEV_MASTER_UID, email: 'dev+master@anchor.local' },
      } as unknown as Request;
      expect(isAiDeveloper(req)).toBe(true);
    });

    it('rejects an unlisted normal production user', () => {
      const req = {
        user: { uid: 'user-456', email: 'regular.user@example.com' },
      } as unknown as Request;
      expect(isAiDeveloper(req)).toBe(false);
    });

    it('does NOT trust a forged email or developer header sent by client', () => {
      const req = {
        headers: {
          'x-developer': 'true',
          'x-user-email': 'deontrezwilliams@gmail.com',
        },
        body: {
          email: 'deontrezwilliams@gmail.com',
        },
        user: { uid: 'normal-user', email: 'normal.user@example.com' },
      } as unknown as Request;
      expect(isAiDeveloper(req)).toBe(false);
    });

    it('does NOT trust an unauthenticated request even if it sends developer email in headers', () => {
      const req = {
        headers: {
          'x-developer': 'true',
          'x-user-email': 'deontrezwilliams@gmail.com',
        },
        body: {
          email: 'deontrezwilliams@gmail.com',
        },
      } as unknown as Request;
      expect(isAiDeveloper(req)).toBe(false);
    });

    it('supports custom allowlist from AI_DEV_ALLOWLIST environment variable', () => {
      process.env.AI_DEV_ALLOWLIST = 'testdev@anchor.app, anotherdev@anchor.app';
      const allowlist = getAiDevAllowlist();
      expect(allowlist.has('testdev@anchor.app')).toBe(true);
      expect(allowlist.has('anotherdev@anchor.app')).toBe(true);
      expect(allowlist.has('deontrezwilliams@gmail.com')).toBe(true);

      const req = {
        user: { uid: 'u1', email: 'testdev@anchor.app' },
      } as unknown as Request;
      expect(isAiDeveloper(req)).toBe(true);
    });
  });

  describe('Feature rate limiting behavior', () => {
    function createTestApp(limiter: express.RequestHandler) {
      const app = express();
      app.use(express.json());
      app.post('/test', limiter, (_req: Request, res: Response) => {
        res.json({ success: true });
      });
      return app;
    }

    it('allows a normal user within their feature limit and returns RateLimit headers', async () => {
      const testLimiter = createAiRateLimiter({
        feature: 'chart',
        windowMs: 60 * 1000,
        prodLimit: 3,
        devLimit: 10,
        keyPrefix: `test:user:${Date.now()}:`,
        message: 'Rate limit reached',
      });

      const app = createTestApp((req, _res, next) => {
        (req as AuthRequest).user = { uid: 'user-normal-1', email: 'user@example.com' };
        next();
      });
      app.post('/api/test', testLimiter, (_req, res) => res.json({ success: true }));

      const res = await request(app).post('/api/test');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['ratelimit-limit']).toBe('3');
      expect(res.headers['ratelimit-remaining']).toBe('2');
    });

    it('blocks a normal user exceeding feature limit with 429, valid Retry-After, and structured envelope', async () => {
      const testLimiter = createAiRateLimiter({
        feature: 'chart',
        windowMs: 60 * 1000,
        prodLimit: 2,
        devLimit: 10,
        keyPrefix: `test:exceed:${Date.now()}:`,
        message: "We couldn't build your route right now. Your progress is saved, so you can try again shortly.",
      });

      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as AuthRequest).user = { uid: 'user-normal-2', email: 'normal@example.com' };
        next();
      });
      app.post('/api/chart/plan', testLimiter, (_req, res) => res.json({ success: true }));

      // Request 1: ok
      const res1 = await request(app).post('/api/chart/plan');
      expect(res1.status).toBe(200);

      // Request 2: ok
      const res2 = await request(app).post('/api/chart/plan');
      expect(res2.status).toBe(200);

      // Request 3: blocked
      const res3 = await request(app).post('/api/chart/plan');
      expect(res3.status).toBe(429);
      expect(res3.headers['retry-after']).toBeDefined();
      const retryAfter = parseInt(res3.headers['retry-after'], 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);

      expect(res3.body).toEqual({
        success: false,
        error: {
          code: 'AI_RATE_LIMITED',
          message: "We couldn't build your route right now. Your progress is saved, so you can try again shortly.",
          feature: 'chart',
          retryAfterSeconds: expect.any(Number),
        },
      });
      expect(res3.body.error.retryAfterSeconds).toBe(retryAfter);
    });

    it('grants elevated limits to authorized developer account', async () => {
      const testLimiter = createAiRateLimiter({
        feature: 'chart',
        windowMs: 60 * 1000,
        prodLimit: 2,
        devLimit: 5,
        keyPrefix: `test:dev:${Date.now()}:`,
        message: 'Rate limit reached',
      });

      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as AuthRequest).user = { uid: 'dev-uid-1', email: 'deontrezwilliams@gmail.com' };
        next();
      });
      app.post('/api/chart/plan', testLimiter, (_req, res) => res.json({ success: true }));

      // Developer exceeds normal limit (2) and continues up to dev limit (5)
      for (let i = 0; i < 5; i++) {
        const res = await request(app).post('/api/chart/plan');
        expect(res.status).toBe(200);
      }

      // 6th request triggers developer ceiling
      const res6 = await request(app).post('/api/chart/plan');
      expect(res6.status).toBe(429);
      expect(res6.body.error.code).toBe('AI_RATE_LIMITED');
    });

    it('maintains separate buckets for Chart and Vision', async () => {
      const chartLimiter = createAiRateLimiter({
        feature: 'chart',
        windowMs: 60 * 1000,
        prodLimit: 1,
        devLimit: 10,
        keyPrefix: `test:chart:${Date.now()}:`,
        message: 'Chart rate limit',
      });
      const visionLimiter = createAiRateLimiter({
        feature: 'vision',
        windowMs: 60 * 1000,
        prodLimit: 1,
        devLimit: 10,
        keyPrefix: `test:vision:${Date.now()}:`,
        message: 'Vision rate limit',
      });

      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as AuthRequest).user = { uid: 'user-sep-1', email: 'sep@example.com' };
        next();
      });
      app.post('/api/chart', chartLimiter, (_req, res) => res.json({ feature: 'chart' }));
      app.post('/api/vision', visionLimiter, (_req, res) => res.json({ feature: 'vision' }));

      // Exhaust Chart bucket
      const chartRes1 = await request(app).post('/api/chart');
      expect(chartRes1.status).toBe(200);

      const chartRes2 = await request(app).post('/api/chart');
      expect(chartRes2.status).toBe(429);
      expect(chartRes2.body.error.feature).toBe('chart');

      // Vision bucket is independent and still succeeds
      const visionRes1 = await request(app).post('/api/vision');
      expect(visionRes1.status).toBe(200);
      expect(visionRes1.body.feature).toBe('vision');
    });

    it('enforces global AI ceiling as secondary abuse guard', async () => {
      const globalLimiter = createAiRateLimiter({
        feature: 'global',
        windowMs: 60 * 1000,
        prodLimit: 3,
        devLimit: 10,
        keyPrefix: `test:global:${Date.now()}:`,
        message: 'Global ceiling reached',
      });

      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as AuthRequest).user = { uid: 'user-global-1', email: 'global@example.com' };
        next();
      });
      app.post('/api/action-1', globalLimiter, (_req, res) => res.json({ success: true }));
      app.post('/api/action-2', globalLimiter, (_req, res) => res.json({ success: true }));

      expect((await request(app).post('/api/action-1')).status).toBe(200);
      expect((await request(app).post('/api/action-2')).status).toBe(200);
      expect((await request(app).post('/api/action-1')).status).toBe(200);

      // 4th request across actions hits global ceiling
      const res4 = await request(app).post('/api/action-2');
      expect(res4.status).toBe(429);
      expect(res4.body.error.code).toBe('AI_RATE_LIMITED');
      expect(res4.body.error.feature).toBe('global');
    });
  });

  describe('Concurrency protection for expensive generations', () => {
    it('blocks concurrent duplicate requests for the same user cleanly', async () => {
      const guard = createConcurrencyGuard(
        'chart',
        'CHART_PLAN_IN_PROGRESS',
        'A route plan is currently being generated. Please wait for it to complete.',
        req => {
          const authReq = req as AuthRequest;
          return authReq.user?.uid ? `test:chart:${authReq.user.uid}` : null;
        }
      );

      let releasePromise: () => void;
      const barrier = new Promise<void>(resolve => {
        releasePromise = resolve;
      });

      let req1StartedResolve: () => void;
      const req1Started = new Promise<void>(resolve => {
        req1StartedResolve = resolve;
      });

      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as AuthRequest).user = { uid: 'concurrent-user-1', email: 'conc@example.com' };
        next();
      });
      app.post('/api/chart/plan', guard, async (_req, res) => {
        req1StartedResolve();
        await barrier;
        res.json({ success: true });
      });

      // Launch request 1 (will pause at barrier)
      const req1Promise = request(app).post('/api/chart/plan').then(res => res);
      await req1Started;

      // Launch request 2 while request 1 is still in flight
      const req2Res = await request(app).post('/api/chart/plan');

      // Request 2 must be rejected immediately with 409
      expect(req2Res.status).toBe(409);
      expect(req2Res.body).toEqual({
        success: false,
        error: {
          code: 'CHART_PLAN_IN_PROGRESS',
          message: 'A route plan is currently being generated. Please wait for it to complete.',
          feature: 'chart',
        },
      });

      // Release request 1
      releasePromise!();
      const req1Res = await req1Promise;
      expect(req1Res.status).toBe(200);

      // Request 3 after completion succeeds cleanly
      const req3Res = await request(app).post('/api/chart/plan');
      expect(req3Res.status).toBe(200);
    });

    it('does not block different users from running generations concurrently', async () => {
      const guard = createConcurrencyGuard(
        'chart',
        'CHART_PLAN_IN_PROGRESS',
        'A route plan is currently being generated. Please wait for it to complete.',
        req => {
          const authReq = req as AuthRequest;
          return authReq.user?.uid ? `test:chart:${authReq.user.uid}` : null;
        }
      );

      let releasePromise: () => void;
      const barrier = new Promise<void>(resolve => {
        releasePromise = resolve;
      });

      let userAStartedResolve: () => void;
      const userAStarted = new Promise<void>(resolve => {
        userAStartedResolve = resolve;
      });
      let userBStartedResolve: () => void;
      const userBStarted = new Promise<void>(resolve => {
        userBStartedResolve = resolve;
      });

      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        const uid = req.headers['x-test-user'] as string;
        (req as AuthRequest).user = { uid, email: `${uid}@example.com` };
        next();
      });
      app.post('/api/chart/plan', guard, async (req, res) => {
        const uid = (req as AuthRequest).user?.uid;
        if (uid === 'user-a') userAStartedResolve();
        if (uid === 'user-b') userBStartedResolve();
        await barrier;
        res.json({ success: true, user: uid });
      });

      // User A starts
      const userAPromise = request(app).post('/api/chart/plan').set('x-test-user', 'user-a').then(res => res);
      await userAStarted;

      // User B starts concurrently
      const userBPromise = request(app).post('/api/chart/plan').set('x-test-user', 'user-b').then(res => res);
      await userBStarted;

      // Both are in-flight and not blocked by each other
      releasePromise!();
      const [resA, resB] = await Promise.all([userAPromise, userBPromise]);
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
    });
  });
});
