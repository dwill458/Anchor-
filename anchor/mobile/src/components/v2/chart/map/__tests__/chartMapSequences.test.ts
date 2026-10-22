import { CHART_MAP_REDUCED_FADE, CHART_MAP_TIMING } from '../../chartMotion';
import { PROGRESS_CAP, type ChartMapAnimState, type SequenceStep } from '../chartMapContracts';
import { buildRouteTable, cameraTargetFor, OVERVIEW_CAMERA, waypointPlacement } from '../chartMapGeometry';
import { overviewTarget } from '../useChartMapCamera';
import {
  laterSequence,
  moveCheckSequence,
  moveHoldArc,
  moveHoldSequence,
  openSequence,
  reachCoverArc,
  reachSequence,
  routeRevisedSequence,
  sequenceDuration,
  summitFlagIndex,
  summitSequence,
  waypointTapSequence,
  type ChartBeat,
} from '../chartMapSequences';

const sv = (value = 0) => ({ value }) as any;
const makeAnim = () => {
  const anim = {
    camera: { cx: sv(426), cy: sv(590), s: sv(1) },
    revealArc: sv(), fog: sv(), mapOpacity: sv(), flagIndex: sv(-1), flagDrop: sv(), flagOpacity: sv(),
    pulse: sv(1), stampIndex: sv(-1), stamp: sv(), glyph: sv(), goldDot: sv(), coverArc: sv(), closed: sv(),
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
/** Beats in `at` order (declaration order breaks ties), as [at, beat]. */
const beatsOf = (build: (onBeat: (b: ChartBeat) => void) => { steps: SequenceStep[] }) => {
  const seen: ChartBeat[] = [];
  const spec = build((b) => seen.push(b));
  const out: Array<[number, ChartBeat]> = [];
  calls(spec.steps)
    .filter((s) => (s as any).transient)
    .sort((a, b) => a.at - b.at)
    .forEach((s) => {
      seen.length = 0;
      (s as any).run();
      out.push([s.at, seen[0]]);
    });
  return out;
};

describe('openSequence', () => {
  it('first open of the day: clouds part, camera eases back, pen draws, flag drops, panel at 1200', () => {
    const anim = makeAnim();
    const onPanel = jest.fn();
    const spec = openSequence({ anim, placement, revealTo: 1234, currentIndex: 2, reducedMotion: false, onPanel });
    expect(spec.name).toBe('open');
    // Frame one: full cover, nothing drawn, pushed-in camera.
    (calls(spec.steps).find((s) => s.at === 0) as any).run();
    expect(anim.closed.value).toBe(1);
    expect(anim.coverArc.value).toBe(0);
    expect(anim.revealArc.value).toBe(0);
    expect(anim.mapOpacity.value).toBe(1);
    expect(anim.flagOpacity.value).toBe(0);
    // cy 560 (was 650): keeps the summit clear of the header on the first frame.
    expect([anim.camera.cx.value, anim.camera.cy.value, anim.camera.s.value]).toEqual([405, 560, 1.08]);
    expect(forTarget(spec.steps, anim.closed)[0]).toMatchObject({ at: 0, duration: 520, from: 1, to: 0, easing: 'settle' });
    expect(forTarget(spec.steps, anim.coverArc)[0]).toMatchObject({ at: 0, duration: 720, from: 0, to: 1234, easing: 'settle' });
    expect(forTarget(spec.steps, anim.camera.s)[0]).toMatchObject({ at: 0, duration: 900, to: 1, easing: 'deliberate' });
    const target = overviewTarget();
    expect(forTarget(spec.steps, anim.camera.cx)[0].to).toBe(target.cx);
    expect(forTarget(spec.steps, anim.camera.cy)[0].to).toBe(target.cy);
    expect(forTarget(spec.steps, anim.revealArc)[0]).toMatchObject({ at: 250, duration: 850, from: 0, to: 1234, easing: 'draw' });
    expect(forTarget(spec.steps, anim.flagDrop)[0]).toMatchObject({ at: 1000, duration: 250, easing: 'out', to: 1, from: 0 });
    // The open never fades the map in: the weather is the reveal.
    expect(forTarget(spec.steps, anim.mapOpacity)).toHaveLength(0);
    const panel = calls(spec.steps).find((s) => s.at === 1200) as any;
    expect(panel).toBeDefined();
    panel.run();
    panel.run();
    expect(onPanel).toHaveBeenCalledTimes(2);
  });

  it('beats: open at 0, ink at 250, flag at 1000, all transient', () => {
    const anim = makeAnim();
    expect(beatsOf((onBeat) => openSequence({ anim, placement, revealTo: 600, currentIndex: 1, reducedMotion: false, onBeat })))
      .toEqual([[0, 'open'], [250, 'ink'], [1000, 'flag']]);
  });

  it('places the flag idempotently', () => {
    const anim = makeAnim();
    const spec = openSequence({ anim, placement, revealTo: 100, currentIndex: 1, reducedMotion: false });
    const flag = calls(spec.steps).find((s) => s.at === 1000 && !(s as any).transient) as any;
    flag.run();
    flag.run();
    expect(anim.flagIndex.value).toBe(1);
    expect(anim.flagOpacity.value).toBe(1);
  });

  it('has no flag drop, flag beat or camera move when the chart has no current waypoint', () => {
    const anim = makeAnim();
    const spec = openSequence({ anim, placement, revealTo: table.total, currentIndex: -1, reducedMotion: false });
    expect(cameraSteps(anim, spec.steps)).toHaveLength(0);
    expect(forTarget(spec.steps, anim.flagDrop)).toHaveLength(0);
    (calls(spec.steps).find((s) => s.at === 0) as any).run();
    expect(anim.camera.s.value).toBe(1);
    expect(beatsOf((onBeat) => openSequence({ anim, placement, revealTo: 10, currentIndex: -1, reducedMotion: false, onBeat })).map(([, b]) => b))
      .toEqual(['open', 'ink']);
  });

  it('reduced motion: settled clouds, drawn route, a short crossfade, no beats, panel after the fade', () => {
    const anim = makeAnim();
    const spec = openSequence({ anim, placement, revealTo: 500, currentIndex: 2, reducedMotion: true, onPanel: jest.fn(), onBeat: jest.fn() });
    expect(cameraSteps(anim, spec.steps)).toHaveLength(0);
    expect(Math.max(...tweens(spec.steps).map((s) => s.duration))).toBe(CHART_MAP_REDUCED_FADE);
    expect(forTarget(spec.steps, anim.revealArc)[0].duration).toBe(0);
    expect(forTarget(spec.steps, anim.coverArc)[0]).toMatchObject({ duration: 0, to: 500 });
    expect(calls(spec.steps).some((s) => (s as any).transient)).toBe(false);
    runAll(spec.steps);
    expect(anim.closed.value).toBe(0);
    expect(calls(spec.steps).some((s) => s.at === CHART_MAP_REDUCED_FADE)).toBe(true);
    expect(sequenceDuration(spec)).toBeLessThanOrEqual(CHART_MAP_REDUCED_FADE);
  });
});

describe('laterSequence', () => {
  it('sets every final state at 0, breathes the weather once and peeks the panel at 300, with no beats', () => {
    const anim = makeAnim();
    anim.closed.value = 1;
    const onPanel = jest.fn();
    const spec = laterSequence({ anim, placement, revealTo: 700, currentIndex: 2, reducedMotion: false, onPanel, onBeat: jest.fn() });
    expect(spec.name).toBe('later');
    (calls(spec.steps).find((s) => s.at === 0) as any).run();
    expect(anim.revealArc.value).toBe(700);
    expect(anim.coverArc.value).toBe(700);
    expect(anim.closed.value).toBe(0);
    expect(anim.flagIndex.value).toBe(2);
    expect(anim.flagDrop.value).toBe(1);
    expect(anim.camera.s.value).toBe(1);
    const fog = forTarget(spec.steps, anim.fog);
    expect(fog[0]).toMatchObject({ at: 0, duration: 1200, from: 0, to: 0.03, easing: 'inOut' });
    expect(fog[1]).toMatchObject({ at: 1200, duration: 1200, from: 0.03, to: 0, easing: 'inOut' });
    expect(calls(spec.steps).some((s) => s.at === 300)).toBe(true);
    expect(calls(spec.steps).some((s) => (s as any).transient)).toBe(false);
    expect(cameraSteps(anim, spec.steps)).toHaveLength(0);
    expect(forTarget(spec.steps, anim.revealArc)).toHaveLength(0);
  });

  it('a finished Chart keeps its lifted fog: no breath', () => {
    const anim = makeAnim();
    const spec = laterSequence({ anim, placement, revealTo: table.total, currentIndex: -1, reducedMotion: false });
    expect(forTarget(spec.steps, anim.fog)).toHaveLength(0);
  });

  it('reduced motion: no breath, panel at 120', () => {
    const anim = makeAnim();
    const spec = laterSequence({ anim, placement, revealTo: 700, currentIndex: 2, reducedMotion: true, onPanel: jest.fn() });
    expect(tweens(spec.steps)).toHaveLength(0);
    expect(calls(spec.steps).some((s) => s.at === 120)).toBe(true);
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

  it('rolls the cloud cover back with the tip, and only forward', () => {
    const anim = makeAnim();
    anim.coverArc.value = 100;
    const spec = moveCheckSequence({ anim, fromArc: 100, toArc: 160, reducedMotion: false });
    expect(forTarget(spec.steps, anim.coverArc)[0]).toMatchObject({ at: 120, duration: 600, to: 160, easing: 'settle' });
    // After a reach the cover already sits past the new tip: it never closes back in.
    anim.coverArc.value = 400;
    expect(forTarget(moveCheckSequence({ anim, fromArc: 100, toArc: 160, reducedMotion: false }).steps, anim.coverArc)).toHaveLength(0);
  });

  it('beats: check at 0, ink at 200 when the route extends; check only when it does not', () => {
    const anim = makeAnim();
    expect(beatsOf((onBeat) => moveCheckSequence({ anim, fromArc: 100, toArc: 160, reducedMotion: false, onBeat })))
      .toEqual([[0, 'check'], [200, 'ink']]);
    expect(beatsOf((onBeat) => moveCheckSequence({ anim, fromArc: 100, toArc: 100, reducedMotion: false, onBeat })))
      .toEqual([[0, 'check']]);
    expect(beatsOf((onBeat) => moveCheckSequence({ anim, fromArc: 100, toArc: 160, reducedMotion: true, onBeat })))
      .toEqual([[0, 'check']]);
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

describe('moveHoldSequence (One Move done, M1)', () => {
  const leg = placement.legs[2];
  const hold = leg.start + 0.9 * (leg.end - leg.start);
  const build = (over: Partial<Parameters<typeof moveHoldSequence>[0]> = {}) => {
    const anim = makeAnim();
    anim.revealArc.value = leg.start;
    const onDayClosed = jest.fn();
    const spec = moveHoldSequence({ anim, placement, legIndex: 2, reducedMotion: false, onDayClosed, ...over });
    return { anim, spec, onDayClosed };
  };

  it('holds at 90% of the leg: the hold arc is leg.start + 0.9 * length, and PROGRESS_CAP agrees', () => {
    expect(moveHoldArc(placement, 2)).toBeCloseTo(hold);
    expect(moveHoldArc(placement, 99)).toBeNull();
    expect(CHART_MAP_TIMING.moveHold.holdFraction).toBe(PROGRESS_CAP);
  });

  it('inks the current leg from its start to the hold over 1200ms starting at 500, with the pen cue', () => {
    const { anim, spec } = build();
    expect(forTarget(spec.steps, anim.revealArc)).toHaveLength(1);
    expect(forTarget(spec.steps, anim.revealArc)[0]).toMatchObject({ at: 500, duration: 1200, from: leg.start, easing: 'inOut' });
    expect(forTarget(spec.steps, anim.revealArc)[0].to).toBeCloseTo(hold);
    expect(forTarget(spec.steps, anim.coverArc)[0]).toMatchObject({ at: 500, duration: 1200 });
    const seen: ChartBeat[] = [];
    const withBeats = moveHoldSequence({ anim: makeAnim(), placement, legIndex: 2, reducedMotion: false, fromArc: leg.start, onBeat: (b) => seen.push(b) });
    expect(calls(withBeats.steps).filter((s) => (s as any).transient).map((s) => s.at).sort((a, b) => a - b)).toEqual([0, CHART_MAP_TIMING.moveHold.routeAt, CHART_MAP_TIMING.moveHold.routeAt + CHART_MAP_TIMING.moveHold.route]);
  });

  it('never goes past the 90% hold, never fills the waypoint, and never retreats', () => {
    const past = build({ toArc: leg.end });
    expect(forTarget(past.spec.steps, past.anim.revealArc)[0].to).toBeCloseTo(hold);
    expect(forTarget(past.spec.steps, past.anim.revealArc)[0].to).toBeLessThan(leg.end);
    // Real progress below the hold is honoured (a leg with more moves left).
    const part = build({ toArc: leg.start + 0.3 * (leg.end - leg.start) });
    expect(forTarget(part.spec.steps, part.anim.revealArc)[0].to).toBeCloseTo(leg.start + 0.3 * (leg.end - leg.start));
    // A tip already at or past the hold draws nothing (the route never retreats, never overshoots).
    const atHold = build({ fromArc: hold });
    expect(forTarget(atHold.spec.steps, atHold.anim.revealArc)).toHaveLength(0);
    // The scene touches no marker state: no stamp, no flag move.
    const touched = new Set(tweens(past.spec.steps).map((s) => s.target));
    expect(touched.has(past.anim.stamp)).toBe(false);
    expect(touched.has(past.anim.flagIndex)).toBe(false);
    runAll(past.spec.steps);
    expect(past.anim.stampIndex.value).toBe(-1);
    expect(past.anim.flagIndex.value).toBe(-1);
  });

  it('closes the day after the toast has gone out (2200) and rests until 2500', () => {
    const { spec, onDayClosed } = build();
    expect(sequenceDuration(spec)).toBe(2500);
    (calls(spec.steps).find((s) => s.at === 2200) as any).run();
    expect(onDayClosed).toHaveBeenCalledTimes(1);
  });

  it('reduced motion: ink is set with no travel and no pulse; the check cue stays', () => {
    const anim = makeAnim();
    anim.revealArc.value = leg.start;
    const seen: Array<[number, ChartBeat]> = [];
    const spec = moveHoldSequence({ anim, placement, legIndex: 2, reducedMotion: true, onBeat: (b) => seen.push([0, b]) });
    expect(forTarget(spec.steps, anim.revealArc)[0].duration).toBe(0);
    expect(forTarget(spec.steps, anim.pulse)).toHaveLength(0);
    calls(spec.steps).filter((s) => (s as any).transient).forEach((s) => (s as any).run());
    expect(seen.map(([, b]) => b)).toEqual(['check']);
  });

  it('a Chart with no current leg inks nothing', () => {
    const anim = makeAnim();
    const spec = moveHoldSequence({ anim, placement, legIndex: -1, reducedMotion: false });
    expect(forTarget(spec.steps, anim.revealArc)).toHaveLength(0);
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

  it('uses the W1 timeline: leg inks 0-1100, marker fills at 1000, ring 1000-2100, contours 1100-2300, next step at 1700', () => {
    const { anim, spec } = build();
    expect(forTarget(spec.steps, anim.stamp)[0]).toMatchObject({ at: 1000, duration: 400 });
    const reveal = forTarget(spec.steps, anim.revealArc);
    expect(reveal[0]).toMatchObject({ at: 0, duration: 1100, to: placement.arcs[1] });
    expect(reveal[1]).toMatchObject({ at: 1100, duration: 600, to: placement.arcs[1] + 40 });
    // The two reveal tweens on the same value never overlap.
    expect(reveal[0].at + reveal[0].duration).toBeLessThanOrEqual(reveal[1].at);
    expect(forTarget(spec.steps, anim.pulse)[0]).toMatchObject({ at: 1000, duration: 1100, easing: 'out' });
    const fog = forTarget(spec.steps, anim.fog);
    expect(fog[0]).toMatchObject({ at: 1100, duration: 350, to: 0.02 });
    expect(fog[1]).toMatchObject({ at: 1450, duration: 350, to: 0 });
    expect(forTarget(spec.steps, anim.flagDrop)[0]).toMatchObject({ at: 1700, duration: 250, easing: 'out' });
    expect(forTarget(spec.steps, anim.camera.s)[0]).toMatchObject({ at: 1700, duration: 500, to: 1.45 });
    expect(calls(spec.steps).some((s) => s.at === 1700)).toBe(true);
  });

  it('rolls the cloud cover 30% into the next leg after the ink reaches the waypoint', () => {
    const { anim, spec } = build();
    const cover = forTarget(spec.steps, anim.coverArc);
    expect(cover[0]).toMatchObject({ at: 0, duration: 1100, to: placement.arcs[1] });
    const next = placement.legs[2];
    const lead = placement.arcs[1] + 0.3 * (next.end - next.start);
    expect(cover[1]).toMatchObject({ at: 1100, duration: 1200, easing: 'settle' });
    expect(cover[1].to).toBeCloseTo(Math.max(placement.arcs[1] + 40, lead));
    expect(cover[0].at + cover[0].duration).toBeLessThanOrEqual(cover[1].at);
    // Never behind the ink.
    expect(reachCoverArc(placement, 1, placement.arcs[1], placement.arcs[1] + 5000)).toBe(placement.arcs[1] + 5000);
  });

  /** Every beat in `at` order with its transient flag. */
  const allBeats = (reducedMotion: boolean) => {
    const anim = makeAnim();
    const seen: ChartBeat[] = [];
    const spec = reachSequence({
      anim, placement, index: 1, endArc: placement.arcs[1], nextRevealArc: placement.arcs[1] + 40, reducedMotion, onBeat: (b) => seen.push(b),
    });
    return calls(spec.steps)
      .map((s) => {
        seen.length = 0;
        (s as any).run();
        return seen[0] ? ([s.at, seen[0], Boolean((s as any).transient)] as const) : null;
      })
      .filter((entry): entry is readonly [number, ChartBeat, boolean] => entry !== null)
      .sort((a, b) => a[0] - b[0]);
  };

  it('beats: the pen at 0 and exactly one note at the marker fill (no stamp, wind or flag cue)', () => {
    expect(allBeats(false)).toEqual([[0, 'ink', true], [1000, 'note', false]]);
    // Reduce Motion keeps the note (it marks the commitment) and drops the pen, which belongs to the motion.
    expect(allBeats(true)).toEqual([[0, 'note', false]]);
  });

  it('the note is not transient, so a skipped scene still plays it once; a normal run plays it once', () => {
    const anim = makeAnim();
    const onBeat = jest.fn();
    const spec = reachSequence({
      anim, placement, index: 1, endArc: placement.arcs[1], nextRevealArc: placement.arcs[1] + 40, reducedMotion: false, onBeat,
    });
    // The sequencer's skip runs every non-transient call once and drops transient beats (see chartSequence.ts).
    calls(spec.steps).filter((s) => !(s as any).transient).forEach((s) => (s as any).run());
    expect(onBeat.mock.calls.map(([b]) => b)).toEqual(['note']);
  });

  it('is 3.2s with the rest, tells the host when the marker fills, and aims the camera at the next waypoint', () => {
    const anim = makeAnim();
    const onStamp = jest.fn();
    const spec = reachSequence({
      anim, placement, index: 1, endArc: placement.arcs[1], nextRevealArc: placement.arcs[1] + 40, reducedMotion: false, onStamp,
    });
    expect(sequenceDuration(spec)).toBe(3200);
    expect(sequenceDuration(spec)).toBe(CHART_MAP_TIMING.reach.settleAt);
    runAll(spec.steps);
    expect(onStamp).toHaveBeenCalledTimes(1);
    expect(anim.stampIndex.value).toBe(-1);
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

describe('summitSequence (S1)', () => {
  const build = (reducedMotion = false) => {
    const anim = makeAnim();
    const panel = sv();
    const onFlag = jest.fn();
    const onPanel = jest.fn();
    const onArrived = jest.fn();
    const beats: ChartBeat[] = [];
    const spec = summitSequence({ anim, placement, table, index: 4, reducedMotion, panel, onFlag, onPanel, onArrived, onBeat: (b) => beats.push(b) });
    return { anim, panel, spec, onFlag, onPanel, onArrived, beats };
  };
  const at = (steps: SequenceStep[], ms: number) => calls(steps).filter((s) => s.at === ms) as any[];

  it('follows the S1 timeline: pen 0-1300, still 1400-2000, flag 2000, glow 2200-3500, artwork 2600-3500, contours 3300-4900, panel 5500-6300, rest to 7600', () => {
    const { anim, panel, spec } = build();
    expect(spec.name).toBe('summit');
    expect(forTarget(spec.steps, anim.revealArc)[0]).toMatchObject({ at: 0, duration: 1300, to: table.total });
    expect(forTarget(spec.steps, anim.camera.s)[0]).toMatchObject({ at: 100, duration: 900, to: 1 });
    expect(forTarget(spec.steps, anim.flagDrop)[0]).toMatchObject({ at: 2000, duration: 280, from: 0, to: 1, easing: 'out' });
    expect(forTarget(spec.steps, anim.goldDot)[0]).toMatchObject({ at: 2200, duration: 1300, to: 1 });
    expect(forTarget(spec.steps, anim.glyph)[0]).toMatchObject({ at: 2600, duration: 900, to: 1 });
    expect(forTarget(spec.steps, anim.fog)[0]).toMatchObject({ at: 3300, duration: 1600, to: 1 });
    expect(forTarget(spec.steps, anim.coverArc)[0]).toMatchObject({ at: 3300, duration: 1600, to: table.total });
    expect(forTarget(spec.steps, panel)[0]).toMatchObject({ at: 5500, duration: 800, to: 1 });
    expect(at(spec.steps, 5500).length).toBeGreaterThanOrEqual(2);
    expect(sequenceDuration(spec)).toBe(CHART_MAP_TIMING.summit.settleAt);
    expect(CHART_MAP_TIMING.summit.settleAt).toBe(7600);
    // Nothing draws or moves in the stillness (1400-2000).
    const moving = tweens(spec.steps).filter((s) => s.at < 2000 && s.at + s.duration > 1400);
    expect(moving).toHaveLength(0);
  });

  it('exactly one Heavy-bearing beat, at the flag, and it is not transient (a skip still plays it once); ink and hush are transient', () => {
    const { spec, beats } = build();
    const summary: Array<[number, ChartBeat, boolean]> = [];
    calls(spec.steps).forEach((s) => {
      beats.length = 0;
      (s as any).run();
      if (beats.length) summary.push([s.at, beats[0], Boolean((s as any).transient)]);
    });
    expect(summary).toEqual([[0, 'ink', true], [1400, 'hush', true], [2000, 'summit', false]]);
    expect(summary.filter(([, beat]) => beat === 'summit')).toHaveLength(1);
    expect(summary.some(([, beat]) => beat === 'stamp' || beat === 'note' || beat === 'wind')).toBe(false);
  });

  it('a skip (non-transient calls only) plays the summit beat once and plants the flag at the summit slot', () => {
    const { anim, spec, beats, onFlag, onPanel, onArrived } = build();
    calls(spec.steps).filter((s) => !(s as any).transient).forEach((s) => (s as any).run());
    expect(beats).toEqual(['summit']);
    expect(anim.flagIndex.value).toBe(placement.points.length);
    expect(anim.flagIndex.value).toBe(summitFlagIndex(placement));
    expect(anim.flagOpacity.value).toBe(1);
    expect(onFlag).toHaveBeenCalledTimes(1);
    expect(onPanel).toHaveBeenCalledTimes(1);
    expect(onArrived).toHaveBeenCalledTimes(1);
  });

  it('the flag leaves its waypoint at 0 and drops from nothing at the summit', () => {
    const { anim, spec } = build();
    anim.flagOpacity.value = 1;
    anim.flagDrop.value = 1;
    (at(spec.steps, 0)[0] as any).run();
    expect(anim.flagOpacity.value).toBe(0);
    expect(anim.flagDrop.value).toBe(0);
  });

  it('Reduce Motion: no travel, one short cross-fade, and the haptic beat still fires once (no ink, no hush)', () => {
    const { anim, panel, spec, beats, onArrived, onPanel } = build(true);
    expect(sequenceDuration(spec)).toBeLessThanOrEqual(CHART_MAP_REDUCED_FADE);
    expect(Math.max(...tweens(spec.steps).map((s) => s.duration))).toBeLessThanOrEqual(CHART_MAP_REDUCED_FADE);
    expect(cameraSteps(anim, spec.steps).every((s) => s.duration === 0)).toBe(true);
    expect(forTarget(spec.steps, anim.revealArc)[0]).toMatchObject({ duration: 0, to: table.total });
    expect(forTarget(spec.steps, panel)[0]).toMatchObject({ duration: CHART_MAP_REDUCED_FADE, to: 1 });
    expect(calls(spec.steps).some((s) => (s as any).transient)).toBe(false);
    runAll(spec.steps);
    expect(beats).toEqual(['summit']);
    expect(onPanel).toHaveBeenCalledTimes(1);
    expect(onArrived).toHaveBeenCalledTimes(1);
    expect(anim.flagIndex.value).toBe(placement.points.length);
  });
});

describe('routeRevisedSequence (R1)', () => {
  const makeRevision = () => ({ out: sv(1), pen: sv(1), pencil: sv(1) });
  const build = (reducedMotion = false, popIndex: number | null = 2) => {
    const anim = makeAnim();
    const revision = makeRevision();
    const onPop = jest.fn();
    const beats: ChartBeat[] = [];
    const spec = routeRevisedSequence({ anim, revision: revision as any, reducedMotion, popIndex, onPop, onBeat: (b) => beats.push(b) });
    return { anim, revision, spec, onPop, beats };
  };

  it('follows the R1 timeline: old route fades 0-900, pen in two halves 700-1800, pop 1800-2050, pencil 2000-2500, rests to 3200', () => {
    const { anim, revision, spec } = build();
    expect(spec.name).toBe('routeRevised');
    expect(forTarget(spec.steps, revision.out)[0]).toMatchObject({ at: 0, duration: 900, to: 1 });
    const pen = forTarget(spec.steps, revision.pen);
    expect(pen).toHaveLength(2);
    expect(pen[0]).toMatchObject({ at: 700, duration: 550, from: 0, to: 0.5 });
    expect(pen[1]).toMatchObject({ at: 1250, duration: 550, from: 0.5, to: 1 });
    expect(pen[0].at + pen[0].duration).toBeLessThanOrEqual(pen[1].at);
    expect(forTarget(spec.steps, anim.stamp)[0]).toMatchObject({ at: 1800, duration: 250 });
    expect(forTarget(spec.steps, revision.pencil)[0]).toMatchObject({ at: 2000, duration: 500, to: 1 });
    expect(sequenceDuration(spec)).toBe(CHART_MAP_TIMING.routeRevised.settleAt);
    expect(CHART_MAP_TIMING.routeRevised.registeredMs).toBe(2500);
  });

  it('has exactly one beat, pop, at 1800, not transient; no ink, flag, note or any sound beat', () => {
    const { spec, beats } = build();
    const fired: Array<[number, ChartBeat, boolean]> = [];
    calls(spec.steps).forEach((s) => {
      beats.length = 0;
      (s as any).run();
      if (beats.length) fired.push([s.at, beats[0], Boolean((s as any).transient)]);
    });
    expect(fired).toEqual([[1800, 'pop', false]]);
  });

  it('resets to nothing drawn at 0 and rests at the settled pencil route', () => {
    const { anim, revision, spec } = build();
    (calls(spec.steps).find((s) => s.at === 0) as any).run();
    expect([revision.out.value, revision.pen.value, revision.pencil.value]).toEqual([0, 0, 0]);
    runAll(spec.steps);
    expect([revision.out.value, revision.pen.value, revision.pencil.value]).toEqual([1, 1, 1]);
    expect(anim.stampIndex.value).toBe(-1);
  });

  it('pops the new waypoint only when there is one', () => {
    const withPop = build(false, 3);
    expect(forTarget(withPop.spec.steps, withPop.anim.stamp)).toHaveLength(1);
    const without = build(false, null);
    expect(forTarget(without.spec.steps, without.anim.stamp)).toHaveLength(0);
  });

  it('Reduce Motion: snaps to the settled pencil route with one short cross-fade and still gives the one pop beat', () => {
    const { revision, spec, beats, onPop } = build(true);
    expect(sequenceDuration(spec)).toBeLessThanOrEqual(CHART_MAP_REDUCED_FADE);
    expect(forTarget(spec.steps, revision.pencil)[0]).toMatchObject({ at: 0, duration: CHART_MAP_REDUCED_FADE, from: 0, to: 1 });
    expect(forTarget(spec.steps, revision.pen)).toHaveLength(0);
    runAll(spec.steps);
    expect(beats).toEqual(['pop']);
    expect(onPop).toHaveBeenCalledTimes(1);
    expect([revision.out.value, revision.pen.value, revision.pencil.value]).toEqual([1, 1, 1]);
  });
});
