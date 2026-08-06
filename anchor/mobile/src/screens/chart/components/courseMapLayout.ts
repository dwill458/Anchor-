import type { WaypointSummary } from '@/types/chart';
import {
  computeCourseMapGeometry,
  computeHorizontalCourseMapGeometry,
  type CourseMapGeometry,
  type NodeGeometry,
  type WaypointSide,
} from './courseMapGeometry';

/**
 * Layout-only visual emphasis derived from position + state. Never used to
 * infer or mutate lifecycle state — purely how large/prominent a node draws.
 */
export type WaypointEmphasis = 'dominant' | 'reached' | 'subdued';

export type WaypointNodeLayout = {
  waypoint: WaypointSummary;
  index: number;
  x: number;
  y: number;
  side: WaypointSide;
  labelSide: WaypointSide;
  isDominant: boolean;
  emphasis: WaypointEmphasis;
};

export type CourseMapLayout = {
  geometry: CourseMapGeometry;
  nodes: WaypointNodeLayout[];
};

function deriveEmphasis(isDominant: boolean, state: WaypointSummary['state']): WaypointEmphasis {
  if (isDominant) return 'dominant';
  if (state === 'REACHED') return 'reached';
  return 'subdued';
}

/**
 * Combines pure geometry with the waypoint list supplied by the parent to
 * produce a renderable layout. Dominance (the "current position" on the
 * map) is driven by `currentWaypointId`, not by `state`, because a current
 * waypoint that is BLOCKED must still occupy and visually own that position
 * — BLOCKED is a state of the current waypoint, not a demotion from it.
 */
export function buildCourseMapLayout(
  waypoints: WaypointSummary[],
  currentWaypointId: string | null,
  orientation: 'vertical' | 'horizontal' = 'vertical',
): CourseMapLayout {
  const geometry = orientation === 'horizontal'
    ? computeHorizontalCourseMapGeometry(waypoints.length)
    : computeCourseMapGeometry(waypoints.length);

  const nodes: WaypointNodeLayout[] = waypoints.map((waypoint, index) => {
    const nodeGeometry: NodeGeometry | undefined = geometry.nodes[index];
    const x = nodeGeometry?.x ?? geometry.width / 2;
    const y = nodeGeometry?.y ?? 0;
    const side = nodeGeometry?.side ?? 'right';
    const isDominant = currentWaypointId !== null && waypoint.id === currentWaypointId;

    return {
      waypoint,
      index,
      x,
      y,
      side,
      labelSide: side,
      isDominant,
      emphasis: deriveEmphasis(isDominant, waypoint.state),
    };
  });

  return { geometry, nodes };
}
