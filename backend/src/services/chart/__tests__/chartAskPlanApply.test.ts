/** Ask plan proposals through the real ChartService apply/undo/create transactions and projection. */
const mockPrisma: any = {
  $transaction: jest.fn(),
  course: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  move: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  chartMessage: { findFirst: jest.fn(), update: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
import { chartService } from '../ChartService';

const now = new Date('2026-11-16T12:00:00Z');
let stored: any;
let message: any;

function move(id: string, position: number, overrides: Record<string, unknown> = {}) {
  return {
    id, userId: 'user', courseId: 'course', waypointId: 'current', title: id, rationale: null, source: 'USER',
    status: 'ACTIVE', position, completedAt: null, dismissedAt: null, createdAt: now, updatedAt: now,
    idempotencyKey: null, batchId: null, planCue: null, planDate: null, planTime: null, planRemind: false,
    ...overrides,
  };
}
const waypoint = (id: string, position: number) => ({ id, position, userId: 'user', courseId: 'course', title: id, description: null, kind: 'MILESTONE', progressMode: null, metricLabel: null, metricBaseline: null, metricTarget: null, metricCurrent: null, reachedAt: null, cancelledAt: null, skippedAt: null, supportingPracticeSessionId: null, createdAt: now, updatedAt: now });

beforeEach(() => {
  jest.clearAllMocks();
  stored = {
    id: 'course', userId: 'user', anchorId: 'anchor', destinationText: 'Mornings that are mine', startingContext: null,
    status: 'ACTIVE', version: 5, currentWaypointId: 'current', currentMoveId: 'a',
    waypoints: [waypoint('current', 100), waypoint('later', 200)],
    moves: [
      move('a', 100, { planCue: 'After lunch', planDate: '2026-11-17', planTime: '12:30', planRemind: true }),
      move('b', 200),
      move('done', 300, { status: 'COMPLETED', completedAt: now }),
      move('elsewhere', 100, { waypointId: 'later' }),
    ],
    anchorLinks: [], plottedAt: now, createdAt: now, updatedAt: now, completedAt: null, archivedAt: null, deletedAt: null,
  };
  mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
  mockPrisma.course.findFirst.mockImplementation(async () => structuredClone(stored));
  mockPrisma.course.update.mockImplementation(async ({ data }: any) => {
    Object.assign(stored, { ...data, version: data.version?.increment ? stored.version + data.version.increment : stored.version });
    return stored;
  });
  mockPrisma.move.update.mockImplementation(async ({ where, data }: any) => Object.assign(stored.moves.find((m: any) => m.id === where.id), data));
  mockPrisma.move.findFirst.mockResolvedValue({ position: 300 });
  mockPrisma.move.create.mockImplementation(async ({ data }: any) => { const row = move(data.id, data.position, data); stored.moves.push(row); return row; });
  mockPrisma.chartMessage.findFirst.mockImplementation(async () => (message ? structuredClone(message) : null));
  mockPrisma.chartMessage.update.mockImplementation(async ({ data }: any) => { message.structured = data.structured; return message; });
});

const planMessage = (plans: unknown[]) => ({
  id: 'msg',
  structured: { action: { type: 'PLAN_MOVES', status: 'PENDING', waypointId: 'current', moves: [], plans } },
});
const planOf = (id: string) => {
  const m = stored.moves.find((item: any) => item.id === id);
  return { planCue: m.planCue, planDate: m.planDate, planTime: m.planTime, planRemind: m.planRemind };
};

describe('PLAN_MOVES apply and undo', () => {
  it('writes plans, keeps each reminder unless the time goes, stores previous and bumps the version once', async () => {
    message = planMessage([
      { moveId: 'a', title: 'a', cue: 'After I wake up', date: '2026-11-18', time: '07:00' },
      { moveId: 'b', title: 'b', cue: 'After work', date: '2026-11-19', time: null },
    ]);
    const result = await chartService.applyAskProposal('user', 'course', 'msg');
    expect(result.added).toBe(0);
    expect(planOf('a')).toEqual({ planCue: 'After I wake up', planDate: '2026-11-18', planTime: '07:00', planRemind: true });
    expect(planOf('b')).toEqual({ planCue: 'After work', planDate: '2026-11-19', planTime: null, planRemind: false });
    expect(stored.version).toBe(6);
    expect(stored.currentMoveId).toBe('a');
    expect(message.structured.action.status).toBe('APPLIED');
    expect(message.structured.action.previous).toEqual([
      { moveId: 'a', planCue: 'After lunch', planDate: '2026-11-17', planTime: '12:30', planRemind: true },
      { moveId: 'b', planCue: null, planDate: null, planTime: null, planRemind: false },
    ]);

    // Applying again is a no-op.
    await chartService.applyAskProposal('user', 'course', 'msg');
    expect(stored.version).toBe(6);

    await chartService.undoAskProposal('user', 'course', 'msg');
    expect(planOf('a')).toEqual({ planCue: 'After lunch', planDate: '2026-11-17', planTime: '12:30', planRemind: true });
    expect(planOf('b')).toEqual({ planCue: null, planDate: null, planTime: null, planRemind: false });
  });

  it('removing the time turns that move’s reminder off', async () => {
    message = planMessage([{ moveId: 'a', title: 'a', cue: 'After lunch', date: '2026-11-17', time: null }]);
    await chartService.applyAskProposal('user', 'course', 'msg');
    expect(planOf('a').planRemind).toBe(false);
  });

  it.each([
    ['a completed move', 'done'],
    ['a move on another waypoint', 'elsewhere'],
    ['a move that no longer exists', 'ghost'],
  ])('returns 409 PROPOSAL_STALE for %s and writes nothing', async (_label, moveId) => {
    message = planMessage([{ moveId: 'b', title: 'b', cue: 'After work', date: null, time: null }, { moveId, title: moveId, cue: null, date: null, time: null }]);
    await expect(chartService.applyAskProposal('user', 'course', 'msg')).rejects.toMatchObject({ statusCode: 409, code: 'PROPOSAL_STALE' });
    expect(mockPrisma.move.update).not.toHaveBeenCalled();
    expect(stored.version).toBe(5);
  });
});

describe('ADD_MOVES with plans', () => {
  it('writes cue, date and time on each new move and never sets the reminder', async () => {
    message = {
      id: 'msg',
      structured: {
        action: {
          type: 'ADD_MOVES', status: 'PENDING', waypointId: 'current',
          moves: [
            { title: 'Open the curtains', detail: 'Light first.', cue: 'After I wake up', date: '2026-11-17', time: '15:00' },
            { title: 'Drink the water', detail: 'Water second.', cue: null, date: null, time: null },
          ],
        },
      },
    };
    const result = await chartService.applyAskProposal('user', 'course', 'msg');
    const created = result.chart.moves.filter(m => m.batchId === 'msg');
    expect(created.find(m => m.title === 'Open the curtains')!.plan).toEqual({ cue: 'After I wake up', date: '2026-11-17', time: '15:00', remind: false });
    expect(created.find(m => m.title === 'Drink the water')!.plan).toBeNull();
  });
});

describe('createChart with a planner cue', () => {
  beforeEach(() => {
    mockPrisma.course.findUnique.mockResolvedValue(null);
    mockPrisma.anchor = { findFirst: jest.fn(async () => ({ id: 'anchor', userId: 'user', intentionText: 'Mornings', category: 'calm', releasedAt: null, isArchived: false, enhancedImageUrl: null })) };
    mockPrisma.vision = { findFirst: jest.fn(async () => null) };
    mockPrisma.waypoint = { create: jest.fn(async ({ data }: any) => { stored.waypoints.push(waypoint(data.id, data.position)); }) };
    mockPrisma.courseAnchorLink = { create: jest.fn() };
    mockPrisma.courseEvent = { findUnique: jest.fn(async () => null), create: jest.fn(async ({ data }: any) => ({ id: 'evt', ...data })) };
    mockPrisma.aIPlanProposal = { updateMany: jest.fn() };
    mockPrisma.course.findFirst.mockImplementation(async ({ where }: any) => (where?.status === 'ACTIVE' && !where?.id ? null : structuredClone(stored)));
    mockPrisma.course.create.mockImplementation(async ({ data }: any) => {
      stored = { ...stored, ...data, waypoints: [], moves: [], version: 1 };
      return stored;
    });
  });

  it('writes planCue on the One Move and on each suggestion; a cue-less proposal still creates', async () => {
    const chart = await chartService.createChart('user', {
      anchorId: 'anchor',
      idempotencyKey: 'create-cue-1',
      destinationText: 'Mornings that are mine',
      waypoints: [{ title: 'Start one steady step', suggestedMoves: [{ title: 'Put water by the bed', cue: 'Before bed' }, { title: 'Set the alarm' }] }],
      oneMove: { title: 'Open the curtains', cue: 'After I wake up' },
    });
    const byTitle = (title: string) => chart.moves.find(m => m.title === title)!;
    expect(byTitle('Open the curtains').plan).toEqual({ cue: 'After I wake up', date: null, time: null, remind: false });
    expect(byTitle('Put water by the bed').plan?.cue).toBe('Before bed');
    expect(byTitle('Set the alarm').plan).toBeNull();
  });
});
