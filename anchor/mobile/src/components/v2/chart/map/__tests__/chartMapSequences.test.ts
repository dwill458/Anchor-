import { CHART_MAP_REDUCED_FADE, CHART_MAP_TIMING } from '../../chartMotion';
import type { ChartMapAnimState, SequenceStep } from '../chartMapContracts';
import { buildRouteTable, cameraTargetFor, OVERVIEW_CAMERA, waypointPlacement } from '../chartMapGeometry';
import { overviewTarget } from '../useChartMapCamera';
import {
  arrivalSequence,
  moveCheckSequence,
  openSequence,
  reachSequence,
  sequenceDuration,
  waypointTapSequence,
} from '../chartMapSequences';

const sv = (value = 0) => ({ value }) as any;
const makeAnim = () => {
  const anim = {
    camera: { cx: sv(426), cy: sv(590), s: sv(1) },
    revealArc: sv(), fog: sv(), mapOpacity: sv(), flagIndex: sv(-1), flagDrop: sv(), flagOpacity: sv(),
    pulse: sv(1), stampIndex: sv(-1), stamp: sv(), glyph: sv(), goldDot: sv(),
  };
  return anim as unknown as ChartMapAnimState;
};

const placement = waypointPlacement(5);
const table = buildRouteTable();
type Tween = Extract<SequenceStep, { kind: 'tween' }>;
const tweens = (steps: SequenceStep[]) => steps.filter((s): s is Tween => s.kind === 'tween');
const calls = (steps: SequenceStep[]) => steps.filter((s) => s.kind === 'call');
const forTarget = (steps: SequenceStep[], target: unknown) => tweens(steps).filter((s) => s.target === target);
const cameraSteps = (anim: ChartMapAnimState, steps: SequenceStep[]) =>
  tweens(steps).filter((s) => [anim.camera.cx, anim.camera.cy, anim.camera.s].includes(s.target));
const runAll = (steps: SequenceStep[]) => calls(steps).forEach((s) => (s as any).run());

describe('openSequence', () => {
  it('matches the section 10 offsets', () => {
    const anim = makeAnim();
    const onPanel = jest.fn();
    const spec = openSequence({ anim, placement, revealTo: 1234, currentIndex: 2, reducedMotion: false, onPanel });
    expect(spec.name).toBe('open');
    expect(forTarget(spec.steps, anim.mapOpacity)[0]).toMatchObject({ at: 0, duration: 300, to: 1 });
    expect(forTarget(spec.steps, anim.revealArc)[0]).toMatchObject({ at: 300, duration: 700, to: 1234, easing: 'inOut' });
    expect(forTarget(spec.steps, anim.flagDrop)[0]).toMatchObject({ at: 1000, duration: 250, easing: 'out', to: 1, from: 0 });
    expect(forTarget(spec.steps, anim.camera.s)[0]).toMatchObject({ at: 1000, duration: 450, to: 1 });
    const target = overviewTarget();
    expect(forTarget(spec.steps, anim.camera.cx)[0].to).toBe(target.cx);
    expect(forTarget(spec.steps, anim.camera.cy)[0].to).toBe(target.cy);
    const panel = calls(spec.steps).find((s) => s.at === 1250) as any;
    expect(panel).toBeDefined();
    panel.run();
    panel.run();
    expect(onPanel).toHaveBeenCalledTimes(2);
  });

  it('places the flag idempotently', () => {
    const anim = makeAnim();
    const spec = openSequence({ anim, placement, revealTo: 100, currentIndex: 1, reducedMotion: false });
    const flag = calls(spec.steps).find((s) => s.at === 1000) as any;
    flag.run();
    flag.run();
    expect(anim.flagIndex.value).toBe(1);
    expect(anim.flagOpacity.value).toBe(1);
  });

  it('has no flag drop or camera when the chart has no current waypoint', () => {
    const anim = makeAnim();
    const spec = openSequence({ anim, placement, revealTo: table.total, currentIndex: -1, reducedMotion: false });
    expect(cameraSteps(anim, spec.steps)).toHaveLength(0);
    expect(forTarget(spec.steps, anim.flagDrop)).toHaveLength(0);
  });

  it('reduced motion: no camera, only a short crossfade, panel after the fade', () => {
    const anim = makeAnim();
    const spec = openSequence({ anim, placement, revealTo: 500, currentIndex: 2, reducedMotion: true, onPanel: jest.fn() });
    expect(cameraSteps(anim, spec.steps)).toHaveLength(0);
    expect(Math.max(...tweens(spec.steps).map((s) => s.duration))).toBe(CHART_MAP_REDUCED_FADE);
    expect(forTarget(spec.steps, anim.revealArc)[0].duration).toBe(0);
    expect(calls(spec.steps).some((s) => s.at === CHART_MAP_REDUCED_FADE)).toBe(true);
    expect(sequenceDuration(spec)).toBeLessThanOrEqual(CHART_MAP_REDUCED_FADE);
  });
});

describe('moveCheckSequence', () => {
  it('extends the route, pulses and closes the day at 850', () => {
    const anim = makeAnim();
    const onDayClosed = jest.fn();
    const spec = moveCheckSequence({ anim, fromArc: 100, toArc: 160, reducedMotion: false, onDayClosed });
    expect(forTarget(spec.steps, anim.revealArc)[0]).toMatchObject({ at: 200, duration: 400, to: 160, from: 100 });
    expect(forTarget(spec.steps, anim.pulse)[0]).toMatchObject({ at: 200, duration: 650, easing: 'out', from: 0, to: 1 });
    const closed = calls(spec.steps).find((s) => s.at === 850) as any;
    closed.run();
    expect(onDayClosed).toHaveBeenCalledTimes(1);
  });

  it('does not extend the route when it did not move, but still pulses', () => {
    const anim = makeAnim();
    const spec = moveCheckSequence({ anim, fromArc: 100, toArc: 100.3, reducedMotion: false });
    expect(forTarget(spec.steps, anim.revealArc)).toHaveLength(0);
    expect(forTarget(spec.steps, anim.pulse)).toHaveLength(1);
  });

  it('reduced motion has no pulse', () => {
    const anim = makeAnim();
    const spec = moveCheckSequence({ anim, fromArc: 100, toArc: 160, reducedMotion: true, onDayClosed: jest.fn() });
    expect(forTarget(spec.steps, anim.pulse)).toHaveLength(0);
    expect(forTarget(spec.steps, anim.revealArc)[0].duration).toBe(0);
    expect(calls(spec.steps)).toHaveLength(1);
  });
});

describe('waypointTapSequence', () => {
  it('moves the camera to 1.45x on the marker in 350ms', () => {
    const anim = makeAnim();
    const spec = waypointTapSequence({ anim, point: placement.points[3], toOverview: false, reducedMotion: false });
    expect(forTarget(spec.steps, anim.camera.s)[0]).toMatchObject({ at: 0, duration: 350, to: 1.45 });
    expect(cameraSteps(anim, spec.steps)).toHaveLength(3);
  });

  it('returns to overview', () => {
    const anim = makeAnim();
    const spec = waypointTapSequence({ anim, point: null, toOverview: true, reducedMotion: false });
    expect(forTarget(spec.steps, anim.camera.cx)[0].to).toBe(OVERVIEW_CAMERA.cx);
    expect(forTarget(spec.steps, anim.camera.cy)[0].to).toBe(OVERVIEW_CAMERA.cy);
    expect(forTarget(spec.steps, anim.camera.s)[0].to).toBe(1);
  });

  it('reduced motion has no steps', () => {
    const anim = makeAnim();
    expect(waypointTapSequence({ anim, point: placement.points[0], toOverview: false, reducedMotion: true }).steps).toEqual([]);
  });
});

describe('reachSequence', () => {
  const build = (reducedMotion = false) => {
    const anim = makeAnim();
    const onAdvance = jest.fn();
    const onCommitCard = jest.fn();
    const spec = reachSequence({
      anim, placement, index: 1, endArc: placement.arcs[1], nextRevealArc: placement.arcs[1] + 40,
      reducedMotion, onAdvance, onCommitCard,
    });
    return { anim, spec, onAdvance, onCommitCard };
  };

  it('uses the section 10 offsets', () => {
    const { anim, spec } = build();
    expect(forTarget(spec.steps, anim.stamp)[0]).toMatchObject({ at: 0, duration: 300 });
    const reveal = forTarget(spec.steps, anim.revealArc);
    expect(reveal[0]).toMatchObject({ at: 150, to: placement.arcs[1] });
    expect(reveal[1]).toMatchObject({ at: 500, duration: 600, to: placement.arcs[1] + 40 });
    // The two reveal tweens on the same value never overlap.
    expect(reveal[0].at + reveal[0].duration).toBeLessThanOrEqual(reveal[1].at);
    expect(forTarget(spec.steps, anim.pulse)[0]).toMatchObject({ at: 500, duration: 650, easing: 'out' });
    const fog = forTarget(spec.steps, anim.fog);
    expect(fog[0]).toMatchObject({ at: 500, duration: 350, to: 0.035 });
    expect(fog[1]).toMatchObject({ at: 850, duration: 350, to: 0 });
    expect(forTarget(spec.steps, anim.flagDrop)[0]).toMatchObject({ at: 900, duration: 250, easing: 'out' });
    expect(forTarget(spec.steps, anim.camera.s)[0]).toMatchObject({ at: 1200, duration: 500, to: 1.45 });
    expect(calls(spec.steps).some((s) => s.at === 900)).toBe(true);
    expect(calls(spec.steps).some((s) => s.at === 1500)).toBe(true);
  });

  it('is about 1.8s with the commit card fade, and aims the camera at the next waypoint', () => {
    const { anim, spec } = build();
    expect(sequenceDuration(spec)).toBe(1700);
    const t = cameraTargetFor(placement.points[2], 1.45);
    expect(forTarget(spec.steps, anim.camera.cx)[0].to).toBe(t.cx);
  });

  it('call steps are idempotent and leave clean rest state', () => {
    const { anim, spec, onAdvance, onCommitCard } = build();
    runAll(spec.steps);
    runAll(spec.steps);
    expect(onAdvance).toHaveBeenCalledTimes(2);
    expect(onCommitCard).toHaveBeenCalledTimes(2);
    expect(anim.flagIndex.value).toBe(2);
    expect(anim.stampIndex.value).toBe(-1);
    expect(anim.fog.value).toBe(0);
  });

  it('reduced motion: no camera, no pulse, no fog breath, jumps to the next reveal', () => {
    const { anim, spec, onCommitCard } = build(true);
    expect(cameraSteps(anim, spec.steps)).toHaveLength(0);
    expect(forTarget(spec.steps, anim.pulse)).toHaveLength(0);
    expect(forTarget(spec.steps, anim.fog)).toHaveLength(0);
    expect(forTarget(spec.steps, anim.revealArc)).toHaveLength(1);
    expect(forTarget(spec.steps, anim.revealArc)[0]).toMatchObject({ duration: 0, to: placement.arcs[1] + 40 });
    expect(sequenceDuration(spec)).toBeLessThanOrEqual(CHART_MAP_REDUCED_FADE);
    runAll(spec.steps);
    expect(onCommitCard).toHaveBeenCalledTimes(1);
  });
});

describe('arrivalSequence', () => {
  const build = (reducedMotion = false) => {
    const anim = makeAnim();
    const onArrived = jest.fn();
    const spec = arrivalSequence({ anim, placement, table, index: 4, reducedMotion, onArrived });
    return { anim, spec, onArrived };
  };

  it('uses the section 10 offsets', () => {
    const { anim, spec } = build();
    expect(forTarget(spec.steps, anim.stamp)[0]).toMatchObject({ at: 0, duration: 300 });
    expect(forTarget(spec.steps, anim.revealArc)[0]).toMatchObject({ at: 150, duration: 1200, to: table.total });
    expect(forTarget(spec.steps, anim.camera.s)[0]).toMatchObject({ at: 300, duration: 900, to: 1 });
    expect(forTarget(spec.steps, anim.fog)[0]).toMatchObject({ at: 800, duration: 1600, to: 1 });
    expect(forTarget(spec.steps, anim.glyph)[0]).toMatchObject({ at: 1400, duration: 500, to: 1 });
    expect(forTarget(spec.steps, anim.goldDot)[0]).toMatchObject({ at: 2300, duration: 500, to: 1 });
    expect(calls(spec.steps).some((s) => s.at === 3000)).toBe(true);
    // The arrival panel fade (~500ms) lands the whole sequence at ~3.5s.
    expect(sequenceDuration(spec)).toBe(3000);
  });

  it('hides the flag at 0 and clears the stamp; call steps are idempotent', () => {
    const { anim, spec, onArrived } = build();
    anim.flagOpacity.value = 1;
    runAll(spec.steps);
    runAll(spec.steps);
    expect(anim.flagOpacity.value).toBe(0);
    expect(anim.stampIndex.value).toBe(-1);
    expect(onArrived).toHaveBeenCalledTimes(2);
  });

  it('reduced motion: camera is set to overview instantly, crossfades only', () => {
    const { anim, spec, onArrived } = build(true);
    const cam = cameraSteps(anim, spec.steps);
    expect(cam).toHaveLength(3);
    expect(cam.every((s) => s.duration === 0)).toBe(true);
    expect(forTarget(spec.steps, anim.camera.s)[0].to).toBe(1);
    expect(Math.max(...tweens(spec.steps).map((s) => s.duration))).toBe(CHART_MAP_REDUCED_FADE);
    expect(sequenceDuration(spec)).toBeLessThanOrEqual(CHART_MAP_REDUCED_FADE);
    runAll(spec.steps);
    expect(onArrived).toHaveBeenCalledTimes(1);
  });
});
