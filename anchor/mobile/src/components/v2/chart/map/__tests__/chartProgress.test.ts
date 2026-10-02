import type { MoveSummary, WaypointSummary } from '@/types/chart';
import type { ChartWaypointView } from '@/adapters/v2/chart/chartV2Model';
import { buildRouteTable, waypointPlacement } from '../chartMapGeometry';
import {
  firstRunSeed,
  isWaypointReady,
  metricFraction,
  movesFraction,
  nextHighWater,
  progressValueRow,
  rawFraction,
  routeRevealArc,
  toProgressInput,
  waypointFraction,
} from '../chartProgress';
import type { WaypointProgressInput } from '../chartMapContracts';

const input = (over: Partial<WaypointProgressInput> = {}): WaypointProgressInput => ({
  id: 'w1',
  completed: false,
  metric: null,
  movesDone: 0,
  movesTotal: 0,
  ...over,
});
const metric = (current: number, baseline = 0, target = 100) => ({ baseline, current, target });

let seq = 0;
const mv = (status: MoveSummary['status']): MoveSummary => ({
  id: `m${seq++}`,
  courseId: 'c',
  waypointId: 'w1',
  title: 't',
  rationale: null,
  source: 'USER',
  status,
  position: 0,
  isCurrent: false,
  completedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
});

describe('fractions', () => {
  it('moves-only fraction', () => {
    expect(movesFraction(input({ movesDone: 1, movesTotal: 4 }))).toBe(0.25);
    expect(movesFraction(input({ movesDone: 0, movesTotal: 0 }))).toBe(0);
    expect(rawFraction(input({ movesDone: 2, movesTotal: 4 }))).toBe(0.5);
  });

  it('numeric blends 0.8 metric and 0.2 moves', () => {
    const i = input({ metric: metric(50), movesDone: 1, movesTotal: 2 });
    expect(metricFraction(i)).toBe(0.5);
    expect(rawFraction(i)).toBeCloseTo(0.8 * 0.5 + 0.2 * 0.5, 10);
    const more = input({ metric: metric(50), movesDone: 2, movesTotal: 2 });
    expect(rawFraction(more)).toBeGreaterThan(rawFraction(i));
  });

  it('metric uses baseline and clamps', () => {
    expect(metricFraction(input({ metric: metric(340, 84, 1000) }))).toBeCloseTo((340 - 84) / (1000 - 84), 10);
    expect(metricFraction(input({ metric: metric(5000, 0, 100) }))).toBe(1);
    expect(metricFraction(input({ metric: metric(-5, 0, 100) }))).toBe(0);
  });

  it('caps the drawn fraction at 0.9 until confirmed', () => {
    const r = waypointFraction(input({ metric: metric(100), movesDone: 2, movesTotal: 2 }), 0);
    expect(r.raw).toBe(1);
    expect(r.p).toBe(0.9);
    expect(r.hw).toBe(1);
  });

  it('completed is full', () => {
    expect(waypointFraction(input({ completed: true }), 0)).toEqual({ p: 1, hw: 1, raw: 1 });
  });
});

describe('ready rules', () => {
  it('numeric needs metric >= target, regardless of moves', () => {
    expect(isWaypointReady(input({ metric: metric(99), movesDone: 3, movesTotal: 3 }), 1)).toBe(false);
    expect(isWaypointReady(input({ metric: metric(100), movesDone: 0, movesTotal: 3 }), 0)).toBe(true);
  });
  it('moves-only needs every move done (or a stored full mark)', () => {
    expect(isWaypointReady(input({ movesDone: 2, movesTotal: 3 }), 0)).toBe(false);
    expect(isWaypointReady(input({ movesDone: 3, movesTotal: 3 }), 0)).toBe(true);
    expect(isWaypointReady(input({ movesDone: 2, movesTotal: 3 }), 1)).toBe(true);
  });
  it('completed is never ready', () => {
    expect(isWaypointReady(input({ completed: true, movesDone: 3, movesTotal: 3 }), 1)).toBe(false);
  });
});

describe('high water', () => {
  it('lowering the metric never retreats p', () => {
    const high = input({ metric: metric(80) });
    const hw1 = nextHighWater({}, [high]);
    expect(hw1.w1).toBeCloseTo(0.64, 10);
    const lowered = input({ metric: metric(10) });
    const hw2 = nextHighWater(hw1, [lowered]);
    expect(hw2).toBe(hw1);
    expect(waypointFraction(lowered, hw2.w1).p).toBeCloseTo(0.64, 10);
  });

  it('adding a move never retreats', () => {
    const before = input({ movesDone: 2, movesTotal: 2 });
    const hw1 = nextHighWater({}, [before]);
    expect(hw1.w1).toBe(1);
    const after = input({ movesDone: 2, movesTotal: 3 });
    expect(waypointFraction(after, hw1.w1).p).toBe(0.9);
    expect(nextHighWater(hw1, [after])).toBe(hw1);
  });

  it('returns a new object only when a mark rose', () => {
    const base = { w1: 0.3 };
    expect(nextHighWater(base, [input({ movesDone: 1, movesTotal: 10 })])).toBe(base);
    const up = nextHighWater(base, [input({ movesDone: 5, movesTotal: 10 })]);
    expect(up).not.toBe(base);
    expect(up.w1).toBe(0.5);
    expect(base.w1).toBe(0.3);
  });
});

describe('routeRevealArc', () => {
  const table = buildRouteTable();
  const placement = waypointPlacement(5);
  it('draws within the current leg and respects the cap', () => {
    const i = input({ id: 'w2', movesDone: 3, movesTotal: 3 });
    const arc = routeRevealArc({ inputs: [input(), i], currentIndex: 1, isFinished: false, hw: {}, placement, table });
    const leg = placement.legs[1];
    expect(arc).toBeCloseTo(leg.start + 0.9 * (leg.end - leg.start), 6);
  });
  it('first leg starts at 0 and finished is the full route', () => {
    expect(routeRevealArc({ inputs: [input()], currentIndex: 0, isFinished: false, hw: {}, placement, table })).toBe(0);
    expect(routeRevealArc({ inputs: [], currentIndex: 5, isFinished: true, hw: {}, placement, table })).toBe(table.total);
  });
  it('never indexes past the last leg', () => {
    const arc = routeRevealArc({ inputs: [], currentIndex: 99, isFinished: false, hw: {}, placement, table });
    expect(arc).toBe(placement.legs[4].start);
  });
});

describe('first run seed', () => {
  it('is display-only: start inked, nothing counted', () => {
    const inputs = [input({ movesDone: 0, movesTotal: 3 })];
    expect(firstRunSeed(inputs)).toEqual({ startInked: true });
    expect(inputs[0].movesDone).toBe(0);
    expect(rawFraction(inputs[0])).toBe(0);
  });
});

describe('toProgressInput', () => {
  const view = (over: Partial<ChartWaypointView> = {}): ChartWaypointView => ({
    id: 'w1',
    number: 1,
    title: 'T',
    rationale: null,
    state: 'current',
    isDestination: false,
    metric: null,
    reachedAt: null,
    moves: [],
    suggestedMoves: [],
    accessibilityLabel: '',
    ...over,
  });
  const rawMetric = (baseline: number | null): WaypointSummary['metric'] => ({ label: null, baseline, target: 1000, current: 340 });
  const mview = { current: 340, target: 1000, label: null, fraction: 0.3, display: '', percentLabel: null };

  it('counts ACTIVE+COMPLETED moves and uses the raw baseline', () => {
    const i = toProgressInput(
      view({ metric: mview, moves: [mv('COMPLETED'), mv('ACTIVE'), mv('SUGGESTED'), mv('DISMISSED')] }),
      rawMetric(84)
    );
    expect(i.metric).toEqual({ baseline: 84, current: 340, target: 1000 });
    expect(i.movesDone).toBe(1);
    expect(i.movesTotal).toBe(2);
    expect(i.completed).toBe(false);
  });
  it('falls back to baseline 0 when null or >= target; null current -> baseline', () => {
    expect(toProgressInput(view({ metric: mview }), rawMetric(null)).metric?.baseline).toBe(0);
    expect(toProgressInput(view({ metric: mview }), rawMetric(1000)).metric?.baseline).toBe(0);
    expect(toProgressInput(view({ metric: mview }), undefined).metric?.baseline).toBe(0);
    expect(toProgressInput(view({ metric: { ...mview, current: null } }), rawMetric(84)).metric?.current).toBe(84);
  });
  it('moves-only and completed', () => {
    const i = toProgressInput(view({ state: 'completed' }));
    expect(i.metric).toBeNull();
    expect(i.completed).toBe(true);
  });
});

describe('value rows', () => {
  it('matches the prototype copy', () => {
    expect(progressValueRow(input({ metric: metric(340, 84, 1000) }), 'current', 0)).toEqual({ strong: '340 / 1,000', span: 'started at 84' });
    expect(progressValueRow(input({ movesDone: 1, movesTotal: 3 }), 'current', 0)).toEqual({ strong: '1 of 3 moves', span: 'moves draw this leg' });
    expect(progressValueRow(input({ movesDone: 3, movesTotal: 3 }), 'current', 0)?.span).toBe('route holds at 90% until you confirm');
    expect(progressValueRow(input({ metric: metric(0, 0, 5000) }), 'upcoming', 0, 'active users')).toEqual({ strong: '5,000', span: 'active users to reach' });
    expect(progressValueRow(input({ metric: metric(0, 0, 5000) }), 'reached', 0)).toEqual({ strong: '5,000', span: 'reached' });
    expect(progressValueRow(input(), 'upcoming', 0)).toBeNull();
  });
});
