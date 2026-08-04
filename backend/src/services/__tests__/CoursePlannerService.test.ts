/**
 * Phase 0 amendment F1 enforcement inside the planner service.
 *
 * Covers the generation gate (nothing reaches the provider after a fail-closed
 * decision), what does and does not consume a quota unit, cap-edge concurrency,
 * deterministic fallback accounting, acceptance, and privacy boundaries.
 */

const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

/**
 * The planner resolves its credential through the validated `env` singleton,
 * which is captured at module load, so it has to be mocked rather than set via
 * `process.env`. Only the key is server-side configuration; the model, timeout,
 * and caps stay process-env overridable.
 */
const mockEnv: { GOOGLE_API_KEY?: string } = { GOOGLE_API_KEY: 'test-key' };
jest.mock('../../config/env', () => ({ env: mockEnv }));

const mockGetRevenueCatAccess = jest.fn();
jest.mock('../RevenueCatEntitlementService', () => ({
  getRevenueCatAccess: mockGetRevenueCatAccess,
}));

const mockCreateCourseFromProposal = jest.fn();
const mockGetCourse = jest.fn();
jest.mock('../CourseService', () => ({
  createPublishedCourseFromProposal: mockCreateCourseFromProposal,
  courseService: { getCourse: mockGetCourse },
}));

const mockPrisma = {
  aIPlanProposal: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};
jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

import { Prisma } from '@prisma/client';
import { CoursePlannerService } from '../CoursePlannerService';
import type { PlannerEntitlementUser } from '../PlannerEntitlementService';
import { AppError } from '../../api/middleware/errorHandler';

const NOW = new Date('2026-08-03T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const service = new CoursePlannerService();

const QUOTA_ENV_KEYS = [
  'CHART_PLANNER_TRIAL_LIFETIME_CAP',
  'CHART_PLANNER_PRO_DAILY_CAP',
  'CHART_PLANNER_FREE_CAP',
  'CHART_PLANNER_EXPIRED_CAP',
];

function user(overrides: Partial<PlannerEntitlementUser> = {}): PlannerEntitlementUser {
  return {
    id: 'user-1',
    isComped: false,
    subscriptionStatus: 'free',
    subscriptionId: null,
    trialStartedAt: new Date(NOW.getTime() - DAY_MS),
    ...overrides,
  };
}

const proUser = () => user({ isComped: true });
const expiredUser = () => user({ trialStartedAt: new Date(NOW.getTime() - 30 * DAY_MS) });

const INPUT = { destinationText: 'Complete a portfolio', idempotencyKey: 'plan-1' };

function persistedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proposal-1',
    userId: 'user-1',
    courseId: null,
    baseCourseVersion: null,
    plannerVersion: '1',
    modelVersion: 'gemini-2.0-flash',
    // sha256 of the normalized destination, filled in by the service; tests that
    // need a matching hash read it from the create() call instead.
    inputHash: 'hash',
    generationSource: 'gemini',
    fallbackReason: null,
    destinationInterpretation: 'Complete a portfolio',
    waypoints: [
      {
        clientKey: '5b4a2a6e-9f4c-4f6e-9c5a-1f2e3d4c5b6a',
        title: 'Clarify the target',
        description: 'Define what a useful result would look like.',
      },
    ],
    status: 'PENDING',
    createdAt: NOW,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    acceptedAt: null,
    idempotencyKey: 'scoped',
    ...overrides,
  };
}

function goodProviderResponse() {
  return {
    text: JSON.stringify({
      destinationInterpretation: 'Complete a portfolio',
      waypoints: [
        { title: 'Clarify the target', description: 'Define what a useful result looks like.' },
      ],
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of QUOTA_ENV_KEYS) delete process.env[key];
  mockEnv.GOOGLE_API_KEY = 'test-key';
  mockGetRevenueCatAccess.mockResolvedValue(null);
  mockPrisma.aIPlanProposal.findUnique.mockResolvedValue(null);
  mockPrisma.aIPlanProposal.count.mockResolvedValue(0);
  mockPrisma.aIPlanProposal.create.mockImplementation(async ({ data }: any) =>
    persistedRow({ ...data, id: 'proposal-new' })
  );
  // The serializable helper runs its callback against a transaction client.
  mockPrisma.$transaction.mockImplementation(async (work: any) => work(mockPrisma));
  mockGenerateContent.mockResolvedValue(goodProviderResponse());
});

describe('generation gate — fail closed', () => {
  it('denies generation and skips the provider when quota config is malformed', async () => {
    process.env.CHART_PLANNER_TRIAL_LIFETIME_CAP = 'not-a-number';

    await expect(service.generate(proUser(), INPUT, NOW)).rejects.toMatchObject({
      code: 'PLANNER_UNAVAILABLE',
      statusCode: 403,
      meta: { reason: 'quota_config_unavailable' },
    });
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockPrisma.aIPlanProposal.create).not.toHaveBeenCalled();
  });

  it('denies generation and skips the provider when entitlement is unresolvable', async () => {
    await expect(
      service.generate(user({ trialStartedAt: null }), INPUT, NOW)
    ).rejects.toMatchObject({
      code: 'PLANNER_UNAVAILABLE',
      meta: { reason: 'entitlement_unavailable' },
    });
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockPrisma.aIPlanProposal.create).not.toHaveBeenCalled();
  });

  it('denies an expired account and skips the provider', async () => {
    await expect(service.generate(expiredUser(), INPUT, NOW)).rejects.toMatchObject({
      code: 'PLANNER_NOT_ENTITLED',
      meta: { reason: 'entitlement_expired' },
    });
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockPrisma.aIPlanProposal.create).not.toHaveBeenCalled();
  });

  it('denies an exhausted trial and skips the provider', async () => {
    mockPrisma.aIPlanProposal.count.mockResolvedValue(3);

    await expect(service.generate(user(), INPUT, NOW)).rejects.toMatchObject({
      code: 'PLANNER_QUOTA_EXCEEDED',
      meta: { reason: 'quota_exhausted', limit: 3, remaining: 0 },
    });
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockPrisma.aIPlanProposal.create).not.toHaveBeenCalled();
  });

  it('denies an exhausted Pro day and skips the provider', async () => {
    mockPrisma.aIPlanProposal.count.mockResolvedValue(10);

    await expect(service.generate(proUser(), INPUT, NOW)).rejects.toMatchObject({
      code: 'PLANNER_QUOTA_EXCEEDED',
      meta: { limit: 10, remaining: 0, resetAt: '2026-08-04T00:00:00.000Z' },
    });
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('carries no user text or provider detail in a denial', async () => {
    mockPrisma.aIPlanProposal.count.mockResolvedValue(3);

    const error: AppError = await service
      .generate(user(), INPUT, NOW)
      .then(() => {
        throw new Error('expected a denial');
      })
      .catch((cause: AppError) => cause);
    const serialized = JSON.stringify({ message: error.message, meta: error.meta });
    expect(serialized).not.toContain('Complete a portfolio');
    expect(serialized).not.toContain('gemini');
    expect(serialized).not.toContain('test-key');
  });
});

describe('quota accounting', () => {
  it('consumes exactly one unit for a successfully persisted proposal', async () => {
    await service.generate(user(), INPUT, NOW);
    expect(mockPrisma.aIPlanProposal.create).toHaveBeenCalledTimes(1);
  });

  it('consumes nothing when the same idempotency key is replayed', async () => {
    const created = await service.generate(user(), INPUT, NOW);
    const createArgs = mockPrisma.aIPlanProposal.create.mock.calls[0][0].data;
    mockPrisma.aIPlanProposal.create.mockClear();
    mockPrisma.aIPlanProposal.findUnique.mockResolvedValue(persistedRow(createArgs));

    const replay = await service.generate(user(), INPUT, NOW);

    expect(replay.destinationInterpretation).toBe(created.destinationInterpretation);
    expect(mockPrisma.aIPlanProposal.create).not.toHaveBeenCalled();
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('resolves a concurrent duplicate to the single winning proposal', async () => {
    // Both requests carry the same idempotency key. The loser's insert hits the
    // unique constraint and reads back the winner rather than persisting a
    // second proposal, so the pair consumes one unit in total.
    let winner: Record<string, unknown> | null = null;
    mockPrisma.aIPlanProposal.findUnique.mockImplementation(async () => winner);
    mockPrisma.aIPlanProposal.create.mockImplementationOnce(async ({ data }: any) => {
      winner = persistedRow({ ...data, id: 'winner' });
      return winner;
    });
    mockPrisma.aIPlanProposal.create.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      });
    });

    const [first, second] = await Promise.all([
      service.generate(user(), INPUT, NOW),
      service.generate(user(), INPUT, NOW),
    ]);

    expect(first.proposalId).toBe('winner');
    expect(second.proposalId).toBe('winner');
    expect(mockPrisma.aIPlanProposal.create).toHaveBeenCalledTimes(2);
    // Only one insert survived.
    expect(winner).not.toBeNull();
  });

  it('cannot exceed the cap when a concurrent request takes the final slot', async () => {
    // Pre-check sees room; by the time the transaction runs, the slot is gone.
    mockPrisma.aIPlanProposal.count
      .mockResolvedValueOnce(2)
      .mockResolvedValue(3);

    await expect(service.generate(user(), INPUT, NOW)).rejects.toMatchObject({
      code: 'PLANNER_QUOTA_EXCEEDED',
      meta: { reason: 'quota_exhausted' },
    });
    // The provider ran, but nothing was persisted, so no unit was consumed.
    expect(mockPrisma.aIPlanProposal.create).not.toHaveBeenCalled();
  });

  it('re-counts inside the transaction rather than trusting the pre-check', async () => {
    await service.generate(user(), INPUT, NOW);
    expect(mockPrisma.aIPlanProposal.count).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    );
  });

  it('consumes nothing when the provider times out before persistence', async () => {
    mockGenerateContent.mockRejectedValue(new Error('provider_timeout'));
    // Persisting the deterministic fallback is what consumes the unit, so block
    // it here to isolate the pre-persistence failure.
    mockPrisma.aIPlanProposal.create.mockRejectedValue(new Error('db down'));

    await expect(service.generate(user(), INPUT, NOW)).rejects.toThrow('db down');
    expect(mockPrisma.aIPlanProposal.create).toHaveBeenCalledTimes(1);
  });

  it('consumes one unit when a deterministic fallback is persisted', async () => {
    mockGenerateContent.mockRejectedValue(new Error('provider_timeout'));

    const proposal = await service.generate(user(), INPUT, NOW);

    expect(proposal.generationSource).toBe('deterministic_fallback');
    expect(proposal.fallbackReason).toBe('timeout');
    expect(mockPrisma.aIPlanProposal.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.aIPlanProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ modelVersion: 'deterministic-v1' }),
      })
    );
  });

  it('falls back rather than persisting schema-invalid provider output', async () => {
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ nope: true }) });

    const proposal = await service.generate(user(), INPUT, NOW);

    expect(proposal.generationSource).toBe('deterministic_fallback');
    expect(proposal.fallbackReason).toBe('unavailable_or_invalid');
  });

  it('consumes nothing on retrieval', async () => {
    mockPrisma.aIPlanProposal.findFirst.mockResolvedValue(persistedRow());

    await service.get('user-1', 'proposal-1');

    expect(mockPrisma.aIPlanProposal.create).not.toHaveBeenCalled();
    expect(mockPrisma.aIPlanProposal.count).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('scopes retrieval to the owning account', async () => {
    mockPrisma.aIPlanProposal.findFirst.mockResolvedValue(null);

    await expect(service.get('user-2', 'proposal-1')).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
    });
    expect(mockPrisma.aIPlanProposal.findFirst).toHaveBeenCalledWith({
      where: { id: 'proposal-1', userId: 'user-2' },
    });
  });

  it('creates no Course or Waypoint rows during generation', async () => {
    await service.generate(user(), INPUT, NOW);
    expect(mockCreateCourseFromProposal).not.toHaveBeenCalled();
  });
});

describe('acceptance', () => {
  beforeEach(() => {
    mockCreateCourseFromProposal.mockResolvedValue({ id: 'course-1', waypoints: [] });
    mockPrisma.aIPlanProposal.update.mockResolvedValue({});
  });

  it('consumes no generation quota and never calls the provider', async () => {
    mockPrisma.aIPlanProposal.findFirst.mockResolvedValue(persistedRow());

    await service.accept('user-1', { proposalId: 'proposal-1', idempotencyKey: 'accept-1' });

    expect(mockPrisma.aIPlanProposal.count).not.toHaveBeenCalled();
    expect(mockPrisma.aIPlanProposal.create).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('accepts an eligible owned proposal after entitlement loss', async () => {
    // Acceptance takes no entitlement input at all, which is what allows an
    // already-generated proposal to remain acceptable after expiry.
    mockPrisma.aIPlanProposal.findFirst.mockResolvedValue(persistedRow());

    const course = await service.accept('user-1', {
      proposalId: 'proposal-1',
      idempotencyKey: 'accept-1',
    });

    expect(course).toMatchObject({ id: 'course-1' });
    expect(mockCreateCourseFromProposal).toHaveBeenCalledTimes(1);
  });

  it('uses canonical Course creation and marks the proposal accepted', async () => {
    mockPrisma.aIPlanProposal.findFirst.mockResolvedValue(persistedRow());

    await service.accept('user-1', { proposalId: 'proposal-1', idempotencyKey: 'accept-1' });

    expect(mockCreateCourseFromProposal).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({
        userId: 'user-1',
        proposalId: 'proposal-1',
        destinationText: 'Complete a portfolio',
        waypoints: [
          {
            title: 'Clarify the target',
            description: 'Define what a useful result would look like.',
          },
        ],
      })
    );
    expect(mockPrisma.aIPlanProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACCEPTED', courseId: 'course-1' }),
      })
    );
  });

  it('replays an already-accepted proposal without creating a second Course', async () => {
    mockPrisma.aIPlanProposal.findFirst.mockResolvedValue(
      persistedRow({ status: 'ACCEPTED', courseId: 'course-1' })
    );
    mockGetCourse.mockResolvedValue({ id: 'course-1' });

    const course = await service.accept('user-1', {
      proposalId: 'proposal-1',
      idempotencyKey: 'accept-1',
    });

    expect(course).toMatchObject({ id: 'course-1' });
    expect(mockCreateCourseFromProposal).not.toHaveBeenCalled();
  });

  it('refuses an expired proposal', async () => {
    mockPrisma.aIPlanProposal.findFirst.mockResolvedValue(
      persistedRow({ expiresAt: new Date(Date.now() - 1000) })
    );

    await expect(
      service.accept('user-1', { proposalId: 'proposal-1', idempotencyKey: 'accept-1' })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockCreateCourseFromProposal).not.toHaveBeenCalled();
  });

  it('refuses a superseded or rejected proposal', async () => {
    mockPrisma.aIPlanProposal.findFirst.mockResolvedValue(persistedRow({ status: 'DISMISSED' }));

    await expect(
      service.accept('user-1', { proposalId: 'proposal-1', idempotencyKey: 'accept-1' })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockCreateCourseFromProposal).not.toHaveBeenCalled();
  });

  it('refuses a proposal owned by another account', async () => {
    mockPrisma.aIPlanProposal.findFirst.mockResolvedValue(null);

    await expect(
      service.accept('user-2', { proposalId: 'proposal-1', idempotencyKey: 'accept-1' })
    ).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' });
  });

  it('surfaces the frozen one-active-Course conflict from canonical creation', async () => {
    mockPrisma.aIPlanProposal.findFirst.mockResolvedValue(persistedRow());
    mockCreateCourseFromProposal.mockRejectedValue(
      new AppError('An active Course already exists', 409, 'ACTIVE_COURSE_EXISTS')
    );

    await expect(
      service.accept('user-1', { proposalId: 'proposal-1', idempotencyKey: 'accept-1' })
    ).rejects.toMatchObject({ code: 'ACTIVE_COURSE_EXISTS' });
  });
});

describe('provider boundary and privacy', () => {
  it('sends only the destination and never Chart or reflection content', async () => {
    await service.generate(user(), INPUT, NOW);

    const request = mockGenerateContent.mock.calls[0][0];
    expect(request.contents).toEqual([
      { role: 'user', parts: [{ text: 'Complete a portfolio' }] },
    ]);
    expect(request.model).toBe('gemini-2.0-flash');
  });

  it('reads model, temperature, and timeout from centralized configuration', async () => {
    process.env.CHART_PLANNER_MODEL = 'gemini-model-under-test';
    process.env.CHART_PLANNER_TEMPERATURE = '0.7';

    await service.generate(user(), INPUT, NOW);

    const request = mockGenerateContent.mock.calls[0][0];
    expect(request.model).toBe('gemini-model-under-test');
    expect(request.config.temperature).toBe(0.7);

    delete process.env.CHART_PLANNER_MODEL;
    delete process.env.CHART_PLANNER_TEMPERATURE;
  });

  it('does not reach the provider when no server-side key is configured', async () => {
    delete mockEnv.GOOGLE_API_KEY;

    const proposal = await service.generate(user(), INPUT, NOW);

    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(proposal.generationSource).toBe('deterministic_fallback');
  });

  it('never returns the raw provider payload or prompt', async () => {
    const proposal = await service.generate(user(), INPUT, NOW);
    const serialized = JSON.stringify(proposal);

    expect(serialized).not.toContain('systemInstruction');
    expect(serialized).not.toContain('responseMimeType');
    expect(serialized).not.toContain('apiKey');
    expect(Object.keys(proposal)).not.toContain('rawResponse');
  });

  it('rejects planner input that is empty or too long before any other work', async () => {
    await expect(
      service.generate(user(), { ...INPUT, destinationText: '   ' }, NOW)
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      service.generate(user(), { ...INPUT, destinationText: 'x'.repeat(141) }, NOW)
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockPrisma.aIPlanProposal.count).not.toHaveBeenCalled();
  });
});
