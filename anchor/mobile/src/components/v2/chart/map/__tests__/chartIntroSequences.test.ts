import { CHART_INTRO_TIMING as T } from '../../chartMotion';
import { createSequenceRunner, type SequenceDriver } from '../chartSequence';
import type { SequenceStep } from '../chartMapContracts';
import {
  introFullSequence,
  introReducedSequence,
  introSkipSequence,
  introShortSequence,
  sequenceDuration,
  type IntroSequenceProgress,
} from '../chartMapSequences';
import { chartIntroBaseLayerStyle } from '../useChartMapCamera';

const makeProgress = (): IntroSequenceProgress => ({
  contour: { value: 0 } as any,
  tone: { value: 0 } as any,
  route: { value: 0 } as any,
  copy: { value: 0 } as any,
  marker: { value: 0 } as any,
  continue: { value: 0 } as any,
  land: { value: 0 } as any,
  cameraScale: { value: 0 } as any,
});
const tweens = (steps: SequenceStep[]) => steps.filter((s): s is Extract<SequenceStep, { kind: 'tween' }> => s.kind === 'tween');
const calls = (steps: SequenceStep[]) => steps.filter((s): s is Extract<SequenceStep, { kind: 'call' }> => s.kind === 'call');

function makeDriver(): SequenceDriver {
  return {
    startTween(target, from, _to, _duration, _easing, _onDone) {
      (target as any).value = from;
      return { cancel() {} };
    },
    setValue(target, value) { (target as any).value = value; },
    getValue(target) { return (target as any).value; },
    setTimer(ms, fn) { return { ms, fn }; },
    clearTimer() {},
  };
}

describe('Chart intro sequence specs', () => {
  it('keeps the static base camera aligned with the ink pass through entrance, crossfade, and early skip', () => {
    const width = 393;
    // While hidden, the native wrapper gets no per-frame camera transform.
    expect(chartIntroBaseLayerStyle(width, 1.1, 0)).toEqual({ opacity: 0 });
    expect(chartIntroBaseLayerStyle(width, 1.05, 0.01)).toEqual({
      opacity: 0.01,
      transform: [
        { translateX: 196.5 }, { scale: 1.05 }, { translateX: -196.5 },
      ],
    });
    // An early skip exposes base and ink with the same live camera value.
    expect(chartIntroBaseLayerStyle(width, 1.09, 0.08).transform).toEqual([
      { translateX: 196.5 }, { scale: 1.09 }, { translateX: -196.5 },
    ]);
    expect(chartIntroBaseLayerStyle(width, 1, 0.5).opacity).toBe(0.5);
    expect(chartIntroBaseLayerStyle(width, 1, 1)).toEqual({
      opacity: 1,
      transform: [{ translateX: 196.5 }, { scale: 1 }, { translateX: -196.5 }],
    });
  });

  it('full spec follows the opening beat table and runs the route start marker before its transient sound', () => {
    const progress = makeProgress();
    const spec = introFullSequence({ progress, onBeat: jest.fn() });
    expect(spec.name).toBe('introFull');
    expect(spec.tweenClock).toBe('ui');
    expect(sequenceDuration(spec)).toBe(7200);
    const byTarget = (target: unknown) => tweens(spec.steps).find((step) => step.target === target);
    expect(byTarget(progress.contour)).toMatchObject({ at: 200, duration: 3200, from: 0, to: 1 });
    expect(byTarget(progress.tone)).toMatchObject({ at: 1300, duration: 3600, from: 0, to: 1 });
    expect(byTarget(progress.cameraScale)).toMatchObject({ at: 100, duration: 6000, from: 1.1, to: 1 });
    expect(byTarget(progress.route)).toMatchObject({ at: 4100, duration: 2600, from: 0, to: 1 });
    expect(byTarget(progress.copy)).toMatchObject({ at: 4800, duration: 1100 });
    expect(byTarget(progress.continue)).toMatchObject({ at: 6200, duration: 1000 });
    expect(byTarget(progress.marker)).toMatchObject({ at: 6300, duration: 600 });
    expect(byTarget(progress.land)).toMatchObject({ at: 6500, duration: 700, to: 1 });
    expect(T.routeAt).toBe(4100);
    expect(calls(spec.steps).map(step => [step.at, Boolean(step.transient)])).toEqual([
      [0, false],
      [150, true],
      [4100, false],
      [4100, true],
      [6100, false],
      [6200, false],
      [6300, true],
      [6900, true],
    ]);
    const routeCalls = calls(spec.steps).filter((step) => step.at === T.routeAt);
    expect(routeCalls).toHaveLength(2);
    expect(routeCalls.map(step => Boolean(step.transient))).toEqual([false, true]);
  });

  it('mounts settled land 400ms before the unchanged full-map crossfade', () => {
    const progress = makeProgress();
    const onLandReveal = jest.fn();
    const spec = introFullSequence({ progress, onLandReveal });
    const prepare = calls(spec.steps).find(step => step.at === T.landPrepareAt);
    const landFade = tweens(spec.steps).find(step => step.target === progress.land);
    expect(T.landPrepareAt).toBe(6100);
    expect(landFade).toMatchObject({ at: 6500, duration: 700, from: 0, to: 1 });
    prepare?.run();
    expect(onLandReveal).toHaveBeenCalledTimes(1);
    expect(progress.land.value).toBe(0);
  });

  it('skip lands every full-sequence value, marks seen at the route start, and drops pending sound beats', async () => {
    const progress = makeProgress();
    const onBeat = jest.fn();
    const onStartAir = jest.fn();
    const onContinueVisible = jest.fn();
    const onRouteStart = jest.fn();
    const spec = introFullSequence({ progress, onBeat, onStartAir, onContinueVisible, onRouteStart });
    const runner = createSequenceRunner(makeDriver());
    const done = runner.run(spec);
    expect(onStartAir).toHaveBeenCalledTimes(1);
    expect(onBeat).not.toHaveBeenCalled();
    runner.skip();
    await done;
    expect(onRouteStart).toHaveBeenCalledTimes(1);
    expect(onContinueVisible).toHaveBeenCalledTimes(1);
    expect(onBeat).not.toHaveBeenCalled();
    expect([
      progress.contour.value,
      progress.tone.value,
      progress.route.value,
      progress.copy.value,
      progress.marker.value,
      progress.continue.value,
      progress.land.value,
      progress.cameraScale.value,
    ]).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('short spec finishes under two seconds with parallel ink, a one-second route, and only open/ink beats', () => {
    const progress = makeProgress();
    const onBeat = jest.fn();
    const onStartAir = jest.fn();
    const onContinueVisible = jest.fn();
    const onLandReveal = jest.fn();
    const spec = introShortSequence({ progress, onBeat, onStartAir, onContinueVisible, onLandReveal });
    expect(spec.name).toBe('introShort');
    expect(spec.tweenClock).toBe('ui');
    expect(sequenceDuration(spec)).toBeLessThan(2000);
    expect(sequenceDuration(spec)).toBe(T.shortDuration);
    expect(tweens(spec.steps).filter((step) => step.target === progress.contour || step.target === progress.tone))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ at: 0, duration: 1200, to: 1 }),
      ]));
    expect(tweens(spec.steps).find((step) => step.target === progress.route)).toMatchObject({ at: 0, duration: 1000, to: 1 });
    expect(tweens(spec.steps).find((step) => step.target === progress.copy)).toMatchObject({ at: 1200, duration: 400, to: 1 });
    const continueCall = calls(spec.steps).find((step) => step.at === 1200);
    expect(continueCall).toBeDefined();
    expect(continueCall?.transient).toBeUndefined();
    calls(spec.steps).filter((step) => step.transient).forEach((step) => step.run());
    expect(onBeat.mock.calls).toEqual([['open'], ['ink']]);
    expect(onStartAir).not.toHaveBeenCalled();
    const reset = calls(spec.steps).find(step => step.at === 0 && !step.transient);
    reset?.run();
    expect(onLandReveal).toHaveBeenCalledTimes(1);
    expect(progress.land.value).toBe(0);
    continueCall?.run();
    expect(onContinueVisible).toHaveBeenCalledTimes(1);
  });

  it('reduced motion sets final content, crosses the land once, and plays only open', () => {
    const progress = makeProgress();
    const onBeat = jest.fn();
    const onRouteStart = jest.fn();
    const onContinueVisible = jest.fn();
    const spec = introReducedSequence({ progress, onBeat, onRouteStart, onContinueVisible });
    expect(spec.name).toBe('introReduced');
    expect(spec.tweenClock).toBeUndefined();
    expect(sequenceDuration(spec)).toBe(180);
    expect(tweens(spec.steps)).toEqual([
      expect.objectContaining({ target: progress.land, at: 0, duration: 180, from: 0, to: 1, easing: 'linear' }),
    ]);
    const reset = calls(spec.steps).find((step) => step.at === 0 && !step.transient);
    reset?.run();
    expect([
      progress.contour.value,
      progress.tone.value,
      progress.route.value,
      progress.copy.value,
      progress.marker.value,
      progress.continue.value,
      progress.cameraScale.value,
    ]).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(chartIntroBaseLayerStyle(393, progress.cameraScale.value, progress.land.value)).toEqual({ opacity: 0 });
    // On the first visible frame of the reduced crossfade, the base uses the
    // same settled camera as the ink layer.
    progress.land.value = 0.01;
    expect(chartIntroBaseLayerStyle(393, progress.cameraScale.value, progress.land.value)).toEqual({
      opacity: 0.01,
      transform: [{ translateX: 196.5 }, { scale: 1 }, { translateX: -196.5 }],
    });
    expect(onRouteStart).toHaveBeenCalledTimes(1);
    expect(onContinueVisible).toHaveBeenCalledTimes(1);
    calls(spec.steps).filter((step) => step.transient).forEach((step) => step.run());
    expect(onBeat.mock.calls).toEqual([['open']]);
  });

  it('map-tap skip completes every visual value over 250ms without transient sound calls', () => {
    const progress = makeProgress();
    const onBeat = jest.fn();
    const onRouteStart = jest.fn();
    const onContinueVisible = jest.fn();
    const onEnd = jest.fn();
    const spec = introSkipSequence({ progress, onBeat, onRouteStart, onContinueVisible, onEnd });
    expect(spec.name).toBe('introSkip');
    expect(sequenceDuration(spec)).toBe(T.skip);
    expect(tweens(spec.steps)).toHaveLength(8);
    expect(tweens(spec.steps).every(step => step.duration === 250)).toBe(true);
    expect(calls(spec.steps).some(step => step.transient)).toBe(false);
    const runner = createSequenceRunner(makeDriver());
    const done = runner.run(spec);
    runner.skip();
    return done.then(() => {
      expect(onRouteStart).toHaveBeenCalledTimes(1);
      expect(onContinueVisible).toHaveBeenCalledTimes(1);
      expect(onBeat).not.toHaveBeenCalled();
      expect(onEnd).toHaveBeenCalledTimes(1);
      expect([
        progress.contour.value, progress.tone.value, progress.route.value, progress.copy.value,
        progress.marker.value, progress.continue.value, progress.land.value, progress.cameraScale.value,
      ]).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    });
  });
});
