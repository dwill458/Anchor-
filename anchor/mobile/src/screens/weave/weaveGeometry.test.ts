import type { PracticeMode } from '@/types/practice';
import { buildWeaveGeometry } from './weaveGeometry';
import type { WeaveNode } from './weaveData';

const modes: PracticeMode[] = ['focus', 'visualize', 'deep_prime', 'release'];
const node = (mode: PracticeMode, bucketIndex: number, sessionCount: number): WeaveNode => ({
  id: `${mode}-${bucketIndex}`,
  mode,
  bucketIndex,
  startDateKey: '2026-08-01',
  endDateKey: '2026-08-01',
  events: [],
  sessionCount,
  durationSeconds: sessionCount * 60,
});

const nodesByMode = (): Record<PracticeMode, WeaveNode[]> => ({
  focus: [node('focus', 1, 3)],
  visualize: [node('visualize', 2, 1)],
  deep_prime: [],
  release: [],
});

const HEIGHT = 228;
const WIDTH = 350;
const build = (overrides?: Partial<Record<PracticeMode, WeaveNode[]>>) =>
  buildWeaveGeometry({
    modes,
    nodesByMode: { ...nodesByMode(), ...overrides },
    bucketCount: 4,
    width: WIDTH,
    height: HEIGHT,
  });

function pointsOf(path: string): { x: number; y: number }[] {
  return path
    .split(/(?=[ML])/)
    .filter(Boolean)
    .map((command) => {
      const [x, y] = command.slice(1).split(' ').map(Number);
      return { x, y };
    });
}

describe('The Weave geometry', () => {
  it('derives crossing strands and variable node size from activity', () => {
    const geometry = build();

    expect(geometry.strands).toHaveLength(4);
    expect(geometry.strands[0].path).not.toEqual(geometry.strands[1].path);
    expect(geometry.strands[0].opacity).toBeGreaterThan(geometry.strands[3].opacity);
    expect(geometry.nodePositions['focus-1'].radius).toBeGreaterThan(geometry.nodePositions['visualize-2'].radius);
  });

  it('derives per-chunk opacity and stroke width from bucket activity', () => {
    const focus = build().strands.find((strand) => strand.mode === 'focus')!;

    // One chunk per bucket: bucket 1 holds three sessions, bucket 3 is empty.
    expect(focus.segments[1].strokeWidth).toBeGreaterThan(focus.segments[3].strokeWidth);
    expect(focus.segments[1].opacity).toBeGreaterThan(focus.segments[3].opacity);
    expect(focus.segments[1].strokeWidth).toBeLessThanOrEqual(1.55);
    expect(focus.segments[3].opacity).toBeCloseTo(0.14, 2);
  });

  it('carries an unbroken line through the days between sessions', () => {
    const focus = build({ focus: [node('focus', 0, 4), node('focus', 3, 4)] }).strands.find(
      (strand) => strand.mode === 'focus',
    )!;

    focus.segments.forEach((segment, index) => {
      const line = pointsOf(segment.path);
      const halo = pointsOf(segment.haloPath);
      // Every chunk is drawn, however quiet the days it covers.
      expect(segment.opacity).toBeGreaterThanOrEqual(0.14);
      // The line overruns its bucket; the backing stroke stays inside it.
      if (index > 0) expect(line[0].x).toBeLessThan(halo[0].x);
      if (index < focus.segments.length - 1) {
        expect(line[line.length - 1].x).toBeGreaterThan(halo[halo.length - 1].x);
      }
    });

    // Two sessions three buckets apart still leave a lit path between them.
    expect(focus.segments[1].opacity).toBeGreaterThan(0.14);
    expect(focus.segments[2].opacity).toBeGreaterThan(0.14);
  });

  it('keeps every thread inside its own lane, whatever the practice', () => {
    const geometry = build({ focus: [node('focus', 0, 9), node('focus', 1, 9), node('focus', 3, 9)] });
    const laneGap = HEIGHT * 0.185;
    const wobbleReach = HEIGHT * 0.15;

    geometry.strands.forEach((strand, index) => {
      const laneY = HEIGHT / 2 + (index - (modes.length - 1) / 2) * laneGap;
      pointsOf(strand.path).forEach((point) => {
        // Practice sets how far a thread breathes, never where its lane sits.
        expect(Math.abs(point.y - laneY)).toBeLessThanOrEqual(wobbleReach + 0.01);
      });
    });
  });

  it('never drags a thread downward as sessions land on it', () => {
    const quiet = build({ focus: [] });
    const busy = build({ focus: [node('focus', 3, 6)] });
    const laneY = HEIGHT / 2 + (0 - (modes.length - 1) / 2) * (HEIGHT * 0.185);
    const lowest = (path: string) => Math.max(...pointsOf(path).map((point) => point.y));
    const strandFor = (geometry: ReturnType<typeof build>) =>
      geometry.strands.find((strand) => strand.mode === 'focus')!.path;

    // The single completed session must not push the thread toward the floor.
    expect(lowest(strandFor(busy))).toBeLessThan(laneY + HEIGHT * 0.15);
    expect(lowest(strandFor(busy)) - lowest(strandFor(quiet))).toBeLessThan(HEIGHT * 0.11);

    // And it still travels: the thread rises above its lane as well as below.
    const ys = pointsOf(strandFor(busy)).map((point) => point.y);
    expect(Math.min(...ys)).toBeLessThan(laneY);
    expect(Math.max(...ys)).toBeGreaterThan(laneY);
  });

  it('marks the most recent node so it can be pulsed on entry', () => {
    const geometry = build();

    expect(geometry.nodePositions['visualize-2'].latest).toBe(true);
    expect(geometry.nodePositions['focus-1'].latest).toBe(false);
    expect(geometry.nodePositions['focus-1'].travel).toBeLessThan(geometry.nodePositions['visualize-2'].travel);
  });

  it('is deterministic for the same canonical nodes', () => {
    const args = { modes, nodesByMode: nodesByMode(), bucketCount: 4, width: WIDTH, height: HEIGHT };
    expect(buildWeaveGeometry(args)).toEqual(buildWeaveGeometry(args));
  });
});
