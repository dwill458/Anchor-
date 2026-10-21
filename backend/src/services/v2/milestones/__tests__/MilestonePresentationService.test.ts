const mockPrisma = {
  anchor: { findFirst: jest.fn() },
  practiceSession: { findFirst: jest.fn() },
  course: { findFirst: jest.fn() },
  vision: { findFirst: jest.fn() },
  anchorMilestone: { findMany: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
  milestonePresentation: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
};
const mockEvaluate = jest.fn();
jest.mock('../../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../MilestoneService', () => ({ milestoneService: { evaluateQuietly: mockEvaluate } }));
import { MilestonePresentationService } from '../MilestonePresentationService';
import { ACTION_WINDOW_MS, RECONCILIATION_VERSION } from '../celebrationPolicy';

const NOW = new Date('2026-10-21T12:00:00Z');
const USER = 'u', ANCHOR = 'a';
const action = { kind: 'practice' as const, sourceEntityId: 'p' };
const service = new MilestonePresentationService();
const row = (id: string, definitionId: string, extra: Record<string, unknown> = {}) => ({
  id, userId: USER, anchorId: ANCHOR, definitionId, definitionVersion: 1, earnedAt: NOW,
  sourceKind: 'PRACTICE_COMPLETION', sourceEntityId: 'p', metadata: {},
  celebratedAt: null, automaticReservedAt: null, automaticEventKey: 'practice:p', backfillVersion: null,
  ...extra,
});
type Row = ReturnType<typeof row>;
let awards: Row[];
let presentations: any[];

/** Stateful persistence double: validates queries/updates, not PostgreSQL isolation. */
const matches = (record: any, where: any) => Object.entries(where).every(([key, value]) =>
  value && typeof value === 'object' && 'in' in value ? (value.in as unknown[]).includes(record[key]) : record[key] === value);

describe('MilestonePresentationService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    awards = [];
    presentations = [];
    mockPrisma.anchor.findFirst.mockResolvedValue({ id: ANCHOR });
    mockPrisma.practiceSession.findFirst.mockResolvedValue({ id: 'p', completedAt: NOW, practiceMode: 'focus' });
    mockPrisma.course.findFirst.mockResolvedValue({ id: 'c', waypoints: [{ id: 'w', reachedAt: NOW }] });
    mockPrisma.vision.findFirst.mockResolvedValue({ id: 'v', scenes: [{ id: 'scene1', createdAt: NOW }], notes: [] });
    mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));
    mockPrisma.anchorMilestone.findMany.mockImplementation(async ({ where }: any) => awards.filter(r => matches(r, where)));
    mockPrisma.anchorMilestone.updateMany.mockImplementation(async ({ where, data }: any) => {
      const selected = awards.filter(r => matches(r, where));
      selected.forEach(r => Object.assign(r, data));
      return { count: selected.length };
    });
    mockPrisma.milestonePresentation.findFirst.mockImplementation(async ({ where }: any) => presentations.find(r => matches(r, where)) ?? null);
    mockPrisma.milestonePresentation.create.mockImplementation(async ({ data }: any) => {
      const result = { id: `presentation-${presentations.length}`, acknowledgedAt: null, ...data };
      presentations.push(result);
      return result;
    });
    mockPrisma.milestonePresentation.updateMany.mockImplementation(async ({ where, data }: any) => {
      const selected = presentations.filter(r => matches(r, where));
      selected.forEach(r => Object.assign(r, data));
      return { count: selected.length };
    });
  });

  it('requires an owned Anchor before evaluating or reserving', async () => {
    mockPrisma.anchor.findFirst.mockResolvedValue(null);
    await expect(service.reserve('intruder', ANCHOR, action, NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(mockEvaluate).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.anchor.findFirst).toHaveBeenCalledWith({ where: { id: ANCHOR, userId: 'intruder' }, select: { id: true } });
  });

  it('reserves one direct practice award, consumes simultaneous awards, and preserves every earned row', async () => {
    awards = [row('ten', 'commitment.practices.10'), row('strength', 'strength.established')];
    const result = await service.reserve(USER, ANCHOR, action, NOW);
    expect(result?.record.definitionId).toBe('commitment.practices.10');
    expect(awards).toHaveLength(2);
    expect(awards.every(r => r.automaticReservedAt === NOW && r.celebratedAt === null)).toBe(true);
    expect(presentations).toHaveLength(1);
    expect(result?.expiresAt).toBe(new Date(NOW.getTime() + 90_000).toISOString());
    expect(mockEvaluate).toHaveBeenCalledWith(USER, ANCHOR, action);
    expect(mockPrisma.practiceSession.findFirst).toHaveBeenCalledWith({ where: { id: 'p', userId: USER, anchorId: ANCHOR, completionStatus: 'completed' } });
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
  });

  it('does not reissue a reservation to another device, after a crash, or after expiry', async () => {
    awards = [row('first', 'commitment.practices.1')];
    expect(await service.reserve(USER, ANCHOR, action, NOW)).not.toBeNull();
    expect(await service.reserve(USER, ANCHOR, action, NOW)).toBeNull();
    expect(await service.reserve(USER, ANCHOR, action, new Date(NOW.getTime() + ACTION_WINDOW_MS + 1))).toBeNull();
    expect(presentations).toHaveLength(1);
    expect(awards[0].celebratedAt).toBeNull();
  });

  it.each([null, { completedAt: new Date(NOW.getTime() - ACTION_WINDOW_MS - 1) }, { completedAt: new Date(NOW.getTime() + 1) }])(
    'does not present missing, expired, or future-dated practice evidence (%j)', async evidence => {
      awards = [row('first', 'commitment.practices.1')];
      mockPrisma.practiceSession.findFirst.mockResolvedValue(evidence);
      expect(await service.reserve(USER, ANCHOR, action, NOW)).toBeNull();
      expect(presentations).toHaveLength(0);
      expect(awards[0].automaticReservedAt).toBeNull();
    },
  );

  it('leaves ten historical awards quiet at login and features only one on next practice', async () => {
    const ids = ['strength.building', 'strength.established', 'strength.integrated', 'strength.reinforced', 'strength.full',
      'commitment.practices.1', 'commitment.practices.10', 'commitment.practices.30', 'commitment.minutes.100', 'vision.first'];
    awards = ids.map((id, i) => row(`h${i}`, id, { automaticEventKey: null, backfillVersion: RECONCILIATION_VERSION, earnedAt: new Date('2025-01-01') }));
    expect(presentations).toHaveLength(0);
    const result = await service.reserve(USER, ANCHOR, action, NOW);
    expect(result?.record.definitionId).toBe('commitment.minutes.100');
    expect(awards.filter(r => r.automaticReservedAt)).toHaveLength(1);
    expect(awards).toHaveLength(10);
    expect(awards.every(r => r.earnedAt.toISOString().startsWith('2025'))).toBe(true);
    mockPrisma.practiceSession.findFirst.mockResolvedValue({ completedAt: NOW, practiceMode: 'focus' });
    expect(await service.reserve(USER, ANCHOR, { kind: 'practice', sourceEntityId: 'next' }, NOW)).toBeNull();
    expect(presentations.filter(p => p.milestoneId)).toHaveLength(1);
  });

  it('prioritizes fresh progress and permanently consumes the welcome opportunity', async () => {
    awards = [row('new', 'strength.building'), row('old', 'commitment.practices.30', { backfillVersion: RECONCILIATION_VERSION, automaticEventKey: null })];
    expect((await service.reserve(USER, ANCHOR, action, NOW))?.record.id).toBe('new');
    expect(presentations.some(p => p.eventKey === `welcome:v${RECONCILIATION_VERSION}`)).toBe(true);
    expect(await service.reserve(USER, ANCHOR, { kind: 'practice', sourceEntityId: 'next' }, NOW)).toBeNull();
    expect(awards.find(r => r.id === 'old')?.automaticReservedAt).toBeNull();
  });

  it('selects Visualize milestone ahead of other families on a Visualize practice', async () => {
    awards = [row('vision', 'vision.visualize.1'), row('ten', 'commitment.practices.10')];
    mockPrisma.practiceSession.findFirst.mockResolvedValue({ completedAt: NOW, practiceMode: 'visualize' });
    expect((await service.reserve(USER, ANCHOR, action, NOW))?.record.id).toBe('vision');
  });

  it.each(['chart', 'vision'] as const)('requires owned %s entity before reserving', async kind => {
    mockPrisma[kind === 'chart' ? 'course' : 'vision'].findFirst.mockResolvedValue(null);
    expect(await service.reserve(USER, ANCHOR, { kind, sourceEntityId: 'foreign' }, NOW)).toBeNull();
    expect(presentations).toHaveLength(0);
  });

  it('uses the actual reached waypoint as Chart action identity and refuses an unreached event', async () => {
    awards = [row('first', 'journey.waypoint.first', { automaticEventKey: 'chart:c:w' })];
    const chartAction = { kind: 'chart' as const, sourceEntityId: 'c', eventId: 'w' };
    expect((await service.reserve(USER, ANCHOR, chartAction, NOW))?.record.id).toBe('first');
    expect(presentations[0].eventKey).toBe('chart:c:w');
    expect(await service.reserve(USER, ANCHOR, chartAction, NOW)).toBeNull();
    expect(await service.reserve(USER, ANCHOR, { ...chartAction, eventId: 'unreached' }, NOW)).toBeNull();
    expect(presentations).toHaveLength(1);
  });

  it('uses stable persisted Vision commit identity if an award becomes available only on a retry', async () => {
    const visionAction = { kind: 'vision' as const, sourceEntityId: 'v' };
    awards = [row('first', 'vision.first', { automaticEventKey: 'vision:v' })];
    expect((await service.reserve(USER, ANCHOR, visionAction, NOW))?.record.id).toBe('first');
    awards.push(row('board', 'vision.board.complete', { automaticEventKey: 'vision:v', earnedAt: new Date(NOW.getTime() + 1) }));
    expect(await service.reserve(USER, ANCHOR, visionAction, new Date(NOW.getTime() + 1))).toBeNull();
    expect(presentations).toHaveLength(1);
    expect(presentations[0].eventKey).toBe('vision:v:scene1');
  });

  it.each([{ scenes: [] }, { scenes: [{ id: 'scene1', createdAt: new Date(NOW.getTime() - ACTION_WINDOW_MS - 1) }] }])(
    'rejects Vision shells or stale commit evidence (%j)', async ({ scenes }) => {
      mockPrisma.vision.findFirst.mockResolvedValue({ id: 'v', scenes, notes: [] });
      awards = [row('first', 'vision.first', { automaticEventKey: 'vision:v' })];
      expect(await service.reserve(USER, ANCHOR, { kind: 'vision', sourceEntityId: 'v' }, NOW)).toBeNull();
      expect(presentations).toHaveLength(0);
    },
  );

  it('rejects a goal boundary for another Anchor', async () => {
    expect(await service.reserve(USER, ANCHOR, { kind: 'goal', sourceEntityId: 'other-anchor' }, NOW)).toBeNull();
  });

  it('acknowledges the reservation idempotently without awarding or reevaluating', async () => {
    awards = [row('first', 'commitment.practices.1')];
    const result = await service.reserve(USER, ANCHOR, action, NOW);
    mockEvaluate.mockClear();
    await service.acknowledge(USER, 'first', result!.presentationId, NOW);
    await service.acknowledge(USER, 'first', result!.presentationId, new Date(NOW.getTime() + 1));
    expect(awards[0].celebratedAt).toEqual(NOW);
    expect(mockEvaluate).not.toHaveBeenCalled();
    expect(mockPrisma.anchorMilestone.create).not.toHaveBeenCalled();
    expect(awards).toHaveLength(1);
  });

  it('does not acknowledge another account or a mismatched milestone', async () => {
    awards = [row('first', 'commitment.practices.1')];
    const result = await service.reserve(USER, ANCHOR, action, NOW);
    await expect(service.acknowledge('intruder', 'first', result!.presentationId, NOW)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.acknowledge(USER, 'different', result!.presentationId, NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(awards[0].celebratedAt).toBeNull();
  });
});
