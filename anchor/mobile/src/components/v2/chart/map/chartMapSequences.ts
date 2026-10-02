/**
 * Chart map sequences: pure builders that turn an explicit context into a
 * `SequenceSpec` (chart-build-prompt.md section 10). No store access, no React.
 *
 * - Offsets and durations come from `CHART_MAP_TIMING` (device tuning scales
 *   `timeScale` in the runner, never the ratios here).
 * - Reduced motion: no camera moves, no pulse, no sway; state changes are
 *   sets or `CHART_MAP_REDUCED_FADE` crossfades.
 * - Every `call` step is idempotent (plain assignments plus caller callbacks).
 * - Rest values: `pulse` rests at 1 (opacity .9*(1-u) = invisible), `fog` at 0
 *   after a reach, `stampIndex` at -1. Tweens that start from a rest value pass
 *   an explicit `from` so they never depend on the previous value.
 */
import { CHART_MAP_REDUCED_FADE, CHART_MAP_TIMING } from '../chartMotion';
import { cameraTargetFor } from './chartMapGeometry';
import { cameraSteps, focusTarget, overviewTarget, type CameraTarget } from './useChartMapCamera';
import type {
  ChartMapAnimState,
  MapPoint,
  RouteTable,
  SequenceEasing,
  SequenceSpec,
  SequenceStep,
  WaypointPlacement,
} from './chartMapContracts';

type Target = ChartMapAnimState['revealArc'];

const T = CHART_MAP_TIMING;
const FADE = CHART_MAP_REDUCED_FADE;

function tween(
  target: Target,
  to: number,
  at: number,
  duration: number,
  easing: SequenceEasing = 'inOut',
  from?: number,
): SequenceStep {
  const step: SequenceStep = { kind: 'tween', at, duration, easing, target, to };
  if (from !== undefined) step.from = from;
  return step;
}

function call(at: number, run: () => void): SequenceStep {
  return { kind: 'call', at, run };
}

/**
 * Camera move: cx, cy and s tween together. Thin alias over B's pure helper
 * (`cameraSteps` in useChartMapCamera.ts); duration 0 makes it a set.
 */
function cameraTo(anim: ChartMapAnimState, to: CameraTarget, at: number, duration: number): SequenceStep[] {
  return cameraSteps(anim, to, at, duration, 'inOut');
}

function pointAt(placement: WaypointPlacement, index: number): MapPoint | null {
  return index >= 0 && index < placement.points.length ? placement.points[index] : null;
}

/** Latest end (at + duration) over all steps: the natural length of a spec. */
export function sequenceDuration(spec: SequenceSpec): number {
  return spec.steps.reduce(
    (max, step) => Math.max(max, step.at + (step.kind === 'tween' ? step.duration : 0)),
    0,
  );
}

/* ------------------------------------------------------------------ */
/* Screen open                                                         */
/* ------------------------------------------------------------------ */

export type OpenSequenceContext = {
  anim: ChartMapAnimState;
  placement: WaypointPlacement;
  /** Arc length the route is drawn to (server truth: routeRevealArc). */
  revealTo: number;
  /** Waypoint the flag lands on and the camera settles on; -1 = none (finished chart). */
  currentIndex: number;
  reducedMotion: boolean;
  /** Panel fades/slides in (350 ms, panel-owned). */
  onPanel?: () => void;
};

export function openSequence(ctx: OpenSequenceContext): SequenceSpec {
  const { anim, placement, revealTo, currentIndex, reducedMotion, onPanel } = ctx;
  const point = pointAt(placement, currentIndex);
  const o = T.open;
  const steps: SequenceStep[] = [];

  const reset = () => {
    anim.revealArc.value = 0;
    anim.flagOpacity.value = 0;
    const home = overviewTarget();
    anim.camera.cx.value = home.cx;
    anim.camera.cy.value = home.cy;
    anim.camera.s.value = home.s;
  };
  const placeFlag = () => {
    anim.flagIndex.value = point ? currentIndex : -1;
    anim.flagOpacity.value = point ? 1 : 0;
  };

  if (reducedMotion) {
    steps.push(call(0, reset));
    steps.push(tween(anim.mapOpacity, 1, 0, FADE, 'linear', 0));
    steps.push(tween(anim.revealArc, revealTo, 0, 0));
    steps.push(call(0, placeFlag));
    steps.push(tween(anim.flagDrop, 1, 0, 0, 'out', 1));
    if (onPanel) steps.push(call(FADE, onPanel));
    return { name: 'open', steps };
  }

  steps.push(call(0, reset));
  steps.push(tween(anim.mapOpacity, 1, 0, o.mapFade, 'inOut', 0));
  steps.push(tween(anim.revealArc, revealTo, o.routeAt, o.route, 'inOut', 0));
  steps.push(call(o.flagAt, placeFlag));
  if (point) {
    steps.push(tween(anim.flagDrop, 1, o.flagAt, o.flagDrop, 'out', 0));
    // Keep overview framing so waypoints 1-5 and summit X stay visible without clipping
    steps.push(...cameraTo(anim, overviewTarget(), o.cameraAt, o.camera));
  }
  if (onPanel) steps.push(call(o.panelAt, onPanel));
  return { name: 'open', steps };
}

/* ------------------------------------------------------------------ */
/* Move checked                                                        */
/* ------------------------------------------------------------------ */

export type MoveCheckSequenceContext = {
  anim: ChartMapAnimState;
  fromArc: number;
  toArc: number;
  reducedMotion: boolean;
  /** The day-closed card replaces the move card. */
  onDayClosed?: () => void;
};

export function moveCheckSequence(ctx: MoveCheckSequenceContext): SequenceSpec {
  const { anim, fromArc, toArc, reducedMotion, onDayClosed } = ctx;
  const m = T.moveCheck;
  const steps: SequenceStep[] = [];
  const extends_ = toArc > fromArc + 0.5;

  if (reducedMotion) {
    if (extends_) steps.push(tween(anim.revealArc, toArc, 0, 0));
    if (onDayClosed) steps.push(call(0, onDayClosed));
    return { name: 'moveCheck', steps };
  }

  if (extends_) steps.push(tween(anim.revealArc, toArc, m.routeAt, m.route, 'inOut', fromArc));
  // Pulse rests at 1 (invisible); it is left there at the end.
  steps.push(tween(anim.pulse, 1, m.pulseAt, m.pulse, 'out', 0));
  if (onDayClosed) steps.push(call(m.dayClosedAt, onDayClosed));
  return { name: 'moveCheck', steps };
}

/* ------------------------------------------------------------------ */
/* Waypoint tap                                                        */
/* ------------------------------------------------------------------ */

export type WaypointTapSequenceContext = {
  anim: ChartMapAnimState;
  /** Marker to focus on; ignored when `toOverview`. */
  point: MapPoint | null;
  toOverview: boolean;
  reducedMotion: boolean;
};

export function waypointTapSequence(ctx: WaypointTapSequenceContext): SequenceSpec {
  const { anim, point, toOverview, reducedMotion } = ctx;
  // Reduced motion: no camera moves (the panel crossfade is panel-owned).
  if (reducedMotion) return { name: 'waypointTap', steps: [] };
  const target: CameraTarget | null = toOverview
    ? overviewTarget()
    : point
      ? cameraTargetFor(point, T.waypointTap.scale)
      : null;
  return {
    name: 'waypointTap',
    steps: target ? cameraTo(anim, target, 0, T.waypointTap.camera) : [],
  };
}

/* ------------------------------------------------------------------ */
/* Reach ceremony                                                      */
/* ------------------------------------------------------------------ */

export type ReachSequenceContext = {
  anim: ChartMapAnimState;
  placement: WaypointPlacement;
  /** The waypoint being reached (0-based). Not the last one (use arrivalSequence). */
  index: number;
  /** End of the reached leg = placement.arcs[index]. */
  endArc: number;
  /** Reveal into the next leg (routeRevealArc for the new current waypoint). */
  nextRevealArc: number;
  reducedMotion: boolean;
  /** Marker/panel state advances to the next waypoint (900). */
  onAdvance?: () => void;
  /** Commit card appears (1500). */
  onCommitCard?: () => void;
};

export function reachSequence(ctx: ReachSequenceContext): SequenceSpec {
  const { anim, placement, index, endArc, nextRevealArc, reducedMotion, onAdvance, onCommitCard } = ctx;
  const r = T.reach;
  const nextIndex = index + 1;
  const nextPoint = pointAt(placement, nextIndex);
  const steps: SequenceStep[] = [];

  const stampOn = () => {
    anim.stampIndex.value = index;
  };
  const advance = () => {
    anim.flagIndex.value = nextPoint ? nextIndex : anim.flagIndex.value;
    anim.flagOpacity.value = 1;
    onAdvance?.();
  };
  const settle = () => {
    anim.fog.value = 0;
    anim.stampIndex.value = -1;
  };

  if (reducedMotion) {
    steps.push(call(0, stampOn));
    steps.push(tween(anim.stamp, 1, 0, 0, 'inOut', 1));
    steps.push(tween(anim.revealArc, nextRevealArc, 0, 0));
    steps.push(call(0, advance));
    steps.push(tween(anim.flagDrop, 1, 0, 0, 'out', 1));
    if (onCommitCard) steps.push(call(FADE, onCommitCard));
    steps.push(call(FADE, settle));
    return { name: 'reach', steps };
  }

  steps.push(call(r.stampAt, stampOn));
  steps.push(tween(anim.stamp, 1, r.stampAt, r.stamp, 'inOut', 0));
  steps.push(tween(anim.revealArc, endArc, r.routeAt, r.route, 'inOut'));
  steps.push(tween(anim.pulse, 1, r.pulseAt, r.pulse, 'out', 0));
  steps.push(tween(anim.fog, r.fogBreathPeak, r.fogBreathAt, r.fogBreathUp, 'inOut', 0));
  steps.push(tween(anim.fog, 0, r.fogBreathDownAt, r.fogBreathDown, 'inOut', r.fogBreathPeak));
  steps.push(tween(anim.revealArc, nextRevealArc, r.revealAt, r.reveal, 'inOut'));
  steps.push(call(r.flagAt, advance));
  steps.push(tween(anim.flagDrop, 1, r.flagAt, r.flagDrop, 'out', 0));
  if (nextPoint) {
    steps.push(...cameraTo(anim, focusTarget(placement, nextIndex, r.scale), r.cameraAt, r.camera));
  }
  if (onCommitCard) steps.push(call(r.panelAt, onCommitCard));
  const end = Math.max(r.cameraAt + r.camera, r.panelAt);
  steps.push(call(end, settle));
  return { name: 'reach', steps };
}

/* ------------------------------------------------------------------ */
/* Arrival                                                             */
/* ------------------------------------------------------------------ */

export type ArrivalSequenceContext = {
  anim: ChartMapAnimState;
  placement: WaypointPlacement;
  table: RouteTable;
  /** The final waypoint being stamped. */
  index: number;
  reducedMotion: boolean;
  /** Arrival panel appears (3000). */
  onArrived?: () => void;
};

export function arrivalSequence(ctx: ArrivalSequenceContext): SequenceSpec {
  const { anim, table, index, reducedMotion, onArrived } = ctx;
  const a = T.arrival;
  const steps: SequenceStep[] = [];

  const stampOn = () => {
    anim.stampIndex.value = index;
  };
  const settle = () => {
    anim.stampIndex.value = -1;
  };

  if (reducedMotion) {
    steps.push(call(0, stampOn));
    steps.push(tween(anim.stamp, 1, 0, 0, 'inOut', 1));
    steps.push(tween(anim.flagOpacity, 0, 0, FADE, 'linear'));
    steps.push(tween(anim.revealArc, table.total, 0, 0));
    steps.push(...cameraTo(anim, overviewTarget(), 0, 0));
    steps.push(tween(anim.fog, 1, 0, FADE, 'linear'));
    steps.push(tween(anim.glyph, 1, 0, FADE, 'linear'));
    steps.push(tween(anim.goldDot, 1, 0, FADE, 'linear'));
    if (onArrived) steps.push(call(FADE, onArrived));
    steps.push(call(FADE, settle));
    return { name: 'arrival', steps };
  }

  steps.push(call(a.stampAt, stampOn));
  steps.push(tween(anim.stamp, 1, a.stampAt, a.stamp, 'inOut', 0));
  steps.push(call(0, () => {
    anim.flagOpacity.value = 0;
  }));
  steps.push(tween(anim.revealArc, table.total, a.routeAt, a.route, 'inOut'));
  steps.push(...cameraTo(anim, overviewTarget(), a.cameraAt, a.camera));
  steps.push(tween(anim.fog, 1, a.fogAt, a.fog, 'inOut', 0));
  steps.push(tween(anim.glyph, 1, a.glyphAt, a.glyph, 'inOut', 0));
  steps.push(tween(anim.goldDot, 1, a.goldDotAt, a.goldDot, 'inOut', 0));
  if (onArrived) steps.push(call(a.panelAt, onArrived));
  steps.push(call(a.panelAt, settle));
  return { name: 'arrival', steps };
}
