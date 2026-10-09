/** Stateful repository fake: exercises real ChartService transaction and projection code. */
const mockPrisma: any = {
  $transaction: jest.fn(),
  course: { findFirst: jest.fn(), update: jest.fn() },
  waypoint: { update: jest.fn(), create: jest.fn() },
  move: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  courseEvent: { findUnique: jest.fn(), create: jest.fn() },
  aIPlanProposal: { findFirst: jest.fn(), updateMany: jest.fn() },
  threadEventLedger: { upsert: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
import { chartService } from '../ChartService';
import { courseService } from '../../CourseService';

const now = new Date('2026-10-09T12:00:00Z');
let stored: any;
let history: any[];
let ledger: any[];

function waypoint(id: string, position: number, overrides: Record<string, unknown> = {}) {
  return { id, position, userId: 'user', courseId: 'course', title: id, description: null, kind: 'METRIC', progressMode: 'numeric', metricLabel: 'active users', metricBaseline: 100, metricTarget: 1000, metricCurrent: 642, reachedAt: null, cancelledAt: null, skippedAt: null, supportingPracticeSessionId: null, createdAt: now, updatedAt: now, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  stored = { id: 'course', userId: 'user', anchorId: 'anchor', destinationText: 'Reach 10,000 active users', startingContext: 'App launched', status: 'ACTIVE', version: 4, currentWaypointId: 'current', currentMoveId: null, waypoints: [waypoint('reached', 100, { reachedAt: now }), waypoint('current', 200), waypoint('future', 300, { metricCurrent: 750, metricTarget: 2000 })], moves: [{ id: 'completed', courseId: 'course', waypointId: 'reached', title: 'Publish onboarding changes', status: 'COMPLETED', source: 'USER', position: 100, completedAt: now, createdAt: now, rationale: null }], anchorLinks: [], plottedAt: now, createdAt: now, updatedAt: now, completedAt: null, archivedAt: null, deletedAt: null };
  history = [{ id: 'historical-event', userId: 'user', courseId: 'course', eventType: 'MOVE_COMPLETED', idempotencyKey: 'historical-key', snapshot: { moveTitle: 'Publish onboarding changes' } }];
  ledger = [];
  mockPrisma.$transaction.mockImplementation(async (callback: any) => {
    const saved = structuredClone(stored);
    const savedHistory = structuredClone(history);
    try { return await callback(mockPrisma); } catch (error) { stored = saved; history = savedHistory; throw error; }
  });
  mockPrisma.course.findFirst.mockImplementation(async () => structuredClone(stored));
  mockPrisma.course.update.mockImplementation(async ({ data }: any) => {
    Object.assign(stored, { ...data, version: data.version?.increment ? stored.version + data.version.increment : stored.version });
    return stored;
  });
  mockPrisma.waypoint.update.mockImplementation(async ({ where, data }: any) => Object.assign(stored.waypoints.find((item: any) => item.id === where.id), data));
  mockPrisma.waypoint.create.mockImplementation(async ({ data }: any) => { const row = waypoint(data.id, data.position, data); stored.waypoints.push(row); return row; });
  mockPrisma.move.findMany.mockImplementation(async () => structuredClone(stored.moves));
  mockPrisma.move.findFirst.mockImplementation(async ({ where }: any) => stored.moves.filter((move: any) => move.waypointId === where.waypointId).sort((a: any, b: any) => b.position - a.position)[0] ?? null);
  mockPrisma.move.create.mockImplementation(async ({ data }: any) => { const row = { rationale: null, completedAt: null, createdAt: now, ...data }; stored.moves.push(row); return row; });
  mockPrisma.move.update.mockImplementation(async ({ where, data }: any) => Object.assign(stored.moves.find((move: any) => move.id === where.id), data));
  mockPrisma.move.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.courseEvent.findUnique.mockImplementation(async ({ where }: any) => history.find(item => item.idempotencyKey === where.idempotencyKey) ?? null);
  mockPrisma.courseEvent.create.mockImplementation(async ({ data }: any) => { history.push(data); return data; });
  mockPrisma.aIPlanProposal.findFirst.mockResolvedValue(null);
  mockPrisma.aIPlanProposal.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.threadEventLedger.upsert.mockImplementation(async ({ create }: any) => { const prior = ledger.find(item => item.idempotencyKey === create.idempotencyKey); if (prior) return prior; ledger.push(create); return create; });
});

describe('Chart flexible progress persistence through a stateful repository fake', () => {
  it('stores a decreasing goal with a zero target and negative current balance', async () => {
    Object.assign(stored.waypoints[1], { metricLabel: 'debt balance', metricBaseline: 1000, metricTarget: 0, metricCurrent: 1000 });
    const updated = await chartService.updateWaypointProgress('user', 'course', 'current', { expectedCourseVersion: 4, metricCurrent: -25 });
    expect(updated.waypoints.find(item => item.id === 'current')?.metric).toEqual({ label: 'debt balance', baseline: 1000, target: 0, current: -25 });
    expect(stored.waypoints[1].metricCurrent).toBe(-25);
    expect(updated.version).toBe(5);
  });

  it('keeps checklist requirements independent from completed Moves', async () => {
    const requirements = [{ id: 'screenshots', title: 'Store screenshots are ready', completed: false }, { id: 'privacy', title: 'Privacy policy is published', completed: false }];
    Object.assign(stored.waypoints[1], { progressMode: 'checklist', metricTarget: null, metricCurrent: null, metricBaseline: null, metricLabel: null, requirements });
    stored.moves.push({ ...stored.moves[0], id: 'active-move', waypointId: 'current', status: 'ACTIVE', completedAt: null, title: 'Draft privacy policy' });
    stored.currentMoveId = 'active-move';
    const completedMove = await chartService.completeMove('user', 'course', 'active-move');
    expect(completedMove.chart.waypoints.find(item => item.id === 'current')?.requirements).toEqual(requirements);
    const updated = await chartService.updateWaypointProgress('user', 'course', 'current', { expectedCourseVersion: completedMove.chart.version, requirementId: 'privacy', completed: true });
    expect(updated.waypoints.find(item => item.id === 'current')?.requirements).toEqual([{ ...requirements[0] }, { ...requirements[1], completed: true }]);
    expect(stored.moves.find((move: any) => move.id === 'active-move').status).toBe('COMPLETED');
  });

  it('rejects numeric counters for a completion milestone and persists reached state without numeric progress', async () => {
    Object.assign(stored.waypoints[1], { progressMode: 'completion', metricTarget: null, metricCurrent: null, metricBaseline: null, metricLabel: null });
    await expect(chartService.updateWaypointProgress('user', 'course', 'current', { expectedCourseVersion: 4, metricCurrent: 50 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const reached = await courseService.completeWaypoint('user', 'course', 'current', { expectedCourseVersion: 4, idempotencyKey: 'binary-reached' });
    expect(reached.completedWaypoint).toMatchObject({ state: 'REACHED', progressMode: 'completion', metric: null });
    expect(stored.waypoints[1].metricCurrent).toBeNull();
  });
});

describe('Reviewed route application and next stretch history', () => {
  it.each([
    ['expired', { baseCourseVersion: 4, expiresAt: new Date('2000-01-01') }, 'PROPOSAL_UNAVAILABLE'],
    ['stale', { baseCourseVersion: 3, expiresAt: new Date('2100-01-01') }, 'COURSE_VERSION_CONFLICT'],
  ])('rejects a %s proposal before changing persisted state', async (_label, proposal, code) => {
    mockPrisma.aIPlanProposal.findFirst.mockResolvedValue(proposal);
    const before = structuredClone(stored);
    await expect(chartService.applyRoute('user', 'course', { expectedCourseVersion: 4, idempotencyKey: 'unsafe-proposal', proposalId: 'proposal', waypoints: [{ id: 'current', title: 'Changed current' }, { id: 'future', title: 'Changed future' }] })).rejects.toMatchObject({ code });
    expect(stored).toEqual(before);
    expect(history).toHaveLength(1);
  });

  it('persists the reviewed One Move on the revised current waypoint', async () => {
    const updated = await chartService.applyRoute('user', 'course', { expectedCourseVersion: 4, idempotencyKey: 'one-move-review', waypoints: [{ id: 'current', title: 'Reach 1,000 active users' }, { id: 'future', title: 'Reach 2,000 active users' }], oneMove: { title: 'Interview one existing user about onboarding friction', rationale: 'Use existing traction before expanding.' } });
    expect(updated.moves.find(move => move.id === updated.currentMoveId)).toMatchObject({ waypointId: 'current', title: 'Interview one existing user about onboarding friction', source: 'AI', status: 'ACTIVE' });
    expect(stored.moves.find((move: any) => move.id === stored.currentMoveId)?.title).toBe('Interview one existing user about onboarding friction');
  });

  it('completes a next stretch without claiming the destination and extends it while retaining reached history', async () => {
    stored.routeScope = 'NEXT_STRETCH';
    stored.waypoints = [stored.waypoints[1]];
    const completed = await courseService.completeWaypoint('user', 'course', 'current', { expectedCourseVersion: 4, idempotencyKey: 'stretch-complete' });
    expect(completed.course.status).toBe('COMPLETED');
    expect(ledger.map(event => event.eventType)).toEqual(['WAYPOINT_REACHED']);
    const reached = structuredClone(stored.waypoints[0]);
    const logBefore = structuredClone(history);
    const extended = await chartService.applyRoute('user', 'course', { expectedCourseVersion: stored.version, idempotencyKey: 'extend-stretch', routeScope: 'NEXT_STRETCH', waypoints: [{ title: 'A repeatable referral channel exists', progressMode: 'completion' }], oneMove: { title: 'Ask one retained user how they found the app' } });
    expect(extended.status).toBe('ACTIVE');
    expect(extended.destinationText).toBe('Reach 10,000 active users');
    expect(stored.waypoints.find((item: any) => item.id === reached.id)).toEqual(reached);
    expect(history.slice(0, logBefore.length)).toEqual(logBefore);
    expect(ledger.some(event => event.eventType === 'DESTINATION_REACHED')).toBe(false);
  });

  it('records destination achievement only when a destination-scoped route completes', async () => {
    stored.routeScope = 'DESTINATION';
    stored.waypoints = [stored.waypoints[1]];
    await courseService.completeWaypoint('user', 'course', 'current', { expectedCourseVersion: 4, idempotencyKey: 'destination-complete' });
    expect(ledger.map(event => event.eventType)).toEqual(['WAYPOINT_REACHED', 'DESTINATION_REACHED']);
  });
});

describe('Chart route adjustment progress preservation', () => {
  it('rejects clearing a retained numeric measure with recorded progress even after rewrite confirmation', async () => {
    const before = structuredClone(stored);
    await expect(chartService.applyRoute('user', 'course', { expectedCourseVersion: 4, idempotencyKey: 'incompatible', confirmRewrite: true, waypoints: [{ id: 'current', title: 'Publish a new version', kind: 'MILESTONE', metricTarget: null }, { id: 'future', title: 'Future growth' }] })).rejects.toMatchObject({ code: 'ROUTE_PROGRESS_CONFLICT' });
    expect(stored).toEqual(before);
    expect(history).toHaveLength(1);
  });

  it('requires explicit review confirmation before removing an upcoming waypoint with recorded numeric progress', async () => {
    await expect(chartService.applyRoute('user', 'course', { expectedCourseVersion: 4, idempotencyKey: 'remove-worked', waypoints: [{ id: 'current', title: 'Reach 1,000 active users' }, { title: 'Different next milestone' }] })).rejects.toMatchObject({ code: 'ROUTE_REWRITE_CONFIRMATION_REQUIRED' });
    expect(stored.waypoints.find((item: any) => item.id === 'future')).toMatchObject({ metricCurrent: 750, cancelledAt: null });
    expect(history).toHaveLength(1);
  });

  it('keeps reached history, completed move details and numeric baseline/current when adjusting only future titles', async () => {
    const updated = await chartService.applyRoute('user', 'course', { expectedCourseVersion: 4, idempotencyKey: 'safe-adjust', waypoints: [{ id: 'current', title: 'Reach 1,000 active users' }, { id: 'future', title: 'Retain 2,000 active users' }] });
    expect(updated.waypoints.find(item => item.id === 'current')?.metric).toMatchObject({ baseline: 100, current: 642, target: 1000 });
    expect(updated.waypoints.find(item => item.id === 'future')?.metric).toMatchObject({ baseline: 100, current: 750, target: 2000 });
    expect(updated.waypoints.find(item => item.id === 'reached')).toMatchObject({ state: 'REACHED', reachedAt: now.toISOString() });
    expect(updated.moves).toContainEqual(expect.objectContaining({ id: 'completed', status: 'COMPLETED', title: 'Publish onboarding changes' }));
    expect(history[0]).toMatchObject({ id: 'historical-event', snapshot: { moveTitle: 'Publish onboarding changes' } });
  });
});
