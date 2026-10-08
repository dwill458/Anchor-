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
import { CHART_INTRO_TIMING } from '../chartMotion';
import { cameraTargetFor } from './chartMapGeometry';
import { cameraSteps, focusTarget, overviewTarget, type CameraTarget } from './useChartMapCamera';
import type {
  ChartMapAnimState,
  ChartRouteRevision,
  MapPoint,
  RouteTable,
  SequenceEasing,
  SequenceSpec,
  SequenceStep,
  WaypointPlacement,
} from './chartMapContracts';
import type { SharedValue } from 'react-native-reanimated';

type Target = ChartMapAnimState['revealArc'];

const T = CHART_MAP_TIMING;
const INTRO = CHART_INTRO_TIMING;
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

/** A sound/haptic moment the host plays (ChartActiveView maps beats to useChartSound + safeHaptics). */
export type ChartBeat = 'open' | 'ink' | 'flag' | 'check' | 'stamp' | 'wind' | 'note' | 'hush' | 'summit' | 'pop';
export type ChartBeatHandler = (beat: ChartBeat) => void;

/** Beat step: transient, so a skipped sequence drops it rather than firing every pending sound at once. */
function beat(steps: SequenceStep[], at: number, onBeat: ChartBeatHandler | undefined, which: ChartBeat): void {
  if (!onBeat) return;
  steps.push({ kind: 'call', at, run: () => onBeat(which), transient: true });
}

/**
 * Beat that must happen exactly once even when the sequence is skipped (the waypoint note and its haptic mark the
 * commitment). Not transient: a skip runs it at once if it has not fired yet; a normal run fires it at `at`.
 */
function settledBeat(steps: SequenceStep[], at: number, onBeat: ChartBeatHandler | undefined, which: ChartBeat): void {
  if (!onBeat) return;
  steps.push({ kind: 'call', at, run: () => onBeat(which) });
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
/* Creation intro opening                                              */
/* ------------------------------------------------------------------ */

export type ChartIntroBeat = 'open' | 'ink' | 'flag' | 'duck';

/** Normalized presentation progress driven by the intro sequence on the UI thread. */
export type IntroSequenceProgress = {
  contour: SharedValue<number>;
  tone: SharedValue<number>;
  route: SharedValue<number>;
  copy: SharedValue<number>;
  marker: SharedValue<number>;
  continue: SharedValue<number>;
  land: SharedValue<number>;
  cameraScale: SharedValue<number>;
};

export type IntroSequenceContext = {
  progress: IntroSequenceProgress;
  /** Sound callbacks are transient, so skip drops all remaining effects. */
  onBeat?: (beat: ChartIntroBeat) => void;
  /** Starts the ambient bed at the sequence's first frame. */
  onStartAir?: () => void;
  /** Enables Continue at the beginning of its fade, without a host timer. */
  onContinueVisible?: () => void;
  /** Mark the per-account intro as seen when its survey route begins. */
  onRouteStart?: () => void;
  /** Mounts the settled land layer when its existing crossfade begins. */
  onLandReveal?: () => void;
  /** Runs after the visual sequence fully completes, including on skip. */
  onEnd?: () => void;
};

function introBeat(steps: SequenceStep[], at: number, onBeat: IntroSequenceContext['onBeat'], which: ChartIntroBeat): void {
  if (!onBeat) return;
  steps.push({ kind: 'call', at, run: () => onBeat(which), transient: true });
}

/** First-ever account intro, with every frame state driven by the shared sequencer. */
export function introFullSequence(ctx: IntroSequenceContext): SequenceSpec {
  const { progress: p, onBeat, onStartAir, onContinueVisible, onRouteStart, onLandReveal } = ctx;
  const steps: SequenceStep[] = [];
  steps.push(call(0, () => {
    p.contour.value = 0;
    p.tone.value = 0;
    p.route.value = 0;
    p.copy.value = 0;
    p.marker.value = 0;
    p.continue.value = 0;
    p.land.value = 0;
    p.cameraScale.value = INTRO.cameraFrom;
    onStartAir?.();
  }));
  introBeat(steps, INTRO.openAt, onBeat, 'open');
  steps.push(tween(p.cameraScale, INTRO.cameraTo, INTRO.cameraAt, INTRO.camera, 'deliberate', INTRO.cameraFrom));
  steps.push(tween(p.contour, 1, INTRO.contourAt, INTRO.contour, 'draw', 0));
  steps.push(tween(p.tone, 1, INTRO.toneAt, INTRO.tone, 'draw', 0));
  steps.push(call(INTRO.routeAt, () => onRouteStart?.()));
  introBeat(steps, INTRO.routeAt, onBeat, 'ink');
  steps.push(tween(p.route, 1, INTRO.routeAt, INTRO.route, 'draw', 0));
  steps.push(tween(p.copy, 1, INTRO.copyAt, INTRO.copy, 'settle', 0));
  steps.push(call(INTRO.landPrepareAt, () => onLandReveal?.()));
  steps.push(call(INTRO.continueAt, () => onContinueVisible?.()));
  steps.push(tween(p.continue, 1, INTRO.continueAt, INTRO.continue, 'settle', 0));
  introBeat(steps, INTRO.markerAt, onBeat, 'flag');
  steps.push(tween(p.marker, 1, INTRO.markerAt, INTRO.marker, 'out', 0));
  steps.push(tween(p.land, 1, INTRO.landCrossfadeAt, INTRO.landCrossfade, 'linear', 0));
  introBeat(steps, INTRO.duckAt, onBeat, 'duck');
  return { name: 'introFull', steps, tweenClock: 'ui', onEnd: ctx.onEnd };
}

/** Returning-account intro: compact parallel ink passes, route, then copy. */
export function introShortSequence(ctx: IntroSequenceContext): SequenceSpec {
  const { progress: p, onBeat, onContinueVisible, onRouteStart, onLandReveal } = ctx;
  const steps: SequenceStep[] = [];
  steps.push(call(0, () => {
    p.contour.value = 0;
    p.tone.value = 0;
    p.route.value = 0;
    p.copy.value = 0;
    p.marker.value = 1;
    p.continue.value = 0;
    p.land.value = 0;
    p.cameraScale.value = INTRO.cameraTo;
    onRouteStart?.();
    onLandReveal?.();
  }));
  introBeat(steps, 0, onBeat, 'open');
  introBeat(steps, 0, onBeat, 'ink');
  steps.push(tween(p.contour, 1, 0, INTRO.shortInk, 'draw', 0));
  steps.push(tween(p.tone, 1, 0, INTRO.shortInk, 'draw', 0));
  steps.push(tween(p.route, 1, 0, INTRO.shortRoute, 'draw', 0));
  steps.push(tween(p.land, 1, INTRO.shortLandCrossfadeAt, INTRO.shortInk - INTRO.shortLandCrossfadeAt, 'linear', 0));
  steps.push(tween(p.copy, 1, INTRO.shortCopyAt, INTRO.shortCopy, 'settle', 0));
  steps.push(call(INTRO.shortCopyAt, () => onContinueVisible?.()));
  steps.push(tween(p.continue, 1, INTRO.shortCopyAt, INTRO.shortCopy, 'settle', 0));
  return { name: 'introShort', steps, tweenClock: 'ui', onEnd: ctx.onEnd };
}

/** Reduced motion: snap all content to its final presentation and cross-fade the land once. */
export function introReducedSequence(ctx: IntroSequenceContext): SequenceSpec {
  const { progress: p, onBeat, onContinueVisible, onRouteStart, onLandReveal } = ctx;
  const steps: SequenceStep[] = [];
  steps.push(call(0, () => {
    p.contour.value = 1;
    p.tone.value = 1;
    p.route.value = 1;
    p.copy.value = 1;
    p.marker.value = 1;
    p.continue.value = 1;
    p.land.value = 0;
    p.cameraScale.value = INTRO.cameraTo;
    onRouteStart?.();
    onContinueVisible?.();
    onLandReveal?.();
  }));
  introBeat(steps, 0, onBeat, 'open');
  steps.push(tween(p.land, 1, 0, FADE, 'linear', 0));
  return { name: 'introReduced', steps, onEnd: ctx.onEnd };
}

/** Tap-to-skip transition: finish the ink/map presentation without any sound beats. */
export function introSkipSequence(ctx: IntroSequenceContext): SequenceSpec {
  const { progress: p, onContinueVisible, onRouteStart, onLandReveal } = ctx;
  const duration = INTRO.skip;
  return {
    name: 'introSkip',
    steps: [
      call(0, () => {
        onRouteStart?.();
        onContinueVisible?.();
        onLandReveal?.();
      }),
      tween(p.contour, 1, 0, duration, 'linear'),
      tween(p.tone, 1, 0, duration, 'linear'),
      tween(p.route, 1, 0, duration, 'linear'),
      tween(p.copy, 1, 0, duration, 'linear'),
      tween(p.marker, 1, 0, duration, 'linear'),
      tween(p.continue, 1, 0, duration, 'linear'),
      tween(p.land, 1, 0, duration, 'linear'),
      tween(p.cameraScale, INTRO.cameraTo, 0, duration, 'linear'),
    ],
    onEnd: ctx.onEnd,
  };
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
  /** Sound/haptic beats (open, ink, flag). */
  onBeat?: ChartBeatHandler;
  /** Instant path only: where the cloud cover rests (default revealTo). The reveal hand-off passes creation's. */
  coverTo?: number;
  /** Instant path only: false = the map is already on screen (the reveal hand-off), so it does not fade in. */
  fadeIn?: boolean;
  /**
   * Later path only: the map opened under the frame-one veil's closed cover (closed = 1, the open's camera), so
   * the clouds part and the camera eases home over T.later.part instead of jumping to the settled state.
   */
  partFromClosed?: boolean;
};

/**
 * First open of the day. Frame one is full cloud cover with the camera pushed
 * in; the weather parts along the charted corridor while the camera eases back,
 * the pen draws the route, the flag drops, then the panel rises.
 */
export function openSequence(ctx: OpenSequenceContext): SequenceSpec {
  const { anim, placement, revealTo, currentIndex, reducedMotion, onPanel, onBeat } = ctx;
  const point = pointAt(placement, currentIndex);
  const o = T.open;
  const steps: SequenceStep[] = [];

  const placeFlag = () => {
    anim.flagIndex.value = point ? currentIndex : -1;
    anim.flagOpacity.value = point ? 1 : 0;
  };

  if (reducedMotion) {
    // Clouds already settled, route already drawn: one short cross-fade, no beats.
    const reset = () => {
      anim.flagOpacity.value = 0;
      anim.closed.value = 0;
      const home = overviewTarget();
      anim.camera.cx.value = home.cx;
      anim.camera.cy.value = home.cy;
      anim.camera.s.value = home.s;
    };
    steps.push(call(0, reset));
    if (ctx.fadeIn === false) steps.push(tween(anim.mapOpacity, 1, 0, 0));
    else steps.push(tween(anim.mapOpacity, 1, 0, FADE, 'linear', 0));
    steps.push(tween(anim.revealArc, revealTo, 0, 0));
    steps.push(tween(anim.coverArc, Math.max(revealTo, ctx.coverTo ?? revealTo), 0, 0));
    steps.push(call(0, placeFlag));
    steps.push(tween(anim.flagDrop, 1, 0, 0, 'out', 1));
    if (onPanel) steps.push(call(FADE, onPanel));
    return { name: 'open', steps };
  }

  // A finished Chart has no current waypoint to push in on: it opens at overview.
  const start = point ? o.startCamera : overviewTarget();
  const reset = () => {
    anim.revealArc.value = 0;
    anim.coverArc.value = 0;
    anim.closed.value = 1;
    anim.mapOpacity.value = 1;
    anim.flagOpacity.value = 0;
    anim.camera.cx.value = start.cx;
    anim.camera.cy.value = start.cy;
    anim.camera.s.value = start.s;
  };

  steps.push(call(0, reset));
  beat(steps, 0, onBeat, 'open');
  steps.push(tween(anim.closed, 0, 0, o.closed, 'settle', 1));
  steps.push(tween(anim.coverArc, revealTo, 0, o.cover, 'settle', 0));
  if (point) steps.push(...cameraSteps(anim, overviewTarget(), 0, o.camera, 'deliberate'));
  beat(steps, o.inkAt, onBeat, 'ink');
  steps.push(tween(anim.revealArc, revealTo, o.inkAt, o.route, 'draw', 0));
  steps.push(call(o.flagAt, placeFlag));
  if (point) {
    beat(steps, o.flagAt, onBeat, 'flag');
    steps.push(tween(anim.flagDrop, 1, o.flagAt, o.flagDrop, 'out', 0));
  }
  if (onPanel) steps.push(call(o.panelAt, onPanel));
  return { name: 'open', steps };
}

// DEFERRED: fade-in open (map fades up, route draws at 300, camera settles at 1000, panel at 1250).
// export function openSequence(ctx: OpenSequenceContext): SequenceSpec {
//   const { anim, placement, revealTo, currentIndex, reducedMotion, onPanel } = ctx;
//   const point = pointAt(placement, currentIndex);
//   const o = T.open;
//   const steps: SequenceStep[] = [];
//   const reset = () => {
//     anim.revealArc.value = 0;
//     anim.flagOpacity.value = 0;
//     const home = overviewTarget();
//     anim.camera.cx.value = home.cx;
//     anim.camera.cy.value = home.cy;
//     anim.camera.s.value = home.s;
//   };
//   const placeFlag = () => {
//     anim.flagIndex.value = point ? currentIndex : -1;
//     anim.flagOpacity.value = point ? 1 : 0;
//   };
//   if (reducedMotion) { ... unchanged above ... }
//   steps.push(call(0, reset));
//   steps.push(tween(anim.mapOpacity, 1, 0, o.mapFade, 'inOut', 0));
//   steps.push(tween(anim.revealArc, revealTo, o.routeAt, o.route, 'inOut', 0));
//   steps.push(call(o.flagAt, placeFlag));
//   if (point) {
//     steps.push(tween(anim.flagDrop, 1, o.flagAt, o.flagDrop, 'out', 0));
//     steps.push(...cameraTo(anim, overviewTarget(), o.cameraAt, o.camera));
//   }
//   if (onPanel) steps.push(call(o.panelAt, onPanel));
//   return { name: 'open', steps };
// }

/* ------------------------------------------------------------------ */
/* Later open (same day)                                               */
/* ------------------------------------------------------------------ */

/**
 * Already opened today: nothing redraws. Final states are set at 0, the weather
 * takes one slow breath and the panel peeks at 300. No beats.
 */
export function laterSequence(ctx: OpenSequenceContext): SequenceSpec {
  const { anim, placement, revealTo, currentIndex, reducedMotion, onPanel } = ctx;
  const point = pointAt(placement, currentIndex);
  const l = T.later;
  const steps: SequenceStep[] = [];

  const part = Boolean(ctx.partFromClosed) && !reducedMotion;
  const settle = () => {
    anim.revealArc.value = revealTo;
    anim.coverArc.value = revealTo;
    if (!part) anim.closed.value = 0;
    anim.mapOpacity.value = 1;
    anim.flagIndex.value = point ? currentIndex : -1;
    anim.flagOpacity.value = point ? 1 : 0;
    anim.flagDrop.value = 1;
    if (!part) {
      const home = overviewTarget();
      anim.camera.cx.value = home.cx;
      anim.camera.cy.value = home.cy;
      anim.camera.s.value = home.s;
    }
  };
  steps.push(call(0, settle));
  if (part) {
    steps.push(tween(anim.closed, 0, 0, l.part, 'settle', 1));
    steps.push(...cameraSteps(anim, overviewTarget(), 0, l.part, 'deliberate'));
  }

  if (reducedMotion) {
    if (onPanel) steps.push(call(l.reducedPanelAt, onPanel));
    return { name: 'later', steps };
  }

  // A finished Chart rests with the fog fully lifted; it never breathes back in.
  if (point) {
    steps.push(tween(anim.fog, l.breathPeak, 0, l.breathUp, 'inOut', 0));
    steps.push(tween(anim.fog, 0, l.breathUp, l.breathDown, 'inOut', l.breathPeak));
  }
  if (onPanel) steps.push(call(l.panelAt, onPanel));
  return { name: 'later', steps };
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
  /** Sound/haptic beats (check, ink). */
  onBeat?: ChartBeatHandler;
};

export function moveCheckSequence(ctx: MoveCheckSequenceContext): SequenceSpec {
  const { anim, fromArc, toArc, reducedMotion, onDayClosed, onBeat } = ctx;
  const m = T.moveCheck;
  const steps: SequenceStep[] = [];
  const extends_ = toArc > fromArc + 0.5;
  // The cover never closes back in: after a reach it can already sit past the new tip.
  const coverMoves = extends_ && toArc > anim.coverArc.value + 0.5;

  if (reducedMotion) {
    beat(steps, 0, onBeat, 'check');
    if (extends_) steps.push(tween(anim.revealArc, toArc, 0, 0));
    if (coverMoves) steps.push(tween(anim.coverArc, toArc, 0, 0));
    if (onDayClosed) steps.push(call(0, onDayClosed));
    return { name: 'moveCheck', steps };
  }

  beat(steps, 0, onBeat, 'check');
  if (extends_) {
    beat(steps, m.routeAt, onBeat, 'ink');
    steps.push(tween(anim.revealArc, toArc, m.routeAt, m.route, 'inOut', fromArc));
  }
  if (coverMoves) steps.push(tween(anim.coverArc, toArc, m.coverAt, m.cover, 'settle'));
  // Pulse rests at 1 (invisible); it is left there at the end.
  steps.push(tween(anim.pulse, 1, m.pulseAt, m.pulse, 'out', 0));
  if (onDayClosed) steps.push(call(m.dayClosedAt, onDayClosed));
  return { name: 'moveCheck', steps };
}

/* ------------------------------------------------------------------ */
/* One Move done (M1): ink along the current leg to its 90% hold         */
/* ------------------------------------------------------------------ */

/** The arc a move can ink the leg to: `holdFraction` (90%) of the way along leg `legIndex`. Null without that leg. */
export function moveHoldArc(placement: WaypointPlacement, legIndex: number): number | null {
  const leg = placement.legs[legIndex];
  return leg ? leg.start + T.moveHold.holdFraction * Math.max(0, leg.end - leg.start) : null;
}

export type MoveHoldSequenceContext = {
  anim: ChartMapAnimState;
  placement: WaypointPlacement;
  /** The current leg (the leg that ends at the current waypoint). */
  legIndex: number;
  reducedMotion: boolean;
  /** Where the ink starts. Defaults to the drawn tip, which is the leg start on a leg's first move. */
  fromArc?: number;
  /** Where the ink stops. Defaults to the 90% hold and is never allowed past it. */
  toArc?: number;
  /** The day-closed card replaces the move card (after the toast has gone out). */
  onDayClosed?: () => void;
  /** Sound beats (check, ink). The tap haptic is the row's, not a beat. */
  onBeat?: ChartBeatHandler;
};

/**
 * One Move done: the shipped circle, strike-through and toast live in the row. This adds only the ink: the current
 * leg draws forward to its 90% hold, the cover follows, and the tip pulses. The waypoint marker is never touched
 * (the move does not reach it), so it stays open. Reduce Motion sets the ink with no travel.
 */
export function moveHoldSequence(ctx: MoveHoldSequenceContext): SequenceSpec {
  const { anim, placement, legIndex, reducedMotion, onDayClosed, onBeat } = ctx;
  const m = T.moveHold;
  const steps: SequenceStep[] = [];
  const from = ctx.fromArc ?? anim.revealArc.value;
  const hold = moveHoldArc(placement, legIndex);
  // No leg to hold on (a finished Chart): nothing to ink, never past the hold otherwise.
  const to = hold === null ? from : Math.min(ctx.toArc ?? hold, hold);
  const extends_ = to > from + 0.5;
  // The cover never closes back in: after a reach it can already sit past the new tip.
  const coverMoves = extends_ && to > anim.coverArc.value + 0.5;

  beat(steps, m.checkAt, onBeat, 'check');
  if (reducedMotion) {
    if (extends_) steps.push(tween(anim.revealArc, to, 0, 0));
    if (coverMoves) steps.push(tween(anim.coverArc, to, 0, 0));
  } else {
    if (extends_) {
      beat(steps, m.routeAt, onBeat, 'ink');
      steps.push(tween(anim.revealArc, to, m.routeAt, m.route, 'inOut', from));
    }
    if (coverMoves) steps.push(tween(anim.coverArc, to, m.coverAt, m.cover, 'settle'));
    // Pulse rests at 1 (invisible); it is left there at the end.
    steps.push(tween(anim.pulse, 1, m.pulseAt, m.pulse, 'out', 0));
  }
  if (onDayClosed) steps.push(call(m.dayClosedAt, onDayClosed));
  // The scene rests until here, so its length is the registered one.
  steps.push(call(m.settleAt, () => undefined));
  return { name: 'moveHold', steps };
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
  /** The waypoint being reached (0-based). Not the last one (use summitSequence). */
  index: number;
  /** End of the reached leg = placement.arcs[index]. */
  endArc: number;
  /** Reveal into the next leg (routeRevealArc for the new current waypoint). */
  nextRevealArc: number;
  reducedMotion: boolean;
  /** The marker fills (1000): the host swaps the reached marker from open to done here. Idempotent. */
  onStamp?: () => void;
  /** Marker/panel state advances to the next waypoint (1700). */
  onAdvance?: () => void;
  /** Commit card appears (1700). */
  onCommitCard?: () => void;
  /**
   * Sound/haptic beats: `ink` (the pen, transient) and `note` (the one waypoint note + its Light haptic, at the marker
   * fill). `note` is not transient, so a skipped scene still plays it, once.
   */
  onBeat?: ChartBeatHandler;
};

/** Arc the cloud cover rolls back to after reaching `index`: 30% into the next leg, never behind the ink. */
export function reachCoverArc(placement: WaypointPlacement, index: number, endArc: number, nextRevealArc: number): number {
  const next = placement.legs[index + 1];
  const lead = next ? endArc + T.reach.coverLead * Math.max(0, next.end - next.start) : endArc;
  return Math.max(nextRevealArc, lead);
}

export function reachSequence(ctx: ReachSequenceContext): SequenceSpec {
  const { anim, placement, index, endArc, nextRevealArc, reducedMotion, onStamp, onAdvance, onCommitCard, onBeat } = ctx;
  const r = T.reach;
  const nextIndex = index + 1;
  const nextPoint = pointAt(placement, nextIndex);
  const coverTo = reachCoverArc(placement, index, endArc, nextRevealArc);
  const steps: SequenceStep[] = [];

  const stampOn = () => {
    anim.stampIndex.value = index;
    onStamp?.();
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

  // The scene's only haptic and only note, in every mode: they mark the commitment, not the motion.
  if (reducedMotion) {
    steps.push(call(0, stampOn));
    settledBeat(steps, 0, onBeat, 'note');
    steps.push(tween(anim.stamp, 1, 0, 0, 'inOut', 1));
    steps.push(tween(anim.revealArc, nextRevealArc, 0, 0));
    steps.push(tween(anim.coverArc, coverTo, 0, 0));
    steps.push(call(0, advance));
    steps.push(tween(anim.flagDrop, 1, 0, 0, 'out', 1));
    if (onCommitCard) steps.push(call(FADE, onCommitCard));
    steps.push(call(FADE, settle));
    return { name: 'reach', steps };
  }

  // 0-1100: the leg to this waypoint draws in ink (the pen), the cover following it.
  beat(steps, r.routeAt, onBeat, 'ink');
  steps.push(tween(anim.revealArc, endArc, r.routeAt, r.route, 'inOut'));
  steps.push(tween(anim.coverArc, endArc, r.routeAt, r.route, 'inOut'));
  // 1000: the marker fills and pops, with the one note and Light haptic; the ring pulses out.
  steps.push(call(r.stampAt, stampOn));
  settledBeat(steps, r.stampAt, onBeat, 'note');
  steps.push(tween(anim.stamp, 1, r.stampAt, r.stamp, 'inOut', 0));
  steps.push(tween(anim.pulse, 1, r.pulseAt, r.pulse, 'out', 0));
  // 1100-2300: the contours turn to ink around the marker (the cover rolls back into the next leg).
  steps.push(tween(anim.fog, r.fogBreathPeak, r.fogBreathAt, r.fogBreathUp, 'inOut', 0));
  steps.push(tween(anim.fog, 0, r.fogBreathDownAt, r.fogBreathDown, 'inOut', r.fogBreathPeak));
  steps.push(tween(anim.coverArc, coverTo, r.coverAt, r.cover, 'settle'));
  steps.push(tween(anim.revealArc, nextRevealArc, r.revealAt, r.reveal, 'inOut'));
  // 1700: the flag, camera and commit card move on to the next waypoint.
  steps.push(call(r.flagAt, advance));
  steps.push(tween(anim.flagDrop, 1, r.flagAt, r.flagDrop, 'out', 0));
  if (nextPoint) {
    steps.push(...cameraTo(anim, focusTarget(placement, nextIndex, r.scale), r.cameraAt, r.camera));
  }
  if (onCommitCard) steps.push(call(r.panelAt, onCommitCard));
  steps.push(call(r.settleAt, settle));
  return { name: 'reach', steps };
}

/* ------------------------------------------------------------------ */
/* Summit (S1): the destination is reached                              */
/* ------------------------------------------------------------------ */

/** The flag's slot past the last waypoint: the summit itself (ChartMapOverlay appends the summit to its flag table). */
export const summitFlagIndex = (placement: WaypointPlacement): number => placement.points.length;

export type SummitSequenceContext = {
  anim: ChartMapAnimState;
  placement: WaypointPlacement;
  table: RouteTable;
  /** The final waypoint (kept for symmetry with the reach; the summit has no stamp of its own). */
  index: number;
  reducedMotion: boolean;
  /** 0..1 grow of the cream completion panel (host-owned shared value). */
  panel?: SharedValue<number>;
  /** The flag has planted: the host keeps it on screen once the Chart is arrived. */
  onFlag?: () => void;
  /** The sheet gives way to the cream completion panel (host hides the sheet and mounts the panel). */
  onPanel?: () => void;
  /** The Chart is arrived: the host swaps its panel content and reports the reach. Idempotent. */
  onArrived?: () => void;
  /**
   * Sound/haptic beats. `ink` (the pen) and `hush` (the stillness) are transient. `summit` is the one Heavy haptic, the
   * thud and the chord at the flag: not transient, so a skipped scene still plays it, once.
   */
  onBeat?: ChartBeatHandler;
};

/**
 * Summit (S1). The final leg inks to the X, the Chart goes still, the flag plants (the one Heavy haptic, the thud and
 * the chord), a glow blooms, the Anchor's artwork opens in a circle where the X was, the contours turn to ink outward
 * from the X, and the cream panel takes the sheet's place. Reduce Motion: no travel, one short cross-fade to the settled
 * end state, and the haptic and chord still fire (they mark the commitment).
 */
export function summitSequence(ctx: SummitSequenceContext): SequenceSpec {
  const { anim, placement, table, reducedMotion, panel, onFlag, onPanel, onArrived, onBeat } = ctx;
  const s = T.summit;
  const steps: SequenceStep[] = [];
  const slot = summitFlagIndex(placement);

  const plant = () => {
    anim.flagIndex.value = slot;
    anim.flagOpacity.value = 1;
    onFlag?.();
  };
  const hideFlag = () => {
    // The flag leaves its waypoint; it plants again at the X.
    anim.flagOpacity.value = 0;
    anim.flagDrop.value = 0;
  };

  if (reducedMotion) {
    steps.push(call(0, hideFlag));
    steps.push(call(0, plant));
    settledBeat(steps, 0, onBeat, 'summit');
    steps.push(tween(anim.flagDrop, 1, 0, 0, 'out', 1));
    steps.push(tween(anim.revealArc, table.total, 0, 0));
    steps.push(tween(anim.coverArc, table.total, 0, 0));
    steps.push(...cameraTo(anim, overviewTarget(), 0, 0));
    steps.push(tween(anim.fog, 1, 0, FADE, 'linear'));
    steps.push(tween(anim.glyph, 1, 0, FADE, 'linear'));
    steps.push(tween(anim.goldDot, 1, 0, FADE, 'linear'));
    if (panel) steps.push(tween(panel, 1, 0, FADE, 'linear', 0));
    if (onPanel) steps.push(call(FADE, onPanel));
    if (onArrived) steps.push(call(FADE, onArrived));
    return { name: 'summit', steps };
  }

  // 0-1300: the final leg draws in ink to the X (the pen, with the air bed under it).
  steps.push(call(0, hideFlag));
  beat(steps, s.routeAt, onBeat, 'ink');
  steps.push(tween(anim.revealArc, table.total, s.routeAt, s.route, 'inOut'));
  steps.push(...cameraTo(anim, overviewTarget(), s.cameraAt, s.camera));
  // 1400-2000: stillness. Nothing sounds and nothing moves.
  beat(steps, s.stillAt, onBeat, 'hush');
  // 2000: the flag plants. The one Heavy haptic, the thud and the chord.
  steps.push(call(s.flagAt, plant));
  settledBeat(steps, s.flagAt, onBeat, 'summit');
  steps.push(tween(anim.flagDrop, 1, s.flagAt, s.flagDrop, 'out', 0));
  // 2200-3500: a soft glow blooms at the X. 2600-3500: the artwork opens in its circle where the X was.
  steps.push(tween(anim.goldDot, 1, s.glowAt, s.glow, 'inOut', 0));
  steps.push(tween(anim.glyph, 1, s.glyphAt, s.glyph, 'out', 0));
  // 3300-4900: the contours turn to ink outward from the X, across the whole map.
  steps.push(tween(anim.fog, 1, s.fogAt, s.fog, 'inOut', 0));
  steps.push(tween(anim.coverArc, table.total, s.fogAt, s.fog, 'inOut'));
  // 5500-6300: the sheet gives way and the cream completion panel grows in.
  if (panel) steps.push(tween(panel, 1, s.panelAt, s.panel, 'settle', 0));
  if (onPanel) steps.push(call(s.panelAt, onPanel));
  if (onArrived) steps.push(call(s.panelAt, onArrived));
  // The scene rests until here (the registered scene length).
  steps.push(call(s.settleAt, () => undefined));
  return { name: 'summit', steps };
}

/* ------------------------------------------------------------------ */
/* Route revised (R1): the pen draws the new route, then it settles into pencil */
/* ------------------------------------------------------------------ */

export type RouteRevisedSequenceContext = {
  anim: ChartMapAnimState;
  revision: ChartRouteRevision;
  reducedMotion: boolean;
  /** The new open waypoint that pops (a real marker), or null when the revision added none. */
  popIndex: number | null;
  /** The new waypoint appears: the host stops holding the revised markers back. Idempotent. */
  onPop?: () => void;
  /** Only `pop` is ever sent: one Light haptic, no sound at all. Not transient: a preempted scene still plays it, once. */
  onBeat?: ChartBeatHandler;
};

/**
 * Route revised (R1). A revision is a plan, not progress: the old pencil route fades, the new one is drawn once by the
 * pen in two halves and settles into pencil (never ink). Reduce Motion snaps to the settled pencil route with one short
 * cross-fade and still gives the one Light haptic.
 */
export function routeRevisedSequence(ctx: RouteRevisedSequenceContext): SequenceSpec {
  const { anim, revision, reducedMotion, popIndex, onPop, onBeat } = ctx;
  const r = T.routeRevised;
  const steps: SequenceStep[] = [];

  const settle = () => {
    revision.out.value = 1;
    revision.pen.value = 1;
    revision.pencil.value = 1;
    anim.stampIndex.value = -1;
  };
  const pop = () => {
    if (popIndex !== null) anim.stampIndex.value = popIndex;
    onPop?.();
  };

  if (reducedMotion) {
    steps.push(call(0, () => {
      revision.out.value = 1;
      revision.pen.value = 1;
      revision.pencil.value = 0;
    }));
    steps.push(call(0, pop));
    settledBeat(steps, 0, onBeat, 'pop');
    steps.push(tween(revision.pencil, 1, 0, FADE, 'linear', 0));
    steps.push(call(FADE, settle));
    return { name: 'routeRevised', steps };
  }

  steps.push(call(0, () => {
    revision.out.value = 0;
    revision.pen.value = 0;
    revision.pencil.value = 0;
  }));
  // 0-900: the old route fades.
  steps.push(tween(revision.out, 1, r.fadeAt, r.fade, 'inOut', 0));
  // 700-1800: the new route is drawn by the pen in two halves.
  steps.push(tween(revision.pen, 0.5, r.penAt, r.penHalf, 'linear', 0));
  steps.push(tween(revision.pen, 1, r.penAt + r.penHalf, r.penHalf, 'linear', 0.5));
  // 1800-2050: the new open waypoint appears (pop), with the one Light haptic.
  steps.push(call(r.popAt, pop));
  settledBeat(steps, r.popAt, onBeat, 'pop');
  if (popIndex !== null) steps.push(tween(anim.stamp, 1, r.popAt, r.pop, 'inOut', 0));
  // 2000-2500: the pen route settles into pencil.
  steps.push(tween(revision.pencil, 1, r.pencilAt, r.pencil, 'inOut', 0));
  // The scene rests until here.
  steps.push(call(r.settleAt, settle));
  return { name: 'routeRevised', steps };
}
