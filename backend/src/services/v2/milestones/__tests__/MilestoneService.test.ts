const mockPrisma = {
  anchor: { findFirst: jest.fn() },
  practiceSession: { findMany: jest.fn() },
  threadV2Movement: { findMany: jest.fn() },
  course: { findMany: jest.fn() },
  vision: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
  anchorMilestone: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};

jest.mock('../../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../../../utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

import { Prisma } from '@prisma/client';
import { MilestoneService } from '../MilestoneService';

const USER = 'user-1';
const ANCHOR = 'anchor-1';
const NOW = new Date('2026-10-19T12:00:00Z');
const service = new MilestoneService();

const session = (n: number, completedAt: string) => ({
  id: `s${n}`,
  completedAt: new Date(completedAt),
  completedDurationSeconds: 60,
});

const row = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  userId: USER,
  anchorId: ANCHOR,
  definitionId: 'commitment.practices.1',
  definitionVersion: 1,
  earnedAt: NOW,
  sourceKind: 'PRACTICE_COMPLETION',
  sourceEntityId: 's1',
  metadata: {},
  celebratedAt: null,
  createdAt: NOW,
  ...over,
});

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

function givenHistory(sessions: ReturnType<typeof session>[], intentionCompletedAt: Date | null = null) {
  mockPrisma.anchor.findFirst.mockResolvedValue({ id: ANCHOR, intentionCompletedAt });
  mockPrisma.practiceSession.findMany.mockResolvedValue(sessions);
  mockPrisma.threadV2Movement.findMany.mockResolvedValue([]);
  mockPrisma.course.findMany.mockResolvedValue([]);
}

describe('MilestoneService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockPrisma.anchorMilestone.findMany.mockResolvedValue([]);
    mockPrisma.vision.findMany.mockResolvedValue([]);
    mockPrisma.anchorMilestone.create.mockImplementation(async ({ data }: any) => row({ ...data, id: `id-${data.definitionId}` }));
  });

  describe('Vision commit evidence', () => {
    it('captures only persisted images, stamps an eight-image board once, and uses ownership on every write', async () => {
      givenHistory([]);
      const createdAt = new Date('2026-10-19T10:00:00Z');
      mockPrisma.vision.findFirst.mockResolvedValue({ id: 'v', notes: [], scenes: Array.from({ length: 8 }, (_, i) => ({ assetId: `image-${i}`, createdAt, isArchived: false })) });
      await service.captureVisionCommit(USER, ANCHOR, 'v');
      expect(mockPrisma.vision.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'v', userId: USER, anchorId: ANCHOR } }));
      expect(mockPrisma.vision.updateMany).toHaveBeenCalledWith({ where: { id: 'v', userId: USER, firstCommittedAt: null }, data: { firstCommittedAt: createdAt } });
      expect(mockPrisma.vision.updateMany).toHaveBeenCalledWith({ where: { id: 'v', userId: USER, boardCompletedAt: null }, data: { boardCompletedAt: expect.any(Date) } });
    });

    it('never counts repeated or archived images as eight committed board images', async () => {
      givenHistory([]);
      mockPrisma.vision.findFirst.mockResolvedValue({ id: 'v', notes: [], scenes: Array.from({ length: 12 }, (_, i) => ({ assetId: `image-${i % 7}`, createdAt: NOW, isArchived: i > 7 })) });
      await service.captureVisionCommit(USER, ANCHOR, 'v');
      expect(mockPrisma.vision.updateMany).toHaveBeenCalledTimes(1);
    });

    it('does not stamp a generation shell with no committed image', async () => {
      givenHistory([]);
      mockPrisma.vision.findFirst.mockResolvedValue({ id: 'v', scenes: [], notes: [] });
      await service.captureVisionCommit(USER, ANCHOR, 'v');
      expect(mockPrisma.vision.updateMany).not.toHaveBeenCalled();
    });

    it('recognizes a saved authored note as completed Vision content without counting a draft request', async () => {
      givenHistory([]);
      mockPrisma.vision.findFirst.mockResolvedValue({ id: 'v', scenes: [], notes: [{ createdAt: NOW }] });
      await service.captureVisionCommit(USER, ANCHOR, 'v');
      expect(mockPrisma.vision.updateMany).toHaveBeenCalledWith({ where: { id: 'v', userId: USER, firstCommittedAt: null }, data: { firstCommittedAt: NOW } });
    });

    it('counts only completed guided sessions linked to an owned Vision on this Anchor', async () => {
      givenHistory([]);
      mockPrisma.vision.findMany.mockResolvedValue([{ id: 'v', firstCommittedAt: null, boardCompletedAt: null }]);
      mockPrisma.practiceSession.findMany.mockResolvedValue([
        { ...session(1, NOW.toISOString()), practiceMode: 'visualize', metadata: { guided_visualize_version: 1, vision_id: 'v' } },
        { ...session(2, NOW.toISOString()), practiceMode: 'visualize', metadata: { guided_visualize_version: 1, vision_id: 'someone-elses' } },
        { ...session(3, NOW.toISOString()), practiceMode: 'visualize', metadata: {} },
      ]);
      const facts = await service.loadFacts(USER, ANCHOR);
      expect(facts?.sessions.map(s => s.guidedVisualize)).toEqual([true, false, false]);
      expect(mockPrisma.practiceSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: USER, anchorId: ANCHOR, completionStatus: 'completed' } }));
    });
  });

  describe('evaluateAndAward', () => {
    it('records a new qualifying milestone and returns it', async () => {
      givenHistory([session(1, '2026-10-19T11:00:00Z')]);
      const created = await service.evaluateAndAward(USER, ANCHOR, NOW);
      expect(created.map(m => m.definitionId)).toEqual(['commitment.practices.1']);
      expect(mockPrisma.anchorMilestone.create).toHaveBeenCalledTimes(1);
      // Earned just now: it is news, so it is not pre-marked as celebrated.
      expect(created[0].celebratedAt).toBeNull();
    });

    it('never re-awards what is already recorded (reopen, second device, replay)', async () => {
      givenHistory([session(1, '2026-10-19T11:00:00Z')]);
      mockPrisma.anchorMilestone.findMany.mockResolvedValue([{ definitionId: 'commitment.practices.1' }]);
      expect(await service.evaluateAndAward(USER, ANCHOR, NOW)).toEqual([]);
      expect(mockPrisma.anchorMilestone.create).not.toHaveBeenCalled();
    });

    it('treats a unique-key race as already awarded, not an error', async () => {
      givenHistory([session(1, '2026-10-19T11:00:00Z')]);
      mockPrisma.anchorMilestone.create.mockRejectedValue(uniqueViolation());
      await expect(service.evaluateAndAward(USER, ANCHOR, NOW)).resolves.toEqual([]);
    });

    it('rethrows genuine database errors', async () => {
      givenHistory([session(1, '2026-10-19T11:00:00Z')]);
      mockPrisma.anchorMilestone.create.mockRejectedValue(new Error('connection lost'));
      await expect(service.evaluateAndAward(USER, ANCHOR, NOW)).rejects.toThrow('connection lost');
    });

    it('records several simultaneous unlocks together, each once', async () => {
      const sessions = Array.from({ length: 10 }, (_, i) => session(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T11:00:00Z`));
      givenHistory(sessions);
      const created = await service.evaluateAndAward(USER, ANCHOR, NOW);
      expect(created.map(m => m.definitionId).sort()).toEqual(['commitment.practices.1', 'commitment.practices.10']);
    });

    it('catches up offline history, backdated to when it really happened and already settled', async () => {
      givenHistory([session(1, '2026-08-01T11:00:00Z')]);
      const created = await service.evaluateAndAward(USER, ANCHOR, NOW);
      const data = mockPrisma.anchorMilestone.create.mock.calls[0][0].data;
      expect(data.earnedAt).toEqual(new Date('2026-08-01T11:00:00Z'));
      // Old history must not fire a celebration the user never expected.
      expect(created[0].celebratedAt).toBe(NOW.toISOString());
    });

    it('does nothing for an Anchor the user does not own', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValue(null);
      expect(await service.evaluateAndAward(USER, 'someone-elses', NOW)).toEqual([]);
      expect(mockPrisma.anchor.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'someone-elses', userId: USER } }));
      expect(mockPrisma.anchorMilestone.create).not.toHaveBeenCalled();
    });

    it('awards the goal only when the Anchor has an intention completion record', async () => {
      givenHistory([], new Date('2026-10-19T10:00:00Z'));
      const created = await service.evaluateAndAward(USER, ANCHOR, NOW);
      expect(created.map(m => m.definitionId)).toEqual(['journey.goal']);
    });
  });

  describe('evaluateQuietly', () => {
    it('never throws into the action that triggered it', async () => {
      mockPrisma.anchor.findFirst.mockRejectedValue(new Error('db down'));
      await expect(service.evaluateQuietly(USER, ANCHOR)).resolves.toEqual([]);
    });

    it('skips Anchor-less sessions', async () => {
      expect(await service.evaluateQuietly(USER, null)).toEqual([]);
      expect(mockPrisma.anchor.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('markCelebrated', () => {
    it('stamps the receipt once and leaves ownership untouched', async () => {
      mockPrisma.anchorMilestone.findFirst
        .mockResolvedValueOnce(row())
        .mockResolvedValueOnce(row({ celebratedAt: NOW }));
      mockPrisma.anchorMilestone.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.markCelebrated(USER, 'm1', NOW);
      expect(result.celebratedAt).toBe(NOW.toISOString());
      expect(mockPrisma.anchorMilestone.updateMany).toHaveBeenCalledWith({
        where: { id: 'm1', userId: USER, celebratedAt: null },
        data: { celebratedAt: NOW },
      });
    });

    it('is idempotent once celebrated', async () => {
      const first = new Date('2026-10-01T00:00:00Z');
      mockPrisma.anchorMilestone.findFirst.mockResolvedValue(row({ celebratedAt: first }));
      const result = await service.markCelebrated(USER, 'm1', NOW);
      expect(result.celebratedAt).toBe(first.toISOString());
      expect(mockPrisma.anchorMilestone.updateMany).not.toHaveBeenCalled();
    });

    it("refuses another user's milestone", async () => {
      mockPrisma.anchorMilestone.findFirst.mockResolvedValue(null);
      await expect(service.markCelebrated('intruder', 'm1', NOW)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('reconcileAndList', () => {
    it('reconciles then returns the permanent record newest first', async () => {
      givenHistory([session(1, '2026-10-19T11:00:00Z')]);
      mockPrisma.anchorMilestone.findMany
        .mockResolvedValueOnce([]) // existing check inside evaluateAndAward
        .mockResolvedValueOnce([row()]); // list
      const { milestones, created } = await service.reconcileAndList(USER, ANCHOR);
      expect(created).toHaveLength(1);
      expect(milestones).toHaveLength(1);
      expect(mockPrisma.anchorMilestone.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ orderBy: [{ earnedAt: 'desc' }, { definitionId: 'asc' }] })
      );
    });

    it('404s for an unknown Anchor', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValue(null);
      await expect(service.reconcileAndList(USER, 'nope')).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
