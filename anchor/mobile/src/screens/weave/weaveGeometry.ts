import type { PracticeMode } from '@/types/practice';
import type { WeaveNode } from './weaveData';

export const WEAVE_PLOT_PADDING = 24;

export interface WeavePoint {
  x: number;
  y: number;
  activity: number;
}

export interface WeaveStrand {
  mode: PracticeMode;
  path: string;
  opacity: number;
  strokeWidth: number;
  segments: WeaveSegment[];
}

export interface WeaveSegment {
  id: string;
  mode: PracticeMode;
  path: string;
  opacity: number;
  strokeWidth: number;
  /** Alternates periods/modes so crossings visually pass over and under. */
  layer: number;
}

export interface WeaveGeometry {
  strands: WeaveStrand[];
  nodePositions: Record<string, { left: number; top: number; radius: number; glowRadius: number }>;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function makePath(points: WeavePoint[]): string {
  if (!points.length) return '';
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} Q ${controlX.toFixed(2)} ${previous.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, '');
}

function makeSegmentPath(previous: WeavePoint, point: WeavePoint): string {
  const controlX = (previous.x + point.x) / 2;
  return `M ${previous.x.toFixed(2)} ${previous.y.toFixed(2)} Q ${controlX.toFixed(2)} ${previous.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
}

/**
 * The reference weave is deliberately not a chart: it uses completed-practice
 * density to pull four colored threads through one another. This deterministic
 * projection keeps the same visual language while ensuring every deviation is
 * derived from the canonical ledger rather than a decorative random arc.
 */
export function buildWeaveGeometry(args: {
  modes: readonly PracticeMode[];
  nodesByMode: Record<PracticeMode, WeaveNode[]>;
  bucketCount: number;
  width: number;
  height: number;
}): WeaveGeometry {
  const { modes, nodesByMode, bucketCount, width, height } = args;
  const bucketTotal = Math.max(1, bucketCount);
  const allNodes = modes.flatMap((mode) => nodesByMode[mode]);
  const maxSessions = Math.max(1, ...allNodes.map((node) => node.sessionCount));
  const activityByMode = new Map<PracticeMode, number[]>();
  const totalByBucket = Array.from({ length: bucketTotal }, () => 0);

  modes.forEach((mode) => {
    const activity = Array.from({ length: bucketTotal }, () => 0);
    nodesByMode[mode].forEach((node) => {
      activity[node.bucketIndex] = node.sessionCount;
      totalByBucket[node.bucketIndex] += node.sessionCount;
    });
    activityByMode.set(mode, activity);
  });

  const maxBucketActivity = Math.max(1, ...totalByBucket);
  const minY = WEAVE_PLOT_PADDING;
  const maxY = height - WEAVE_PLOT_PADDING;
  const usableHeight = Math.max(1, maxY - minY);
  const nodePositions: WeaveGeometry['nodePositions'] = {};

  const strands = modes.map((mode, modeIndex) => {
    const activity = activityByMode.get(mode) ?? [];
    const totalSessions = activity.reduce((sum, value) => sum + value, 0);
    const baseY = minY + (modeIndex / Math.max(1, modes.length - 1)) * usableHeight;
    const points = Array.from({ length: bucketTotal }, (_, bucketIndex) => {
      const intensity = activity[bucketIndex] / maxSessions;
      const fieldIntensity = totalByBucket[bucketIndex] / maxBucketActivity;
      const x = WEAVE_PLOT_PADDING + (bucketIndex / Math.max(1, bucketTotal - 1)) * (width - WEAVE_PLOT_PADDING * 2);
      // A shared field creates crossings; the mode phase preserves distinct
      // threads and the local ledger intensity decides how far each one moves.
      const sharedWave = Math.sin(bucketIndex * 1.23 + 0.65) * fieldIntensity * 23;
      const modeWave = Math.cos(bucketIndex * 1.71 + modeIndex * 1.27) * (4 + intensity * 22);
      const densityPull = (intensity - fieldIntensity / modes.length) * 44;
      const y = clamp(baseY + sharedWave + modeWave + densityPull, minY, maxY);
      return { x, y, activity: intensity };
    });

    nodesByMode[mode].forEach((node) => {
      const point = points[node.bucketIndex];
      const intensity = node.sessionCount / maxSessions;
      nodePositions[node.id] = {
        left: point.x,
        top: point.y,
        radius: 3 + Math.min(4.2, Math.sqrt(node.sessionCount) * 1.25),
        glowRadius: 8 + Math.min(8, intensity * 10),
      };
    });

    const opacity = totalSessions === 0 ? 0.13 : clamp(0.3 + totalSessions / Math.max(1, allNodes.length * 2), 0.34, 0.84);
    const strokeWidth = totalSessions === 0 ? 0.75 : clamp(0.9 + Math.sqrt(totalSessions) * 0.18, 0.95, 1.65);
    return {
      mode,
      path: makePath(points),
      opacity,
      strokeWidth,
      segments: points.slice(1).map((point, segmentIndex) => ({
        id: `${mode}:${segmentIndex}`,
        mode,
        path: makeSegmentPath(points[segmentIndex], point),
        opacity,
        strokeWidth,
        layer: (segmentIndex + modeIndex) % 2,
      })),
    };
  });

  return { strands, nodePositions };
}
