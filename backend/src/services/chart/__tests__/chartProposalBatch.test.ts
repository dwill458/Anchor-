const mockState: any = {};
const mockTx: any = {
  chartMessage: { findFirst: jest.fn(async () => mockState.message), update: jest.fn(async ({data}: any) => { mockState.message.structured = data.structured; }) },
  course: { update: jest.fn(async ({data}: any) => { if ('currentMoveId' in data) mockState.course.currentMoveId = data.currentMoveId; }) },
  move: {
    create: jest.fn(async ({data}: any) => { mockState.course.moves.push(data); }),
    deleteMany: jest.fn(async ({where}: any) => { mockState.course.moves = mockState.course.moves.filter((m: any) => m.batchId !== where.batchId || m.status === 'COMPLETED'); }),
    findFirst: jest.fn(async () => ({ position: 100 })),
  },
};
jest.mock('../../CourseService', () => ({
  runSerializable: async (fn: any) => fn(mockTx),
  findCourse: async () => mockState.course,
  projection: (row: any) => ({ ...row, moves: [...row.moves].sort((a: any, b: any) => a.position - b.position) }),
  assertCourseActive: jest.fn(),
  assertWaypointBelongs: (row: any, id: string) => row.waypoints.find((w: any) => w.id === id),
  selectNextActiveMove: (moves: any[], id: string) => moves.filter(m => m.waypointId === id && m.status === 'ACTIVE').sort((a,b) => a.position-b.position)[0] ?? null,
}));
jest.mock('../../WaypointStateService', () => ({ isTerminal: () => false }));
import { ChartService } from '../ChartService';

beforeEach(() => {
  jest.clearAllMocks();
  mockState.course = { id: 'course', currentWaypointId: 'wp', currentMoveId: 'original', waypoints: [{ id: 'wp' }], moves: [{ id: 'original', waypointId: 'wp', position: 100, status: 'ACTIVE', batchId: null }] };
  mockState.message = { id: 'proposal', structured: { action: { type: 'ADD_MOVES', status: 'PENDING', waypointId: 'wp', moves: [{ title: 'One', detail: 'a' }, { title: 'Two', detail: 'b' }, { title: 'Three', detail: 'c' }] } } };
});

test('applies ordered moves once and retains completed moves on undo', async () => {
  const service = new ChartService();
  const applied = await service.applyAskProposal('user', 'course', 'proposal');
  expect(applied.batchId).toBe('proposal');
  expect(applied.chart.moves.map((m: any) => m.title ?? m.id)).toEqual(['One', 'Two', 'Three', 'original']);
  expect(applied.chart.currentMoveId).toBe(applied.chart.moves[0].id);
  await service.applyAskProposal('user', 'course', 'proposal');
  expect(mockTx.move.create).toHaveBeenCalledTimes(3);
  mockState.course.moves.find((m: any) => m.title === 'One').status = 'COMPLETED';
  mockState.course.currentMoveId = mockState.course.moves.find((m: any) => m.title === 'Two').id;
  const undone = await service.undoAskProposal('user', 'course', 'proposal');
  expect(undone.moves.map((m: any) => m.title ?? m.id)).toEqual(['One', 'original']);
  expect(undone.currentMoveId).toBe('original');
  await service.applyAskProposal('user', 'course', 'proposal');
  expect(mockTx.move.create).toHaveBeenCalledTimes(3);
});

test('legacy single move appends without replacing the current move', async () => {
  mockState.message.structured.action.moves = [{ title: 'Legacy', rationale: null }];
  const result = await new ChartService().applyAskProposal('user', 'course', 'proposal');
  expect(result.chart.currentMoveId).toBe('original');
  expect(result.chart.moves.find((m: any) => m.title === 'Legacy')).toBeDefined();
});
