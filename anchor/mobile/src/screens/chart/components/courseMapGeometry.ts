/**
 * Pure, deterministic route geometry. No waypoint content is read here —
 * only counts and indices — so layout is stable across rerenders and
 * independent of title length, state, or Anchor data.
 *
 * Coordinate space is a fixed logical viewBox (MAP_WIDTH x computed height).
 * CourseMap renders this into an <Svg viewBox> and positions the RN overlay
 * (node hit targets, labels) using percentages of that same viewBox, so both
 * layers scale together regardless of the device's actual pixel width.
 */

export const MAP_WIDTH = 320;
const NODE_STEP_Y = 168;
const TOP_PADDING = 112; // room for the destination marker + label
const BOTTOM_PADDING = 72;
const AMPLITUDE = 84; // horizontal alternation offset from center
const CENTER_X = MAP_WIDTH / 2;
const DESTINATION_GAP = NODE_STEP_Y * 0.72;
const MIN_HEIGHT = TOP_PADDING + BOTTOM_PADDING;

export type WaypointSide = 'left' | 'right';

export type NodeGeometry = {
  index: number;
  x: number;
  y: number;
  side: WaypointSide;
};

export type SegmentGeometry = {
  fromIndex: number;
  toIndex: number | null; // null for the final segment into the destination
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  controlX: number;
  controlY: number;
};

export type DestinationGeometry = {
  x: number;
  y: number;
};

export type CourseMapGeometry = {
  width: number;
  height: number;
  nodes: NodeGeometry[];
  segments: SegmentGeometry[];
  destination: DestinationGeometry;
  destinationSegment: SegmentGeometry | null;
};

/** Horizontal editorial route used by the Chart home visual reference. */
export function computeHorizontalCourseMapGeometry(waypointCount: number): CourseMapGeometry {
  const count = Math.max(0, Math.floor(waypointCount));
  const xPositions = [62, 196, 342, 486, 618];
  const yPositions = [138, 108, 122, 82, 54];
  const width = Math.max(680, count > 5 ? 618 + (count - 5) * 128 : 680);
  const height = 196;
  const nodes: NodeGeometry[] = [];

  for (let i = 0; i < count; i += 1) {
    const x = xPositions[i] ?? xPositions[xPositions.length - 1] + (i - xPositions.length + 1) * 128;
    const y = yPositions[i] ?? 54 + ((i - yPositions.length + 1) % 2 === 0 ? 28 : -6);
    nodes.push({ index: i, x, y, side: i % 2 === 0 ? 'right' : 'left' });
  }

  const segments: SegmentGeometry[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    const from = nodes[i];
    const to = nodes[i + 1];
    segments.push({
      fromIndex: i,
      toIndex: i + 1,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      controlX: (from.x + to.x) / 2,
      controlY: (from.y + to.y) / 2 - 8,
    });
  }

  const last = nodes[nodes.length - 1] ?? null;
  const destination = last
    ? { x: Math.min(width - 42, last.x + 80), y: 38 }
    : { x: 620, y: 52 };
  const destinationSegment = last
    ? {
        fromIndex: last.index,
        toIndex: null,
        x1: last.x,
        y1: last.y,
        x2: destination.x,
        y2: destination.y,
        controlX: (last.x + destination.x) / 2,
        controlY: (last.y + destination.y) / 2,
      }
    : null;

  return { width, height, nodes, segments, destination, destinationSegment };
}

function quadraticControlPoint(y1: number, y2: number): number {
  return (y1 + y2) / 2;
}

/**
 * Computes deterministic node positions, connecting-segment curves, and the
 * destination marker position for `waypointCount` waypoints (any count >= 0;
 * 1–7 is the tested/expected product range per Part 5 of the contract).
 *
 * Waypoints ascend from the bottom of the map (earliest / index 0) to the
 * top (most recent), alternating left/right of center, with the destination
 * positioned above the final waypoint — an ascending, celestial composition
 * rather than a literal top-down task list.
 */
export function computeCourseMapGeometry(waypointCount: number): CourseMapGeometry {
  const count = Math.max(0, Math.floor(waypointCount));

  const nodes: NodeGeometry[] = [];
  for (let i = 0; i < count; i += 1) {
    const side: WaypointSide = i % 2 === 0 ? 'right' : 'left';
    const x = CENTER_X + (side === 'right' ? AMPLITUDE : -AMPLITUDE);
    const y = BOTTOM_PADDING + (count - 1 - i) * NODE_STEP_Y;
    nodes.push({ index: i, x, y, side });
  }

  const height = count === 0 ? MIN_HEIGHT : BOTTOM_PADDING + (count - 1) * NODE_STEP_Y + TOP_PADDING;

  const segments: SegmentGeometry[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    const from = nodes[i];
    const to = nodes[i + 1];
    segments.push({
      fromIndex: i,
      toIndex: i + 1,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      controlX: CENTER_X,
      controlY: quadraticControlPoint(from.y, to.y),
    });
  }

  const lastNode = nodes[count - 1] ?? null;
  const destination: DestinationGeometry = lastNode
    ? { x: CENTER_X, y: Math.max(TOP_PADDING / 2, lastNode.y - DESTINATION_GAP) }
    : { x: CENTER_X, y: MIN_HEIGHT / 2 };

  const destinationSegment: SegmentGeometry | null = lastNode
    ? {
        fromIndex: count - 1,
        toIndex: null,
        x1: lastNode.x,
        y1: lastNode.y,
        x2: destination.x,
        y2: destination.y,
        controlX: CENTER_X,
        controlY: quadraticControlPoint(lastNode.y, destination.y),
      }
    : null;

  return { width: MAP_WIDTH, height, nodes, segments, destination, destinationSegment };
}

export function segmentPath(segment: Pick<SegmentGeometry, 'x1' | 'y1' | 'x2' | 'y2' | 'controlX' | 'controlY'>): string {
  return `M ${segment.x1} ${segment.y1} Q ${segment.controlX} ${segment.controlY} ${segment.x2} ${segment.y2}`;
}

export function midpoint(segment: Pick<SegmentGeometry, 'x1' | 'y1' | 'x2' | 'y2' | 'controlX' | 'controlY'>): { x: number; y: number } {
  // Point at t=0.5 on the quadratic bezier.
  const x = 0.25 * segment.x1 + 0.5 * segment.controlX + 0.25 * segment.x2;
  const y = 0.25 * segment.y1 + 0.5 * segment.controlY + 0.25 * segment.y2;
  return { x, y };
}
