/**
 * Chart map progress rules (prototype mvFrac / metFrac / raw / pOf / isReady).
 * Pure; everything is derived from server data plus a presentation-only
 * high-water map. Nothing here decides reach: the user confirms that.
 */
import type { WaypointSummary } from '@/types/chart';
import type { ChartWaypointView } from '@/adapters/v2/chart/chartV2Model';
import {
  METRIC_WEIGHT,
  MOVES_WEIGHT,
  PROGRESS_CAP,
  type HighWaterMap,
  type RouteTable,
  type WaypointFractionResult,
  type WaypointPlacement,
  type WaypointProgressInput,
} from './chartMapContracts';

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * `ChartMetricView` drops the baseline, so pass the raw `WaypointSummary.metric`
 * (look it up from `course.waypoints` by id). Baseline falls back to 0 when it
 * is null or >= target, matching `toMetricView`.
 */
export function toProgressInput(w: ChartWaypointView, raw?: WaypointSummary['metric']): WaypointProgressInput {
  let metric: WaypointProgressInput['metric'] = null;
  if (w.metric) {
    const target = w.metric.target;
    const baseline =
      raw && typeof raw.baseline === 'number' && Number.isFinite(raw.baseline) && raw.baseline < target ? raw.baseline : 0;
    metric = { baseline, current: w.metric.current === null ? baseline : w.metric.current, target };
  }
  // ChartWaypointView.moves already holds ACTIVE + COMPLETED only; filter again defensively.
  const counted = w.moves.filter((m) => m.status === 'ACTIVE' || m.status === 'COMPLETED');
  return {
    id: w.id,
    completed: w.state === 'completed',
    metric,
    movesDone: counted.filter((m) => m.status === 'COMPLETED').length,
    movesTotal: counted.length,
  };
}

export function metricFraction(input: WaypointProgressInput): number {
  const m = input.metric;
  if (!m) return 0;
  const span = m.target - m.baseline;
  if (!(span > 0)) return m.current >= m.target ? 1 : 0;
  return clamp01((m.current - m.baseline) / span);
}

export function movesFraction(input: WaypointProgressInput): number {
  return input.movesTotal > 0 ? clamp01(input.movesDone / input.movesTotal) : 0;
}

export function rawFraction(input: WaypointProgressInput): number {
  const mv = movesFraction(input);
  return input.metric ? METRIC_WEIGHT * metricFraction(input) + MOVES_WEIGHT * mv : mv;
}

export function waypointFraction(input: WaypointProgressInput, hw: number): WaypointFractionResult {
  if (input.completed) return { p: 1, hw: 1, raw: 1 };
  const raw = rawFraction(input);
  const mark = Math.max(Number.isFinite(hw) ? hw : 0, raw);
  return { p: Math.min(mark, PROGRESS_CAP), hw: mark, raw };
}

export function isWaypointReady(input: WaypointProgressInput, hw: number): boolean {
  if (input.completed) return false;
  if (input.metric) return metricFraction(input) >= 1;
  return Math.max(Number.isFinite(hw) ? hw : 0, rawFraction(input)) >= 1;
}

/** Never lowers a mark. Returns the SAME object when nothing changed. */
export function nextHighWater(map: HighWaterMap, inputs: WaypointProgressInput[]): HighWaterMap {
  let next: HighWaterMap | null = null;
  for (const input of inputs) {
    const prev = map[input.id] ?? 0;
    const candidate = waypointFraction(input, prev).hw;
    if (candidate > prev) {
      if (!next) next = { ...map };
      next[input.id] = candidate;
    }
  }
  return next ?? map;
}

/** Arc length of the drawn route. Arrived = the whole route, the summit included. */
export function routeRevealArc(args: {
  inputs: WaypointProgressInput[];
  currentIndex: number;
  isFinished: boolean;
  hw: HighWaterMap;
  placement: WaypointPlacement;
  table: RouteTable;
}): number {
  const { inputs, currentIndex, isFinished, hw, placement, table } = args;
  if (isFinished) return table.total;
  if (placement.legs.length === 0) return 0;
  const idx = Math.min(Math.max(0, currentIndex), placement.legs.length - 1);
  const leg = placement.legs[idx];
  const input = inputs[idx];
  const p = input ? waypointFraction(input, hw[input.id] ?? 0).p : 0;
  return leg.start + p * (leg.end - leg.start);
}

/**
 * First run (Deon's decision): the start dot is inked and the baseline shows,
 * but NO Move is counted as done unless the server says so. Display-only.
 */
export function firstRunSeed(_inputs: WaypointProgressInput[]): { startInked: true } {
  return { startInked: true };
}

/* ------------------------------------------------------------------ */
/* Value-row copy (prototype valHTML)                                  */
/* ------------------------------------------------------------------ */

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const formatProgressNumber = (n: number): string => numberFormat.format(Math.round(n));

export const PROGRESS_COPY = {
  current: (cur: number, target: number) => `${formatProgressNumber(cur)} / ${formatProgressNumber(target)}`,
  startedAt: (base: number) => `started at ${formatProgressNumber(base)}`,
  movesOf: (done: number, total: number) => `${done} of ${total} moves`,
  holdsAtNinety: 'route holds at 90% until you confirm',
  movesDrawLeg: 'moves draw this leg',
  toReach: (unit: string | null) => `${unit ? `${unit} ` : ''}to reach`,
  targetValue: (target: number) => formatProgressNumber(target),
  reached: 'reached',
} as const;

export type ProgressValueRow = { strong: string; span: string } | null;

/**
 * Value row for a waypoint relative to the current one.
 * relation: 'upcoming' | 'reached' | 'current'.
 */
export function progressValueRow(
  input: WaypointProgressInput,
  relation: 'upcoming' | 'reached' | 'current',
  hw: number,
  unit: string | null = null
): ProgressValueRow {
  if (relation === 'upcoming') {
    return input.metric
      ? { strong: formatProgressNumber(input.metric.target), span: PROGRESS_COPY.toReach(unit) }
      : null;
  }
  if (relation === 'reached') {
    return input.metric ? { strong: formatProgressNumber(input.metric.target), span: PROGRESS_COPY.reached } : null;
  }
  if (input.metric) {
    const showStartedAt = input.metric.baseline != null && input.metric.current >= input.metric.baseline;
    return {
      strong: PROGRESS_COPY.current(input.metric.current, input.metric.target),
      span: showStartedAt ? PROGRESS_COPY.startedAt(input.metric.baseline) : '',
    };
  }
  return {
    strong: PROGRESS_COPY.movesOf(input.movesDone, input.movesTotal),
    span: isWaypointReady(input, hw) ? PROGRESS_COPY.holdsAtNinety : PROGRESS_COPY.movesDrawLeg,
  };
}
