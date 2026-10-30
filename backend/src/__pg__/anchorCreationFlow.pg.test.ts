/** Real production HTTP routers and PostgreSQL; only external services are fixtures. */
import { randomUUID } from 'crypto';
import express from 'express';
import request from 'supertest';

const PG_URL = process.env.ANCHOR_CREATION_TEST_DATABASE_URL;
if (PG_URL) process.env.DATABASE_URL = PG_URL;
const describePg = PG_URL ? describe : describe.skip;
const mockIdentities = new Map<
  string,
  { uid: string; email?: string; firebase: { sign_in_provider: string } }
>();
const mockEntitlements = new Map<
  string,
  {
    isActive: boolean;
    isTrialPeriod: boolean;
    productIdentifier: string;
    expiresAt: string;
    trialStartedAt?: string;
  }
>();
const mockGenerate = jest.fn();

jest.mock('../config/firebase', () => ({
  getFirebaseAdmin: () => ({
    auth: () => ({
      verifyIdToken: async (token: string) => {
        const identity = mockIdentities.get(token);
        if (!identity)
          throw Object.assign(new Error('Invalid fixture token'), {
            code: 'auth/invalid-id-token',
          });
        return identity;
      },
      getUser: async (uid: string) => ({ uid, providerData: [{ providerId: 'password' }] }),
      deleteUser: async () => undefined,
    }),
  }),
}));
jest.mock('../services/RevenueCatEntitlementService', () => ({
  getRevenueCatAccess: async (id: string) =>
    mockEntitlements.get(id) ?? {
      isActive: false,
      isTrialPeriod: false,
      productIdentifier: null,
      expiresAt: null,
    },
}));
jest.mock('../services/AIEnhancer', () => ({
  enhanceSigilWithAI: (...args: unknown[]) => mockGenerate(...args),
  enhanceSigilWithControlNet: (...args: unknown[]) => mockGenerate(...args),
  estimateGenerationTime: () => 1,
  getCostEstimate: () => ({ amount: 1 }),
}));
jest.mock('../services/StorageService', () => ({
  isServerStoredAssetUrl: (url: string) => url.startsWith('http://localhost/'),
  resolveStoredAssetUrl: async (url: string) => url,
  uploadImageFromUrl: async (url: string) => url,
}));
jest.mock('../services/TTSService', () => ({
  generateAllMantraAudio: jest.fn(),
  isTTSAvailable: () => false,
  getAvailableVoicePresets: () => [],
}));
jest.mock('../services/AnalyticsService', () => ({
  BackendAnalyticsService: { track: jest.fn() },
}));

import { prisma } from '../lib/prisma';
import aiRouter from '../api/routes/ai';
import anchorsRouter from '../api/routes/anchors';
import authRouter from '../api/routes/auth';
import { errorHandler } from '../api/middleware/errorHandler';
import { guestAnchorPreviewLimiter } from '../api/middleware/aiRateLimit';
import { bodyComplexityGuard } from '../api/middleware/bodyComplexity';

const app = express();
// Match production's single trusted ingress proxy; fixture requests represent it.
app.set('trust proxy', 1);
app.use(express.json());
app.use(bodyComplexityGuard);
app.use('/api/ai', aiRouter);
app.use('/api/anchors', anchorsRouter);
app.use('/api/auth', authRouter);
app.use(errorHandler);

type Actor = { id: string; token: string; uid: string; ip?: string };
const fixtureIp = () =>
  `10.${parseInt(randomUUID().slice(0, 2), 16)}.${parseInt(randomUUID().slice(0, 2), 16)}.${parseInt(randomUUID().slice(0, 2), 16)}`;
async function actor(kind: 'trial' | 'pro' | 'free' | 'expired' | 'guest' = 'pro'): Promise<Actor> {
  const id = `http-${randomUUID()}`;
  const token = randomUUID();
  const uid = `firebase-${id}`;
  mockIdentities.set(token, {
    uid,
    ...(kind !== 'guest' ? { email: `${id}@isolated.test` } : {}),
    firebase: { sign_in_provider: kind === 'guest' ? 'anonymous' : 'password' },
  });
  await prisma.user.create({
    data: {
      id,
      authUid: uid,
      email: kind === 'guest' ? `${uid}@guest.anchor.invalid` : `${id}@isolated.test`,
      authProvider: kind === 'guest' ? 'anonymous' : 'firebase',
      subscriptionStatus: kind === 'expired' ? 'pro' : 'free',
    },
  });
  if (['trial', 'pro', 'expired'].includes(kind))
    mockEntitlements.set(id, {
      isActive: true,
      isTrialPeriod: kind === 'trial',
      productIdentifier: 'fixture-product',
      expiresAt: new Date(Date.now() + (kind === 'expired' ? -60_000 : 86_400_000)).toISOString(),
    });
  return { id, token, uid, ip: fixtureIp() };
}
const generation = (key = randomUUID()) => ({
  anchorId: `temp-${key}`,
  sigilSvg: `<svg><path d="M 0 0 L 10 10"/></svg>`,
  styleChoice: 'cosmic',
  intentionText: `HTTP quota ${key}`,
});
const post = (path: string, user: Actor, body: object) =>
  request(app)
    .post(path)
    .set('Authorization', `Bearer ${user.token}`)
    .set('X-Forwarded-For', user.ip ?? '127.0.0.1')
    .send(body);
async function reserve(user: Actor, body = generation(), key = randomUUID()) {
  return request(app)
    .post('/api/ai/creation-sessions')
    .set('Authorization', `Bearer ${user.token}`)
    .set('X-Forwarded-For', user.ip ?? '127.0.0.1')
    .set('Idempotency-Key', key)
    .send(body);
}
const sessionId = (response: request.Response): string =>
  response.body.creationSessionId ??
  response.body.data?.creationSessionId ??
  response.body.data?.id ??
  response.body.id;
async function create(user: Actor, body = generation()) {
  const reservation = await reserve(user, body);
  expect(reservation.status).toBe(200);
  const id = sessionId(reservation);
  expect(typeof id).toBe('string');
  const result = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
  return { result, id, body };
}
function saveBody(
  id: string,
  option: { optionId: string; imageUrl: string },
  original = generation(),
  extra: object = {}
) {
  return {
    intentionText: original.intentionText,
    category: 'health',
    distilledLetters: ['H', 'T'],
    baseSigilSvg: original.sigilSvg,
    enhancedImageUrl: option.imageUrl,
    creationSessionId: id,
    selectedOptionId: option.optionId,
    ...extra,
  };
}
const completed = (userId: string) =>
  prisma.anchorCreationSession.count({
    where: { owner: { userId }, status: 'completed' },
  });

describePg('Anchor creation production HTTP flow on isolated PostgreSQL', () => {
  jest.setTimeout(120_000);
  beforeAll(async () => {
    if (
      !PG_URL ||
      !/^postgresql:\/\/[^@]+@(?:127\.0\.0\.1|172\.\d+\.\d+\.\d+):\d+\/anchor_creation_http_/.test(
        PG_URL
      )
    ) {
      throw new Error('Explicit local isolated anchor_creation_http_ database required');
    }
    expect(
      await prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL`
    ).toEqual([{ count: expect.any(BigInt) }]);
  });
  beforeEach(() => {
    mockGenerate.mockReset();
    mockGenerate.mockImplementation(async (input: { numberOfVariations: number }) => ({
      variations: Array.from({ length: input.numberOfVariations }, (_, index) => ({
        imageUrl: `http://localhost/anchors/${randomUUID()}-${index}.png`,
        structureMatch: {
          combinedScore: 0.95,
          iouScore: 0.95,
          edgeOverlapScore: 0.95,
          structurePreserved: true,
          classification: 'Structure Preserved',
        },
        wasComposited: false,
        seed: index,
      })),
      passingCount: input.numberOfVariations,
      bestVariationIndex: 0,
      model: 'gemini-fixture',
      prompt: 'fixture',
      negativePrompt: '',
      generationTime: 1,
      controlMethod: 'lineart',
      styleApplied: 'cosmic',
      structureThreshold: 0.85,
    }));
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it.each([
    ['trial', 7],
    ['pro', 10],
  ] as const)('%s successful sessions 1-%i allowed; next denied', async (kind, limit) => {
    const user = await actor(kind);
    for (let i = 0; i < limit; i++) {
      const { result } = await create(user);
      expect(result.status).toBe(200);
      expect(result.body.variations).toHaveLength(2);
    }
    expect(await completed(user.id)).toBe(limit);
    const denied = await reserve(user);
    expect(denied.status).toBe(429);
    expect(await completed(user.id)).toBe(limit);
    expect(mockGenerate).toHaveBeenCalledTimes(limit);
  });

  it('two options consume one credit and duplicate requests return durable outputs', async () => {
    const user = await actor();
    const { result, id, body } = await create(user);
    expect(result.status).toBe(200);
    expect(result.body.variations).toHaveLength(2);
    const replay = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect(replay.status).toBe(200);
    expect(replay.body.variations.map((v: { optionId: string }) => v.optionId)).toEqual(
      result.body.variations.map((v: { optionId: string }) => v.optionId)
    );
    expect(await completed(user.id)).toBe(1);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('legacy authenticated enhance-controlnet alias uses the same session and durable options', async () => {
    const user = await actor('free');
    const body = generation();
    const reserved = await reserve(user, body);
    expect(reserved.status).toBe(200);
    const id = sessionId(reserved);
    const result = await post('/api/ai/enhance-controlnet', user, {
      ...body,
      creationSessionId: id,
    });
    expect(result.status).toBe(200);
    expect(result.body.variations).toHaveLength(2);
    const replay = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect(replay.status).toBe(200);
    expect(replay.body.variations.map((v: { optionId: string }) => v.optionId)).toEqual(
      result.body.variations.map((v: { optionId: string }) => v.optionId)
    );
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(await completed(user.id)).toBe(1);
    expect((await reserve(user)).status).toBe(429);
  });

  it('missing interpretation recovers in the same session for no additional credit', async () => {
    const user = await actor();
    const body = generation();
    const reservation = await reserve(user, body);
    expect(reservation.status).toBe(200);
    const id = sessionId(reservation);
    const first = await post('/api/ai/enhance', user, {
      ...body,
      creationSessionId: id,
      variationCount: 1,
    });
    expect(first.status).toBe(200);
    expect(first.body.variations).toHaveLength(1);
    const recovered = await post('/api/ai/enhance', user, {
      ...body,
      creationSessionId: id,
      variationCount: 2,
    });
    expect(recovered.status).toBe(200);
    expect(recovered.body.variations).toHaveLength(2);
    expect(await completed(user.id)).toBe(1);
    expect(mockGenerate.mock.calls.map(([input]) => input.numberOfVariations)).toEqual([1, 1]);
  });

  it('generation without usable output releases the unused free reservation', async () => {
    const user = await actor('free');
    mockGenerate.mockRejectedValueOnce(new Error('fixture provider failure'));
    const { result } = await create(user);
    expect(result.status).toBe(502);
    expect(await completed(user.id)).toBe(0);
    const replacement = await create(user);
    expect(replacement.result.status).toBe(200);
    expect(await completed(user.id)).toBe(1);
  });

  it('same idempotency key retries a failed provider call without a second credit', async () => {
    const user = await actor('free');
    const body = generation();
    const key = randomUUID();
    const initial = await reserve(user, body, key);
    expect(initial.status).toBe(200);
    const id = sessionId(initial);
    mockGenerate.mockRejectedValueOnce(new Error('fixture transient error'));
    const failed = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect(failed.status).toBe(502);
    const retry = await reserve(user, body, key);
    expect(retry.status).toBe(200);
    expect(sessionId(retry)).toBe(id);
    const output = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect(output.status).toBe(200);
    expect(await completed(user.id)).toBe(1);
    expect(
      await prisma.anchorCreationSession.count({ where: { owner: { userId: user.id } } })
    ).toBe(1);
  });

  it('unused prior-day Pro reservation cannot bypass the current UTC day quota', async () => {
    const user = await actor();
    const body = generation();
    const old = await reserve(user, body);
    expect(old.status).toBe(200);
    const id = sessionId(old);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await prisma.anchorCreationSession.update({
      where: { id },
      data: { quotaScope: `pro:${yesterday}`, createdAt: new Date(Date.now() - 86_400_000) },
    });
    for (let i = 0; i < 10; i++) expect((await create(user)).result.status).toBe(200);
    const stale = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect([409, 429]).toContain(stale.status);
    expect(await completed(user.id)).toBe(10);
    expect(mockGenerate).toHaveBeenCalledTimes(10);
  });

  it('provider crossing the UTC boundary cannot commit beyond the new day capacity', async () => {
    const user = await actor();
    for (let i = 0; i < 9; i++) expect((await create(user)).result.status).toBe(200);
    const body = generation();
    const pending = await reserve(user, body);
    expect(pending.status).toBe(200);
    const id = sessionId(pending);
    const originalProvider = mockGenerate.getMockImplementation()!;
    mockGenerate.mockImplementationOnce(async input => {
      // This real DB transition models an in-flight reservation belonging to the
      // previous UTC date when the provider finishes, without changing client time.
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      await prisma.anchorCreationSession.update({
        where: { id },
        data: { quotaScope: `pro:${yesterday}`, createdAt: new Date(Date.now() - 86_400_000) },
      });
      expect((await reserve(user)).status).toBe(200);
      return originalProvider(input);
    });
    const delayed = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect([409, 429]).toContain(delayed.status);
    expect(await completed(user.id)).toBe(9);
    expect(await prisma.anchorCreationOption.count({ where: { sessionId: id } })).toBe(0);
  });

  it('trial expiry extension, product changes and client clocks do not reset the verified trial budget', async () => {
    const user = await actor('trial');
    const trialStartedAt = new Date(Date.now() - 60_000).toISOString();
    mockEntitlements.set(user.id, { ...mockEntitlements.get(user.id)!, trialStartedAt });
    for (let i = 0; i < 7; i++) expect((await create(user)).result.status).toBe(200);
    mockEntitlements.set(user.id, {
      ...mockEntitlements.get(user.id)!,
      productIdentifier: 'changed-product',
      expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    });
    const denied = await reserve(user, {
      ...generation(),
      ...{ trialStartedAt: '2099-01-01', now: '2099-01-01', generationCount: 0 },
    });
    expect(denied.status).toBe(429);
    expect(await completed(user.id)).toBe(7);
    expect(mockGenerate).toHaveBeenCalledTimes(7);
  });

  it.each([
    ['trial', 7],
    ['pro', 10],
  ] as const)(
    'existing unledgered %s Anchors count toward the verified quota of %i',
    async (kind, count) => {
      const user = await actor(kind);
      mockEntitlements.set(user.id, {
        ...mockEntitlements.get(user.id)!,
        trialStartedAt: new Date(Date.now() - 60_000).toISOString(),
      });
      await prisma.anchor.createMany({
        data: Array.from({ length: count }, () => ({
          userId: user.id,
          intentionText: 'Preserved pre-ledger Anchor',
          category: 'health',
          distilledLetters: ['L'],
        })),
      });
      expect((await reserve(user)).status).toBe(429);
      expect(mockGenerate).not.toHaveBeenCalled();
      expect(await prisma.anchor.count({ where: { userId: user.id } })).toBe(count);
    }
  );

  it('six historical trial Anchors plus one new generation reach seven; saving does not double charge', async () => {
    const user = await actor('trial');
    mockEntitlements.set(user.id, {
      ...mockEntitlements.get(user.id)!,
      trialStartedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    await prisma.anchor.createMany({
      data: Array.from({ length: 6 }, () => ({
        userId: user.id,
        intentionText: 'Existing trial Anchor',
        category: 'health',
        distilledLetters: ['L'],
      })),
    });
    const { result, id, body } = await create(user);
    expect(result.status).toBe(200);
    const saved = await post('/api/anchors', user, saveBody(id, result.body.variations[0], body));
    expect(saved.status).toBe(201);
    expect(await prisma.anchor.count({ where: { userId: user.id } })).toBe(7);
    expect(await completed(user.id)).toBe(1);
    expect((await reserve(user)).status).toBe(429);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("trial-to-Pro upgrade retains today's seven successful sessions and allows only three more", async () => {
    const user = await actor('trial');
    mockEntitlements.set(user.id, {
      ...mockEntitlements.get(user.id)!,
      trialStartedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    for (let i = 0; i < 7; i++) expect((await create(user)).result.status).toBe(200);
    mockEntitlements.set(user.id, { ...mockEntitlements.get(user.id)!, isTrialPeriod: false });
    for (let i = 0; i < 3; i++) expect((await create(user)).result.status).toBe(200);
    expect((await reserve(user)).status).toBe(429);
    expect(await completed(user.id)).toBe(10);
    expect(mockGenerate).toHaveBeenCalledTimes(10);
  });

  it('a Pro reservation cannot generate after switching to a trial whose seven credits are consumed', async () => {
    const user = await actor('pro');
    for (let i = 0; i < 7; i++) expect((await create(user)).result.status).toBe(200);
    const body = generation();
    const pending = await reserve(user, body);
    expect(pending.status).toBe(200);
    const id = sessionId(pending);
    mockEntitlements.set(user.id, {
      ...mockEntitlements.get(user.id)!,
      isTrialPeriod: true,
      trialStartedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const denied = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect(denied.status).toBe(429);
    expect(denied.body.error.code).toBe('ANCHOR_CREATION_QUOTA_EXCEEDED');
    expect(mockGenerate).toHaveBeenCalledTimes(7);
    expect(await completed(user.id)).toBe(7);
    expect(await prisma.anchorCreationOption.count({ where: { sessionId: id } })).toBe(0);
  });

  it('same-key reservation rebinds from Pro to trial without counting its pending slot twice', async () => {
    const user = await actor('pro');
    for (let i = 0; i < 6; i++) expect((await create(user)).result.status).toBe(200);
    const body = generation();
    const key = randomUUID();
    const reserved = await reserve(user, body, key);
    expect(reserved.status).toBe(200);
    const id = sessionId(reserved);
    mockEntitlements.set(user.id, {
      ...mockEntitlements.get(user.id)!,
      isTrialPeriod: true,
      trialStartedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const rebound = await reserve(user, body, key);
    expect(rebound.status).toBe(200);
    expect(sessionId(rebound)).toBe(id);
    const output = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect(output.status).toBe(200);
    expect((await reserve(user)).status).toBe(429);
    expect(await completed(user.id)).toBe(7);
    expect(
      await prisma.anchorCreationSession.count({ where: { owner: { userId: user.id } } })
    ).toBe(7);
    expect(mockGenerate).toHaveBeenCalledTimes(7);
  });

  it.each(['free', 'trial'] as const)(
    'in-flight %s guest output cannot commit an eleventh credit after merging into a full Pro account',
    async kind => {
      const target = await actor('pro');
      for (let i = 0; i < 10; i++) expect((await create(target)).result.status).toBe(200);
      const guest = await actor('guest');
      if (kind === 'trial')
        mockEntitlements.set(guest.id, {
          isActive: true,
          isTrialPeriod: true,
          productIdentifier: 'fixture-guest-trial',
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          trialStartedAt: new Date(Date.now() - 60_000).toISOString(),
        });
      const body = generation();
      const reserved = await reserve(guest, body);
      expect(reserved.status).toBe(200);
      const id = sessionId(reserved);
      const originalProvider = mockGenerate.getMockImplementation()!;
      mockGenerate.mockImplementationOnce(async input => {
        expect(
          (await post('/api/auth/merge-guest', target, { guestIdToken: guest.token })).status
        ).toBe(200);
        return originalProvider(input);
      });
      const refused = await post('/api/ai/enhance', guest, { ...body, creationSessionId: id });
      expect(refused.status).toBe(429);
      expect(refused.body.error.code).toBe('ANCHOR_CREATION_QUOTA_EXCEEDED');
      expect(await completed(target.id)).toBe(10);
      expect(await prisma.anchorCreationOption.count({ where: { sessionId: id } })).toBe(0);
      expect((await prisma.anchorCreationSession.findUniqueOrThrow({ where: { id } })).status).toBe(
        'failed'
      );
      expect(mockGenerate).toHaveBeenCalledTimes(11);
    }
  );

  it('same free reservation key replays after save without a new session or credit', async () => {
    const user = await actor('free');
    const body = generation();
    const key = randomUUID();
    const reserved = await reserve(user, body, key);
    const id = sessionId(reserved);
    const result = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect(result.status).toBe(200);
    expect(
      (await post('/api/anchors', user, saveBody(id, result.body.variations[0], body))).status
    ).toBe(201);
    const replay = await reserve(user, body, key);
    expect(replay.status).toBe(200);
    expect(sessionId(replay)).toBe(id);
    expect(await completed(user.id)).toBe(1);
    expect(
      await prisma.anchorCreationSession.count({ where: { owner: { userId: user.id } } })
    ).toBe(1);
  });

  it('unused expired reservation releases capacity; expired session cannot generate', async () => {
    const user = await actor('free');
    const body = generation();
    const reserved = await reserve(user, body);
    expect(reserved.status).toBe(200);
    const id = sessionId(reserved);
    await prisma.anchorCreationSession.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const replacement = await reserve(user);
    expect(replacement.status).toBe(200);
    const stale = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect(stale.status).toBe(409);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(await completed(user.id)).toBe(0);
  });

  it('durable abandoned output stays charged and recoverable after reservation expiry', async () => {
    const user = await actor('free');
    const { result, id, body } = await create(user);
    expect(result.status).toBe(200);
    await prisma.anchorCreationSession.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const recovered = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect(recovered.status).toBe(200);
    expect(recovered.body.variations.map((v: { optionId: string }) => v.optionId)).toEqual(
      result.body.variations.map((v: { optionId: string }) => v.optionId)
    );
    expect((await reserve(user)).status).toBe(429);
    expect(await completed(user.id)).toBe(1);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('missing-option provider retries are bounded while existing usable output stays charged', async () => {
    const user = await actor();
    const body = generation();
    const reserved = await reserve(user, body);
    const id = sessionId(reserved);
    const initial = await post('/api/ai/enhance', user, {
      ...body,
      creationSessionId: id,
      variationCount: 1,
    });
    expect(initial.status).toBe(200);
    mockGenerate.mockRejectedValue(new Error('fixture recovery provider failure'));
    for (let i = 0; i < 3; i++) {
      expect((await post('/api/ai/enhance', user, { ...body, creationSessionId: id })).status).toBe(
        502
      );
    }
    const bounded = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect(bounded.status).toBe(429);
    expect(mockGenerate).toHaveBeenCalledTimes(4);
    expect(await completed(user.id)).toBe(1);
    expect(await prisma.anchorCreationOption.count({ where: { sessionId: id } })).toBe(1);
    const recovered = await request(app)
      .get(`/api/ai/creation-sessions/${id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(recovered.status).toBe(200);
    expect(recovered.body.variations).toHaveLength(1);
    expect(recovered.body.variations[0].optionId).toBe(initial.body.variations[0].optionId);
    expect(mockGenerate).toHaveBeenCalledTimes(4);
    expect(await completed(user.id)).toBe(1);
  });

  it('expired partial output is recoverable through an owned read without provider calls or another credit', async () => {
    const user = await actor();
    const body = generation();
    const reserved = await reserve(user, body);
    const id = sessionId(reserved);
    const initial = await post('/api/ai/enhance', user, {
      ...body,
      creationSessionId: id,
      variationCount: 1,
    });
    expect(initial.status).toBe(200);
    await prisma.anchorCreationSession.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const recovered = await request(app)
      .get(`/api/ai/creation-sessions/${id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(recovered.status).toBe(200);
    expect(recovered.body.status).toBe('completed');
    expect(recovered.body.variations).toHaveLength(1);
    expect(recovered.body.variations[0].optionId).toBe(initial.body.variations[0].optionId);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(await completed(user.id)).toBe(1);
  });

  it('read-only session recovery rejects unauthenticated and cross-account callers', async () => {
    const user = await actor();
    const stranger = await actor();
    const { result, id } = await create(user);
    expect(result.status).toBe(200);
    const cross = await request(app)
      .get(`/api/ai/creation-sessions/${id}`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(cross.status).toBe(404);
    const anonymous = await request(app).get(`/api/ai/creation-sessions/${id}`);
    expect(anonymous.status).toBe(401);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(await completed(user.id)).toBe(1);
  });

  it.each([
    ['trial', 7],
    ['pro', 10],
  ] as const)(
    'concurrent %s reservations never exceed %i available credits',
    async (kind, limit) => {
      const user = await actor(kind);
      const results = await Promise.all(Array.from({ length: limit + 5 }, () => reserve(user)));
      expect(
        results.map(r => ({ status: r.status, code: r.body.error?.code ?? r.body.error }))
      ).toEqual(
        expect.arrayContaining(
          Array.from({ length: limit }, () => ({ status: 200, code: undefined }))
        )
      );
      expect(results.map(r => r.status).sort()).toEqual([
        ...Array(limit).fill(200),
        ...Array(5).fill(429),
      ]);
      expect(
        await prisma.anchorCreationSession.count({
          where: { owner: { userId: user.id }, status: 'reserved' },
        })
      ).toBe(limit);
    }
  );

  it('concurrent idempotency keys reserve one credit and conflicting payload is rejected', async () => {
    const user = await actor();
    const body = generation();
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 5 }, () => reserve(user, body, key)));
    expect(responses.every(r => r.status === 200)).toBe(true);
    expect(new Set(responses.map(sessionId)).size).toBe(1);
    const conflict = await reserve(user, { ...body, intentionText: 'different set' }, key);
    expect(conflict.status).toBe(409);
  });

  it('cross-account session access and forged owner IDs cannot generate', async () => {
    const user = await actor();
    const stranger = await actor();
    const { result, id, body } = await create(user);
    expect(result.status).toBe(200);
    const forged = await post('/api/ai/enhance', stranger, {
      ...body,
      creationSessionId: id,
      userId: user.id,
      ownerId: user.id,
    });
    expect([403, 404]).toContain(forged.status);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it.each(['/api/ai/enhance', '/api/ai/enhance-controlnet'])(
    'legacy unauthenticated %s cannot bypass identity',
    async path => {
      const result = await request(app)
        .post(path)
        .send({ ...generation(), userId: randomUUID() });
      expect(result.status).toBe(426);
      expect(result.body.error.code).toBe('ANCHOR_CREATION_UPGRADE_REQUIRED');
      expect(mockGenerate).not.toHaveBeenCalled();
    }
  );

  it('authenticated legacy request cannot bypass required session accounting', async () => {
    const user = await actor();
    const result = await post('/api/ai/enhance', user, generation());
    expect([400, 426]).toContain(result.status);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('invalid Firebase credentials and arbitrary temporary IDs are rejected', async () => {
    const result = await request(app)
      .post('/api/ai/creation-sessions')
      .set('Authorization', 'Bearer forged-token')
      .send(generation());
    expect(result.status).toBe(401);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('original SVG saves and AI sessions share the trial quota; direct saves cannot bypass seven', async () => {
    const user = await actor('trial');
    for (let i = 0; i < 6; i++) expect((await create(user)).result.status).toBe(200);
    const original = {
      intentionText: 'Original geometry Anchor',
      category: 'health',
      distilledLetters: ['O', 'A'],
      baseSigilSvg: '<svg/>',
    };
    const seventh = await post('/api/anchors', user, { ...original, idempotencyKey: randomUUID() });
    expect(seventh.status).toBe(201);
    const eighth = await post('/api/anchors', user, { ...original, idempotencyKey: randomUUID() });
    expect(eighth.status).toBe(429);
    expect(await completed(user.id)).toBe(7);
    expect((await reserve(user)).status).toBe(429);
  });

  it('selected option saves once even with different client idempotency keys; saving never charges again', async () => {
    const user = await actor('free');
    const { result, id, body: original } = await create(user);
    expect(result.status).toBe(200);
    const body = saveBody(id, result.body.variations[0], original);
    const first = await post('/api/anchors', user, { ...body, idempotencyKey: randomUUID() });
    expect(first.status).toBe(201);
    const repeated = await post('/api/anchors', user, { ...body, idempotencyKey: randomUUID() });
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.id).toBe(first.body.data.id);
    expect(await prisma.anchor.count({ where: { userId: user.id } })).toBe(1);
    expect(await completed(user.id)).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).totalAnchorsCreated
    ).toBe(1);
    expect((await reserve(user)).status).toBe(403);
  });

  it('keeping original geometry after AI saves once using its existing free credit and stores no artwork', async () => {
    const user = await actor('free');
    const stranger = await actor();
    const { result, id, body } = await create(user);
    expect(result.status).toBe(200);
    expect(result.body.variations).toHaveLength(2);
    const original = {
      intentionText: body.intentionText,
      category: 'health',
      distilledLetters: ['O'],
      baseSigilSvg: body.sigilSvg,
      creationSessionId: id,
      keepOriginal: true,
      // The original choice must ignore even a supplied generated image.
      enhancedImageUrl: result.body.variations[1].imageUrl,
    };
    const cross = await post('/api/anchors', stranger, {
      ...original,
      idempotencyKey: randomUUID(),
    });
    expect(cross.status).toBe(403);
    const saved = await post('/api/anchors', user, { ...original, idempotencyKey: randomUUID() });
    expect(saved.status).toBe(201);
    expect(saved.body.data.enhancedImageUrl).toBeNull();
    expect(saved.body.data.baseSigilSvg).toBe(body.sigilSvg);
    const repeated = await post('/api/anchors', user, {
      ...original,
      idempotencyKey: randomUUID(),
    });
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.id).toBe(saved.body.data.id);
    expect(repeated.body.data.enhancedImageUrl).toBeNull();
    expect(await prisma.anchor.count({ where: { userId: user.id } })).toBe(1);
    expect(await completed(user.id)).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).totalAnchorsCreated
    ).toBe(1);
    expect((await reserve(user)).status).toBe(403);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('original-choice save cannot substitute geometry or intention or omit its claimed session', async () => {
    const user = await actor('free');
    const { result, id, body } = await create(user);
    expect(result.status).toBe(200);
    const original = {
      intentionText: body.intentionText,
      category: 'health',
      distilledLetters: ['O'],
      baseSigilSvg: body.sigilSvg,
      creationSessionId: id,
      keepOriginal: true,
    };
    expect((await post('/api/anchors', user, { ...original, baseSigilSvg: '<svg/>' })).status).toBe(
      403
    );
    expect(
      (
        await post('/api/anchors', user, {
          ...original,
          intentionText: 'Different unapproved input',
        })
      ).status
    ).toBe(403);
    expect(
      (await post('/api/anchors', user, { ...original, creationSessionId: undefined })).status
    ).toBe(426);
    expect(await prisma.anchor.count({ where: { userId: user.id } })).toBe(0);
    expect(await completed(user.id)).toBe(1);
  });

  it('concurrent saves of the two options produce only one saved Anchor', async () => {
    const user = await actor('free');
    const { result, id, body } = await create(user);
    expect(result.status).toBe(200);
    const responses = await Promise.all(
      result.body.variations.map((option: { optionId: string; imageUrl: string }) =>
        post('/api/anchors', user, saveBody(id, option, body, { idempotencyKey: randomUUID() }))
      )
    );
    expect(responses.map((r: request.Response) => r.status).sort()).toEqual([200, 201]);
    expect(new Set(responses.map((r: request.Response) => r.body.data.id)).size).toBe(1);
    expect(await prisma.anchor.count({ where: { userId: user.id } })).toBe(1);
    expect(await completed(user.id)).toBe(1);
  });

  it('forged save, cross-account save and mismatched selected option are denied', async () => {
    const user = await actor();
    const stranger = await actor();
    const first = await create(user);
    const second = await create(stranger);
    const cross = await post(
      '/api/anchors',
      stranger,
      saveBody(first.id, first.result.body.variations[0], first.body)
    );
    expect([403, 404]).toContain(cross.status);
    const mismatch = await post(
      '/api/anchors',
      user,
      saveBody(first.id, second.result.body.variations[0], first.body)
    );
    expect([403, 404]).toContain(mismatch.status);
    const forged = await post(
      '/api/anchors',
      user,
      saveBody(randomUUID(), { optionId: randomUUID(), imageUrl: 'http://localhost/forged.png' })
    );
    expect([403, 404]).toContain(forged.status);
    expect(await prisma.anchor.count({ where: { userId: { in: [user.id, stranger.id] } } })).toBe(
      0
    );
  });

  it('enhanced artwork cannot be saved without a session or with substituted geometry', async () => {
    const user = await actor();
    const { result, id, body } = await create(user);
    expect(result.status).toBe(200);
    const selected = saveBody(id, result.body.variations[0], body);
    const legacy = { ...selected } as Record<string, unknown>;
    delete legacy.creationSessionId;
    delete legacy.selectedOptionId;
    const noSession = await post('/api/anchors', user, legacy);
    expect([400, 403, 426]).toContain(noSession.status);
    const tampered = await post('/api/anchors', user, {
      ...selected,
      baseSigilSvg: '<svg><circle r="3"/></svg>',
    });
    expect([403, 409]).toContain(tampered.status);
    expect(await prisma.anchor.count({ where: { userId: user.id } })).toBe(0);
  });

  it("forged pool metadata cannot consume another account's reserved generated variation", async () => {
    const user = await actor();
    const stranger = await actor();
    const first = await create(user);
    const second = await create(stranger);
    const selected = first.result.body.variations[0];
    const other = second.result.body.variations[0];
    const saved = await post(
      '/api/anchors',
      user,
      saveBody(first.id, selected, first.body, {
        enhancementMetadata: {
          variationId: other.variationId,
          reuseRequestId: second.result.body.reuseRequestId,
        },
      })
    );
    expect(saved.status).toBe(201);
    const untouched = await prisma.anchorVariationPool.findUniqueOrThrow({
      where: { id: other.variationId },
    });
    expect(untouched.status).toBe('reserved');
    expect(untouched.selectedByAnchorId).toBeNull();
    const consumed = await prisma.anchorVariationPool.findUniqueOrThrow({
      where: { id: selected.variationId },
    });
    expect(consumed.status).toBe('consumed');
    expect(consumed.selectedByAnchorId).toBe(saved.body.data.id);
  });

  it('artwork PUT requires owned generated options and cannot reuse an enhancement to create another Anchor', async () => {
    const user = await actor();
    const stranger = await actor();
    const first = await create(user);
    expect(first.result.status).toBe(200);
    const saved = await post(
      '/api/anchors',
      user,
      saveBody(first.id, first.result.body.variations[0], first.body)
    );
    expect(saved.status).toBe(201);
    const anchorId = saved.body.data.id;
    const body = { ...first.body, anchorId };
    const reserved = await reserve(user, body);
    expect(reserved.status).toBe(200);
    const id = sessionId(reserved);
    const options = await post('/api/ai/enhance', user, { ...body, creationSessionId: id });
    expect(options.status).toBe(200);
    const option = options.body.variations[0];
    const replacement = {
      enhancedImageUrl: option.imageUrl,
      creationSessionId: id,
      selectedOptionId: option.optionId,
    };
    const put = (who: Actor, patch: object) =>
      request(app)
        .put(`/api/anchors/${anchorId}`)
        .set('Authorization', `Bearer ${who.token}`)
        .send(patch);
    const noProof = await put(user, { enhancedImageUrl: 'http://localhost/forged-art.png' });
    expect([400, 403, 426]).toContain(noProof.status);
    const cross = await put(stranger, replacement);
    expect([403, 404]).toContain(cross.status);
    const forged = await put(user, { ...replacement, selectedOptionId: randomUUID() });
    expect([403, 404]).toContain(forged.status);
    const valid = await put(user, replacement);
    expect(valid.status).toBe(200);
    expect(valid.body.data.enhancedImageUrl).toBe(option.imageUrl);
    const reused = await post(
      '/api/anchors',
      user,
      saveBody(id, option, body, { idempotencyKey: randomUUID() })
    );
    expect(reused.status).toBe(200);
    expect(reused.body.data.id).toBe(anchorId);
    expect(await prisma.anchor.count({ where: { userId: user.id } })).toBe(1);
    expect(await completed(user.id)).toBe(2);
  });

  it('expired persisted Pro status cannot authorize a second free generation', async () => {
    const user = await actor('expired');
    await prisma.user.update({ where: { id: user.id }, data: { totalAnchorsCreated: 1 } });
    const result = await reserve(user);
    expect(result.status).toBe(403);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('premium entitlement expiring after reservation cannot authorize generation', async () => {
    const user = await actor();
    await prisma.user.update({ where: { id: user.id }, data: { totalAnchorsCreated: 1 } });
    const body = generation();
    const reservation = await reserve(user, body);
    expect(reservation.status).toBe(200);
    mockEntitlements.set(user.id, {
      isActive: true,
      isTrialPeriod: false,
      productIdentifier: 'fixture-product',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const result = await post('/api/ai/enhance', user, {
      ...body,
      creationSessionId: sessionId(reservation),
    });
    expect(result.status).toBe(403);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(await completed(user.id)).toBe(0);
  });

  it('new verified Firebase guest syncs without an email and can start onboarding creation', async () => {
    const uid = `firebase-guest-${randomUUID()}`;
    const token = randomUUID();
    mockIdentities.set(token, { uid, firebase: { sign_in_provider: 'anonymous' } });
    const guest = { uid, token, id: '' };
    const sync = await post('/api/auth/sync', guest, { hasCompletedOnboarding: false });
    expect(sync.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { authUid: uid } });
    const { result } = await create({ ...guest, id: user.id });
    expect(result.status).toBe(200);
    expect(await completed(user.id)).toBe(1);
  });

  it('existing saved Anchor remains accessible after subscription expires', async () => {
    const user = await actor('expired');
    const anchor = await prisma.anchor.create({
      data: {
        userId: user.id,
        intentionText: 'Existing 1.5 Anchor',
        category: 'health',
        distilledLetters: ['E'],
      },
    });
    const result = await request(app)
      .get(`/api/anchors/${anchor.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(result.status).toBe(200);
    expect(result.body.data.id).toBe(anchor.id);
  });

  it('verified persistent guest UID creates and saves, then account linking preserves identity and quota', async () => {
    const user = await actor('guest');
    const { result, id, body } = await create(user);
    expect(result.status).toBe(200);
    const saved = await post('/api/anchors', user, saveBody(id, result.body.variations[0], body));
    expect(saved.status).toBe(201);
    // Firebase linkWithCredential preserves UID; only verified token claims change.
    mockIdentities.set(user.token, {
      uid: user.uid,
      email: `${randomUUID()}@linked.test`,
      firebase: { sign_in_provider: 'password' },
    });
    const sync = await post('/api/auth/sync', user, {
      authProvider: 'email',
      hasCompletedOnboarding: true,
    });
    expect(sync.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { authUid: user.uid } })).id).toBe(
      user.id
    );
    expect(await completed(user.id)).toBe(1);
    const owned = await request(app)
      .get(`/api/anchors/${saved.body.data.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(owned.status).toBe(200);
    expect((await reserve(user)).status).toBe(403);
  });

  it('verified guest merge into an existing account preserves saved Anchor and consumed quota', async () => {
    const guest = await actor('guest');
    const registered = await actor('free');
    const { result, id, body } = await create(guest);
    expect(result.status).toBe(200);
    const saved = await post('/api/anchors', guest, saveBody(id, result.body.variations[0], body));
    expect(saved.status).toBe(201);
    const merged = await post('/api/auth/merge-guest', registered, { guestIdToken: guest.token });
    expect(merged.status).toBe(200);
    expect(
      (await prisma.anchor.findUniqueOrThrow({ where: { id: saved.body.data.id } })).userId
    ).toBe(registered.id);
    expect(await completed(registered.id)).toBe(1);
    expect((await reserve(registered)).status).toBe(403);
    const staleGuest = await reserve(guest);
    expect([403, 409]).toContain(staleGuest.status);
    const accessible = await request(app)
      .get(`/api/anchors/${saved.body.data.id}`)
      .set('Authorization', `Bearer ${registered.token}`);
    expect(accessible.status).toBe(200);
    const replay = await post('/api/auth/merge-guest', registered, { guestIdToken: guest.token });
    expect([200, 409]).toContain(replay.status);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: registered.id } })).totalAnchorsCreated
    ).toBe(1);
  });

  it("guest output merged into Pro counts toward today's ten and keeps its idempotency replay", async () => {
    const guest = await actor('guest');
    const target = await actor('pro');
    const body = generation();
    const key = randomUUID();
    const reserved = await reserve(guest, body, key);
    const id = sessionId(reserved);
    expect((await post('/api/ai/enhance', guest, { ...body, creationSessionId: id })).status).toBe(
      200
    );
    expect(
      (await post('/api/auth/merge-guest', target, { guestIdToken: guest.token })).status
    ).toBe(200);
    const replay = await reserve(target, body, key);
    expect(replay.status).toBe(200);
    expect(sessionId(replay)).toBe(id);
    for (let i = 0; i < 9; i++) expect((await create(target)).result.status).toBe(200);
    expect((await reserve(target)).status).toBe(429);
    expect(await completed(target.id)).toBe(10);
    expect(mockGenerate).toHaveBeenCalledTimes(10);
  });

  it('guest output from before a new verified trial window remains saved in history without consuming that trial', async () => {
    const guest = await actor('guest');
    const target = await actor('trial');
    const old = await create(guest);
    expect(old.result.status).toBe(200);
    const beforeTrial = new Date(Date.now() - 3_600_000);
    await prisma.anchorCreationSession.update({
      where: { id: old.id },
      data: { createdAt: beforeTrial, completedAt: beforeTrial },
    });
    mockEntitlements.set(target.id, {
      ...mockEntitlements.get(target.id)!,
      trialStartedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(
      (await post('/api/auth/merge-guest', target, { guestIdToken: guest.token })).status
    ).toBe(200);
    for (let i = 0; i < 7; i++) expect((await create(target)).result.status).toBe(200);
    expect((await reserve(target)).status).toBe(429);
    expect(await completed(target.id)).toBe(8);
    expect(
      (await prisma.anchorCreationSession.findUniqueOrThrow({ where: { id: old.id } })).completedAt
    ).toEqual(beforeTrial);
  });

  it('account deletion removes saved output and its restricting creation ledger rows', async () => {
    const user = await actor();
    const { result, id, body } = await create(user);
    const saved = await post('/api/anchors', user, saveBody(id, result.body.variations[0], body));
    expect(saved.status).toBe(201);
    const owner = await prisma.anchorCreationQuotaOwner.findUniqueOrThrow({
      where: { userId: user.id },
    });
    const deleted = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.authAccountDeleted).toBe(true);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.anchor.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.anchorCreationOption.count({ where: { sessionId: id } })).toBe(0);
    expect(await prisma.anchorCreationSession.count({ where: { ownerId: owner.id } })).toBe(0);
    expect(
      await prisma.anchorCreationQuotaOwner.findUnique({ where: { id: owner.id } })
    ).toBeNull();
  });

  it('guest merge rejects forged credentials and a registered third-party account token', async () => {
    const registered = await actor();
    const other = await actor();
    const forged = await post('/api/auth/merge-guest', registered, {
      guestIdToken: 'forged-token',
    });
    expect([401, 403]).toContain(forged.status);
    const thirdParty = await post('/api/auth/merge-guest', registered, {
      guestIdToken: other.token,
    });
    expect(thirdParty.status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).authUid).toBe(
      other.uid
    );
  });

  it('durable guest transfer proof survives Firebase token expiry and cannot transfer to another account', async () => {
    const guest = await actor('guest');
    const target = await actor('free');
    const attacker = await actor('free');
    const { result, id, body } = await create(guest);
    const saved = await post('/api/anchors', guest, saveBody(id, result.body.variations[0], body));
    expect(saved.status).toBe(201);
    const proof = await post('/api/auth/guest-transfer-token', guest, {});
    expect(proof.status).toBe(200);
    expect(proof.body.data.guestUid).toBe(guest.uid);
    expect(proof.body.data.transferToken).toMatch(/^[a-f0-9]{64}$/);
    const stored = await prisma.anchorCreationQuotaOwner.findUniqueOrThrow({
      where: { userId: guest.id },
    });
    expect(stored.guestTokenHash).not.toBe(proof.body.data.transferToken);
    const forged = await post('/api/auth/merge-guest', attacker, {
      guestUid: guest.uid,
      transferToken: '0'.repeat(64),
    });
    expect(forged.status).toBe(403);
    mockIdentities.delete(guest.token);
    const merged = await post('/api/auth/merge-guest', target, proof.body.data);
    expect(merged.status).toBe(200);
    const replay = await post('/api/auth/merge-guest', target, proof.body.data);
    expect(replay.status).toBe(200);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).totalAnchorsCreated
    ).toBe(1);
    const stolen = await post('/api/auth/merge-guest', attacker, proof.body.data);
    expect(stolen.status).toBe(403);
    expect(
      (await prisma.anchor.findUniqueOrThrow({ where: { id: saved.body.data.id } })).userId
    ).toBe(target.id);
    expect(await completed(target.id)).toBe(1);
  });

  it.each(['guest', 'free', 'registered-after-reserving'] as const)(
    'PostgreSQL free creation abuse ceiling survives %s identity cycling and process-local limiter resets',
    async kind => {
      const ip = fixtureIp();
      for (let i = 0; i < 21; i++) {
        const guest = { ...(await actor(kind === 'free' ? 'free' : 'guest')), ip };
        // Models replicas/restarts losing their process-local cost limiter. The
        // authoritative PostgreSQL budget remains untouched throughout this test.
        guestAnchorPreviewLimiter.resetKey(`rl:ai:anchor:guest-daily:ip:${ip}`);
        const body = generation();
        const reservation = await reserve(guest, body);
        expect(reservation.status).toBe(200);
        if (kind === 'registered-after-reserving') {
          // Firebase credential linking preserves UID but changes token claims.
          // A caller can reach generation before its profile sync finishes.
          mockIdentities.set(guest.token, {
            uid: guest.uid,
            email: `${guest.uid}@linked.test`,
            firebase: { sign_in_provider: 'password' },
          });
        }
        const output = await post('/api/ai/enhance', guest, {
          ...body,
          creationSessionId: sessionId(reservation),
        });
        if (i < 20) {
          expect(output.status).toBe(200);
          expect(await completed(guest.id)).toBe(1);
        } else {
          expect(output.status).toBe(429);
          expect(output.body.error.code).toBe('GUEST_CREATION_LIMIT');
          expect(await completed(guest.id)).toBe(0);
        }
      }
      expect(mockGenerate).toHaveBeenCalledTimes(20);
    }
  );
});
