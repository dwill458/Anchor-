/** Plan writes through the real ChartService.updateMove/addMove transaction and projection. */
const mockPrisma: any = {
  $transaction: jest.fn(),
  course: { findFirst: jest.fn(), update: jest.fn() },
  move: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
import { chartService } from '../ChartService';

const now = new Date('2026-11-16T12:00:00Z');
let stored: any;

function move(id: string, position: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    userId: 'user',
    courseId: 'course',
    waypointId: 'current',
    title: id,
    rationale: null,
    source: 'USER',
    status: 'ACTIVE',
    position,
    completedAt: null,
    dismissedAt: null,
    createdAt: now,
    updatedAt: now,
    idempotencyKey: null,
    batchId: null,
    planCue: null,
    planDate: null,
    planTime: null,
    planRemind: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.useFakeTimers({
    now: new Date('2026-11-16T12:00:00Z'),
    doNotFake: ['nextTick', 'setImmediate'],
  });
  jest.clearAllMocks();
  stored = {
    id: 'course',
    userId: 'user',
    anchorId: 'anchor',
    destinationText: 'Mornings that are mine',
    startingContext: null,
    status: 'ACTIVE',
    version: 3,
    currentWaypointId: 'current',
    currentMoveId: null,
    waypoints: [
      {
        id: 'current',
        position: 100,
        userId: 'user',
        courseId: 'course',
        title: 'Start',
        description: null,
        kind: 'MILESTONE',
        progressMode: null,
        metricLabel: null,
        metricBaseline: null,
        metricTarget: null,
        metricCurrent: null,
        reachedAt: null,
        cancelledAt: null,
        skippedAt: null,
        supportingPracticeSessionId: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    moves: [move('open', 100), move('done', 200, { status: 'COMPLETED', completedAt: now })],
    anchorLinks: [],
    plottedAt: now,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    archivedAt: null,
    deletedAt: null,
  };
  mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
  mockPrisma.course.findFirst.mockImplementation(async () => structuredClone(stored));
  mockPrisma.course.update.mockImplementation(async ({ data }: any) => {
    Object.assign(stored, {
      ...data,
      version: data.version?.increment ? stored.version + data.version.increment : stored.version,
    });
    return stored;
  });
  mockPrisma.move.update.mockImplementation(async ({ where, data }: any) =>
    Object.assign(
      stored.moves.find((m: any) => m.id === where.id),
      data
    )
  );
  mockPrisma.move.findUnique.mockResolvedValue(null);
  mockPrisma.move.findFirst.mockResolvedValue({ position: 200 });
  mockPrisma.move.create.mockImplementation(async ({ data }: any) => {
    const row = move(data.id, data.position, data);
    stored.moves.push(row);
    return row;
  });
});

afterEach(() => jest.useRealTimers());

it('writes a plan without moving the One Move, and bumps the version once', async () => {
  const chart = await chartService.updateMove('user', 'course', 'open', {
    plan: { cue: 'After I wake up', date: '2026-11-17', time: '15:00', remind: true },
  });
  const saved = chart.moves.find(m => m.id === 'open')!;
  expect(saved.plan).toEqual({
    cue: 'After I wake up',
    date: '2026-11-17',
    time: '15:00',
    remind: true,
  });
  expect(saved.status).toBe('ACTIVE');
  expect(saved.position).toBe(100);
  // currentMoveId was null and stays null: a plan write is not a promotion.
  expect(stored.currentMoveId).toBeNull();
  expect(stored.version).toBe(4);
});

it('plan: null clears all four fields', async () => {
  Object.assign(stored.moves[0], {
    planCue: 'After lunch',
    planDate: '2026-11-17',
    planTime: '12:30',
    planRemind: true,
  });
  const chart = await chartService.updateMove('user', 'course', 'open', { plan: null });
  expect(chart.moves.find(m => m.id === 'open')!.plan).toBeNull();
  expect(stored.moves[0]).toMatchObject({
    planCue: null,
    planDate: null,
    planTime: null,
    planRemind: false,
  });
});

it('refuses a plan on a completed Move with MOVE_NOT_PLANNABLE', async () => {
  await expect(
    chartService.updateMove('user', 'course', 'done', { plan: { cue: 'After work' } })
  ).rejects.toMatchObject({
    statusCode: 409,
    code: 'MOVE_NOT_PLANNABLE',
  });
  expect(mockPrisma.move.update).not.toHaveBeenCalled();
});

it('rejects an invalid plan before writing anything', async () => {
  await expect(
    chartService.updateMove('user', 'course', 'open', { plan: { time: '08:00' } })
  ).rejects.toMatchObject({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
  });
  expect(mockPrisma.move.update).not.toHaveBeenCalled();
  expect(mockPrisma.course.update).not.toHaveBeenCalled();
});

it('addMove saves a plan with the new Move', async () => {
  const chart = await chartService.addMove('user', 'course', {
    waypointId: 'current',
    title: 'Open the curtains',
    idempotencyKey: 'add-plan-1',
    plan: { cue: 'After I wake up' },
  });
  const added = chart.moves.find(m => m.title === 'Open the curtains')!;
  expect(added.plan).toEqual({ cue: 'After I wake up', date: null, time: null, remind: false });
});

it('an unplanned Move projects plan: null', async () => {
  const chart = await chartService.updateMove('user', 'course', 'open', { title: 'Renamed' });
  expect(chart.moves.find(m => m.id === 'open')!.plan).toBeNull();
});
