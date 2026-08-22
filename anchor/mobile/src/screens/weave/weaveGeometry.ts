import type { PracticeMode } from '@/types/practice';
import type { WeaveNode } from './weaveData';

/** Horizontal inset, matching the reference weave's PAD. */
export const WEAVE_PLOT_PADDING = 8;

/** The weave's practice-mode colors — unchanged from the original palette. */
export const WEAVE_NEON_MODE_COLORS: Record<PracticeMode, string> = {
  focus: '#AD99D2',
  visualize: '#78B4D1',
  deep_prime: '#F0CB6A',
  release: '#C8875A',
};

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
  /** The visible line, overrunning its bucket so joints never break. */
  path: string;
  /** The backing stroke, held to the bucket so it cannot cut its neighbours. */
  haloPath: string;
  opacity: number;
  strokeWidth: number;
  /** Alternates buckets/modes so crossings visually pass over and under. */
  layer: number;
  /** 0–1 position of this chunk along the plot; drives the entrance stagger. */
  travel: number;
}

export interface WeaveNodePosition {
  left: number;
  top: number;
  radius: number;
  glowRadius: number;
  /** 0–1 position along the plot; drives the entrance stagger. */
  travel: number;
  /** True for the most recent bucket — the thread's live end. */
  latest: boolean;
}

export interface WeaveGeometry {
  strands: WeaveStrand[];
  nodePositions: Record<string, WeaveNodePosition>;
}

const TAU = Math.PI * 2;
/** Per-strand phase offsets for the three wobble harmonics. */
const STRAND_PHASES = [
  [0.4, 1.9, 3.3],
  [2.2, 4.8, 0.7],
  [4.1, 0.3, 2.6],
  [5.6, 3.1, 5.0],
];
/** Sub-steps per bucket; enough to keep each chunk visibly curved. */
const CHUNK_STEPS = 7;
/** Half the widest backing stroke, in points. */
export const HALO_REACH = 3.2;
/** Lane separation and wobble reach, as a share of plot height. */
const LANE_GAP_RATIO = 0.185;
const WOBBLE_RATIO = 0.15;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function smoothstep(f: number): number {
  return f * f * (3 - 2 * f);
}

/**
 * The weave is not a chart: four threads — one per practice mode — braid
 * across time on fixed lanes. Practice never displaces a thread up or down;
 * it only decides how far that thread breathes around its lane and how much
 * weight and light it carries. A thread therefore always travels across, and
 * every completed session reads as reinforcement rather than a drop.
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
  const latestBucket = allNodes.reduce((latest, node) => Math.max(latest, node.bucketIndex), -1);

  // Per-mode session counts per bucket, normalised against the busiest bucket
  // so a single quiet mode still reads next to a heavily practised one.
  const activityByMode = new Map<PracticeMode, number[]>();
  modes.forEach((mode) => {
    const activity = Array.from({ length: bucketTotal }, () => 0);
    nodesByMode[mode].forEach((node) => {
      activity[node.bucketIndex] = node.sessionCount;
    });
    activityByMode.set(mode, activity);
  });
  const peak = Math.max(1, ...allNodes.map((node) => node.sessionCount));
  const normalisedByMode = new Map<PracticeMode, number[]>(
    modes.map((mode) => [
      mode,
      (activityByMode.get(mode) ?? []).map((count) => Math.min(1, count / (peak * 0.75))),
    ]),
  );

  const centerY = height / 2;
  const laneGap = height * LANE_GAP_RATIO;
  const wobbleReach = height * WOBBLE_RATIO;
  const plotWidth = Math.max(1, width - WEAVE_PLOT_PADDING * 2);
  const xAt = (t: number) => WEAVE_PLOT_PADDING + t * plotWidth;
  // Enough overrun to clear the widest backing stroke, in bucket units.
  const overlap = Math.min(0.4, (HALO_REACH * bucketTotal) / plotWidth) / bucketTotal;
  const nodePositions: WeaveGeometry['nodePositions'] = {};

  const strands = modes.map((mode, modeIndex) => {
    const normalised = normalisedByMode.get(mode) ?? [];
    const phases = STRAND_PHASES[modeIndex % STRAND_PHASES.length];
    const laneY = centerY + (modeIndex - (modes.length - 1) / 2) * laneGap;

    // Bucket activity smoothed into a continuous envelope, so the thread
    // swells into a practised stretch instead of kinking at it.
    const activityAt = (t: number) => {
      const position = t * bucketTotal - 0.5;
      const index = Math.floor(position);
      const fraction = position - index;
      const from = normalised[clamp(index, 0, bucketTotal - 1)] ?? 0;
      const to = normalised[clamp(index + 1, 0, bucketTotal - 1)] ?? 0;
      return from + (to - from) * smoothstep(fraction);
    };

    const yAt = (t: number) => {
      const amplitude = 0.44 + 0.56 * activityAt(t);
      const wobble =
        wobbleReach *
        amplitude *
        (0.58 * Math.sin(TAU * 1.7 * t + phases[0]) +
          0.29 * Math.sin(TAU * 4.1 * t + phases[1]) +
          0.13 * Math.sin(TAU * 7.9 * t + phases[2]));
      return laneY + wobble;
    };

    const segments: WeaveSegment[] = [];
    const fullPoints: string[] = [];
    const pointAt = (t: number) => `${xAt(t).toFixed(2)} ${yAt(t).toFixed(2)}`;
    const sample = (from: number, to: number, steps: number) => {
      const commands: string[] = [];
      for (let step = 0; step <= steps; step += 1) {
        commands.push(`${step === 0 ? 'M' : 'L'}${pointAt(from + ((to - from) * step) / steps)}`);
      }
      return commands.join('');
    };

    for (let bucketIndex = 0; bucketIndex < bucketTotal; bucketIndex += 1) {
      const from = bucketIndex / bucketTotal;
      const to = (bucketIndex + 1) / bucketTotal;
      for (let step = 0; step <= CHUNK_STEPS; step += 1) {
        const point = pointAt(from + ((to - from) * step) / CHUNK_STEPS);
        // Chunks share their boundary point; the strand path keeps it once.
        if (step > 0) fullPoints.push(`L${point}`);
        else if (bucketIndex === 0) fullPoints.push(`M${point}`);
      }

      // A dormant stretch still carries the thread between two sessions, so a
      // chunk takes the strongest point of the smoothed envelope it spans —
      // the line brightens as it approaches the next node rather than dying
      // between them.
      let intensity = 0;
      for (let step = 0; step <= CHUNK_STEPS; step += 1) {
        intensity = Math.max(intensity, activityAt(from + ((to - from) * step) / CHUNK_STEPS));
      }

      segments.push({
        id: `${mode}:${bucketIndex}`,
        mode,
        // The line overruns its bucket on both sides so the neighbouring
        // chunk's backing stroke cannot bite a gap out of the joint.
        path: sample(Math.max(0, from - overlap), Math.min(1, to + overlap), CHUNK_STEPS + 2),
        haloPath: sample(from, to, CHUNK_STEPS),
        opacity: Number((0.14 + intensity * 0.52).toFixed(3)),
        strokeWidth: Number((0.6 + intensity * 0.95).toFixed(2)),
        layer: (bucketIndex + modeIndex) % 2,
        travel: bucketTotal === 1 ? 0 : bucketIndex / (bucketTotal - 1),
      });
    }

    nodesByMode[mode].forEach((node) => {
      const t = Math.min(1, (node.bucketIndex + 0.5) / bucketTotal);
      const radius = 2.6 + Math.min(2.6, (node.sessionCount - 1) * 0.55);
      nodePositions[node.id] = {
        left: xAt(t),
        top: yAt(t),
        radius,
        glowRadius: radius + 3,
        travel: t,
        latest: node.bucketIndex === latestBucket,
      };
    });

    const meanIntensity = normalised.reduce((sum, value) => sum + value, 0) / bucketTotal;
    return {
      mode,
      path: fullPoints.join(''),
      opacity: Number((0.14 + meanIntensity * 0.52).toFixed(3)),
      strokeWidth: Number((0.6 + meanIntensity * 0.95).toFixed(2)),
      segments,
    };
  });

  return { strands, nodePositions };
}
