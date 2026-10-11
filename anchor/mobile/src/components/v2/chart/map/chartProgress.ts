/**
 * Chart map progress rules (prototype mvFrac / metFrac / raw / pOf / isReady).
 * Pure; everything is derived from server data plus a presentation-only
 * high-water map. Nothing here decides reach: the user confirms that.
 */
import type { CourseDetail, WaypointSummary } from '@/types/chart';
import type { ChartWaypointView } from '@/adapters/v2/chart/chartV2Model';
import { toChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import { CHART_COPY } from '@/constants/v2/chartCopy';
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

export type ChartWeatherProgress = {
  courseId: string;
  inputs: WaypointProgressInput[];
  currentIndex: number;
  isFinished: boolean;
};

/** Convert server Course truth into the same progress inputs consumed by the full Chart. */
export function chartWeatherProgress(course: CourseDetail): ChartWeatherProgress {
  const view = toChartViewModel(course);
  const rawWaypoints = new Map(course.waypoints.map(waypoint => [waypoint.id, waypoint]));
  return {
    courseId: view.courseId,
    inputs: view.waypoints.map(waypoint => toProgressInput(waypoint, rawWaypoints.get(waypoint.id)?.metric)),
    currentIndex: view.currentIndex,
    // Full Chart completion is server status, even if every waypoint currently reads reached.
    isFinished: view.isFinished,
  };
}

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
      raw && typeof raw.baseline === 'number' && Number.isFinite(raw.baseline) && raw.baseline !== target ? raw.baseline : w.metric.baseline ?? 0;
    metric = { baseline, current: w.metric.current === null ? baseline : w.metric.current, target };
  }
  // ChartWaypointView.moves already holds ACTIVE + COMPLETED only; filter again defensively.
  const counted = w.moves.filter((m) => m.status === 'ACTIVE' || m.status === 'COMPLETED');
  return {
    id: w.id,
    mode: w.progress,
    completed: w.state === 'completed',
    metric,
    requirementsDone: w.requirements?.filter(r => r.completed).length ?? 0,
    requirementsTotal: w.requirements?.length ?? 0,
    movesDone: counted.filter((m) => m.status === 'COMPLETED').length,
    movesTotal: counted.length,
  };
}

export function metricFraction(input: WaypointProgressInput): number {
  const m = input.metric;
  if (!m) return 0;
  const span = m.target - m.baseline;
  if (span === 0) return m.current === m.target ? 1 : 0;
  return clamp01((m.current - m.baseline) / span);
}

export function movesFraction(input: WaypointProgressInput): number {
  return input.movesTotal > 0 ? clamp01(input.movesDone / input.movesTotal) : 0;
}

/** Where a waypoint's progress is a number, its moves, or nothing at all. */
export function progressModeOf(input: WaypointProgressInput): 'numeric' | 'checklist' | 'completion' | 'moves' | 'none' {
  if (input.metric) return 'numeric';
  if (input.mode === 'checklist' || input.mode === 'completion') return input.mode;
  return input.mode === 'none' ? 'none' : 'moves';
}

export function rawFraction(input: WaypointProgressInput): number {
  // A waypoint with no progress has nothing to draw: its leg fills only when it is reached.
  if (progressModeOf(input) === 'none' || progressModeOf(input) === 'completion') return 0;
  if (progressModeOf(input) === 'checklist') return (input.requirementsTotal ?? 0) > 0 ? clamp01((input.requirementsDone ?? 0) / input.requirementsTotal!) : 0;
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
  if (progressModeOf(input) === 'none' || progressModeOf(input) === 'completion') return false;
  if (progressModeOf(input) === 'checklist') return (input.requirementsTotal ?? 0) > 0 && input.requirementsDone === input.requirementsTotal;
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

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
export const formatProgressNumber = (n: number): string => numberFormat.format(n);

export const PROGRESS_COPY = {
  current: (cur: number, target: number) => `${formatProgressNumber(cur)} / ${formatProgressNumber(target)}`,
  startedAt: (base: number) => `started at ${formatProgressNumber(base)}`,
  movesOf: (done: number, total: number) => `${done} of ${total} ${total === 1 ? 'move' : 'moves'} done`,
  holdsAtNinety: CHART_COPY.sheet.routeHolds,
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
  if (progressModeOf(input) === 'completion') return { strong: relation === 'reached' ? 'Reached' : 'Not reached', span: '' };
  if (progressModeOf(input) === 'checklist') return { strong: `${input.requirementsDone ?? 0} of ${input.requirementsTotal ?? 0} requirements`, span: '' };
  if (relation === 'upcoming') {
    return input.metric
      ? { strong: formatProgressNumber(input.metric.target), span: PROGRESS_COPY.toReach(unit) }
      : null;
  }
  if (relation === 'reached') {
    return input.metric ? { strong: formatProgressNumber(input.metric.target), span: PROGRESS_COPY.reached } : null;
  }
  if (input.metric) {
    // The fraction already says where things began; only a real, non-zero starting point is worth repeating.
    const showStartedAt = input.metric.baseline > 0 && input.metric.current >= input.metric.baseline;
    return {
      strong: PROGRESS_COPY.current(input.metric.current, input.metric.target),
      span: showStartedAt ? PROGRESS_COPY.startedAt(input.metric.baseline) : '',
    };
  }
  // Nothing to show when there is no progress to speak of: no counter, no empty "0 of 0".
  if (progressModeOf(input) === 'none' || input.movesTotal === 0) return null;
  return {
    strong: PROGRESS_COPY.movesOf(input.movesDone, input.movesTotal),
    span: isWaypointReady(input, hw) ? PROGRESS_COPY.holdsAtNinety : PROGRESS_COPY.movesDrawLeg,
  };
}

/* ------------------------------------------------------------------ */
/* Magnitude-scaled steppers                                           */
/* ------------------------------------------------------------------ */

export type ProgressStep = { value: number; label: string };

/** Largest 1-2-5 step that does not exceed `raw` (at least 1). */
function niceStep(raw: number): number {
  if (!(raw >= 1)) return 1;
  const exponent = Math.floor(Math.log10(raw));
  const base = 10 ** exponent;
  const lead = raw / base;
  const mantissa = lead >= 5 ? 5 : lead >= 2 ? 2 : 1;
  return mantissa * base;
}

/**
 * Stepper chips for "Update progress", sized to the target: a 50,000 target steps in thousands, a 100
 * target in fives. About twenty nudges cover the whole distance, and one tap is never a rounding error.
 */
export function progressSteps(target: number, baseline = 0, label: string | null = null): ProgressStep[] {
  const countUnit = /users?|clients?|items?|books?|applications?/i.test(label ?? '');
  const span = Math.abs(target - baseline);
  const unit = countUnit ? 1 : span < 20 && span > 0 ? Number((span / 20).toPrecision(1)) : niceStep((span || 100) / 20);
  const stepLabel = (value: number) => `${value < 0 ? '−' : '+'}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(Math.abs(value))}`;
  return [-unit, unit, unit * 5, unit * 10].map((value) => ({ value, label: stepLabel(value) }));
}
