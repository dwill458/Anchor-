import { computeCourseMapGeometry, midpoint, segmentPath } from '../courseMapGeometry';

describe('computeCourseMapGeometry', () => {
  it.each([1, 3, 5, 7])('produces exactly %i node positions with no duplicate coordinates', (count) => {
    const geometry = computeCourseMapGeometry(count);
    expect(geometry.nodes).toHaveLength(count);

    const seen = new Set<string>();
    geometry.nodes.forEach((node) => {
      const key = `${node.x},${node.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    });
  });

  it.each([1, 3, 5, 7])('orders nodes by ascending index for %i waypoints', (count) => {
    const geometry = computeCourseMapGeometry(count);
    geometry.nodes.forEach((node, i) => expect(node.index).toBe(i));
  });

  it('alternates node side left/right starting with right', () => {
    const geometry = computeCourseMapGeometry(5);
    expect(geometry.nodes.map((n) => n.side)).toEqual(['right', 'left', 'right', 'left', 'right']);
  });

  it('is deterministic across repeated calls with the same count', () => {
    const a = computeCourseMapGeometry(5);
    const b = computeCourseMapGeometry(5);
    expect(a).toEqual(b);
  });

  it('produces one fewer segment than nodes, connecting consecutive indices', () => {
    const geometry = computeCourseMapGeometry(5);
    expect(geometry.segments).toHaveLength(4);
    geometry.segments.forEach((segment, i) => {
      expect(segment.fromIndex).toBe(i);
      expect(segment.toIndex).toBe(i + 1);
    });
  });

  it('positions the destination above the final waypoint', () => {
    const geometry = computeCourseMapGeometry(3);
    const lastNode = geometry.nodes[geometry.nodes.length - 1];
    expect(geometry.destination.y).toBeLessThan(lastNode.y);
    expect(geometry.destinationSegment).not.toBeNull();
    expect(geometry.destinationSegment?.fromIndex).toBe(2);
    expect(geometry.destinationSegment?.toIndex).toBeNull();
  });

  it('handles zero waypoints without crashing, still placing a destination', () => {
    const geometry = computeCourseMapGeometry(0);
    expect(geometry.nodes).toHaveLength(0);
    expect(geometry.segments).toHaveLength(0);
    expect(geometry.destinationSegment).toBeNull();
    expect(geometry.destination).toBeDefined();
    expect(Number.isFinite(geometry.destination.x)).toBe(true);
    expect(Number.isFinite(geometry.destination.y)).toBe(true);
  });

  it('handles a single waypoint without crashing', () => {
    const geometry = computeCourseMapGeometry(1);
    expect(geometry.nodes).toHaveLength(1);
    expect(geometry.segments).toHaveLength(0);
    expect(geometry.destinationSegment).not.toBeNull();
  });

  it('keeps height stable for a given count regardless of unrelated inputs', () => {
    const first = computeCourseMapGeometry(7).height;
    const second = computeCourseMapGeometry(7).height;
    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
  });

  it('remains defensive for waypoint counts beyond the tested 1–7 range', () => {
    expect(() => computeCourseMapGeometry(12)).not.toThrow();
    const geometry = computeCourseMapGeometry(12);
    expect(geometry.nodes).toHaveLength(12);
  });
});

describe('segmentPath', () => {
  it('builds a quadratic bezier path string', () => {
    const path = segmentPath({ x1: 0, y1: 0, x2: 10, y2: 10, controlX: 5, controlY: 0 });
    expect(path).toBe('M 0 0 Q 5 0 10 10');
  });
});

describe('midpoint', () => {
  it('computes the point at t=0.5 on the curve', () => {
    const point = midpoint({ x1: 0, y1: 0, x2: 10, y2: 0, controlX: 5, controlY: 10 });
    expect(point.x).toBeCloseTo(5);
    expect(point.y).toBeCloseTo(5);
  });
});
