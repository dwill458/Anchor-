import { createSequenceRunner, type SequenceDriver, type TweenHandle } from '../chartSequence';
import type { SharedValue } from 'react-native-reanimated';
import type { SequenceSpec } from '../chartMapContracts';

type Fake = { id: string; value: number };

function makeDriver() {
  const log: string[] = [];
  const tweens: Array<{ target: Fake; to: number; done: () => void; cancelled: boolean; handle: TweenHandle }> = [];
  const driver: SequenceDriver = {
    startTween(target, _from, to, _duration, _easing, onDone) {
      const t = { target: target as Fake, to, done: onDone, cancelled: false, handle: { cancel: () => undefined } };
      t.handle = {
        cancel: () => {
          t.cancelled = true;
        },
      };
      tweens.push(t);
      log.push(`tween:${(target as Fake).id}`);
      return t.handle;
    },
    setValue(target, value) {
      (target as Fake).value = value;
      log.push(`set:${(target as Fake).id}=${value}`);
    },
    getValue: (target) => (target as Fake).value,
    setTimer: (ms, fn) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
  const sv = (id: string, value = 0): SharedValue<number> => ({ id, value } as unknown as SharedValue<number>);
  /** Complete every live tween, as the UI thread would. */
  const finishTweens = () => tweens.filter((t) => !t.cancelled).forEach((t) => {
    (t.target as Fake).value = t.to;
    t.done();
  });
  return { driver, log, tweens, sv, finishTweens };
}

const spec = (h: ReturnType<typeof makeDriver>, calls: string[], onEnd?: () => void): SequenceSpec => {
  const a = h.sv('a');
  const b = h.sv('b');
  return {
    name: 'reach',
    onEnd,
    steps: [
      { kind: 'tween', at: 0, duration: 100, target: a, to: 1 },
      { kind: 'call', at: 50, run: () => calls.push('c50') },
      { kind: 'tween', at: 200, duration: 100, target: b, to: 5 },
      { kind: 'call', at: 400, run: () => calls.push('c400') },
    ],
  };
};

describe('createSequenceRunner', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('runs steps in order on their own offsets and ends once', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver);
    const calls: string[] = [];
    const onEnd = jest.fn();
    const done = runner.run(spec(h, calls, onEnd));
    expect(runner.isBusy()).toBe(true);
    expect(h.log).toEqual(['tween:a']);
    jest.advanceTimersByTime(50);
    expect(calls).toEqual(['c50']);
    jest.advanceTimersByTime(150);
    expect(h.log).toEqual(['tween:a', 'tween:b']);
    h.finishTweens();
    jest.advanceTimersByTime(200);
    expect(calls).toEqual(['c50', 'c400']);
    await done;
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(runner.isBusy()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('waits for in-flight tweens before ending', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver);
    const onEnd = jest.fn();
    const target = h.sv('x');
    const p = runner.run({ name: 'open', onEnd, steps: [{ kind: 'tween', at: 0, duration: 500, target, to: 1 }] });
    jest.advanceTimersByTime(600);
    expect(onEnd).not.toHaveBeenCalled();
    h.finishTweens();
    await p;
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('skip resolves to the end state in order and ends once', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver);
    const calls: string[] = [];
    const onEnd = jest.fn();
    const s = spec(h, calls, onEnd);
    const p = runner.run(s);
    jest.advanceTimersByTime(60); // tween a in flight, c50 ran
    h.log.length = 0;
    runner.skip();
    await p;
    expect(h.tweens[0].cancelled).toBe(true);
    expect(h.log).toEqual(['set:a=1', 'set:b=5']);
    expect(calls).toEqual(['c50', 'c400']);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    expect(runner.isBusy()).toBe(false);
    runner.skip(); // idempotent
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('skip applies unfinished steps in ascending at order even if declared out of order', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver);
    const order: string[] = [];
    const a = h.sv('a');
    const p = runner.run({
      name: 'arrival',
      steps: [
        { kind: 'call', at: 300, run: () => order.push('late') },
        { kind: 'tween', at: 100, duration: 50, target: a, to: 9 },
        { kind: 'call', at: 200, run: () => order.push('mid') },
      ],
    });
    runner.skip();
    await p;
    expect(order).toEqual(['mid', 'late']);
    expect(a as unknown as Fake).toMatchObject({ value: 9 });
  });

  it('skip drops pending transient beats (sounds) instead of firing them all at once; beats that already ran stay run', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver);
    const order: string[] = [];
    const p = runner.run({
      name: 'open',
      steps: [
        { kind: 'call', at: 0, run: () => order.push('beat0'), transient: true },
        { kind: 'call', at: 250, run: () => order.push('beat250'), transient: true },
        { kind: 'call', at: 1000, run: () => order.push('flag'), transient: true },
        { kind: 'call', at: 1200, run: () => order.push('panel') },
      ],
    });
    jest.advanceTimersByTime(300);
    runner.skip();
    await p;
    expect(order).toEqual(['beat0', 'beat250', 'panel']);
  });

  it('cancel leaves no timers, runs nothing further, never calls onEnd, and resolves', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver);
    const calls: string[] = [];
    const onEnd = jest.fn();
    const p = runner.run(spec(h, calls, onEnd));
    jest.advanceTimersByTime(60);
    runner.cancel();
    await expect(p).resolves.toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(5000);
    expect(calls).toEqual(['c50']);
    expect(onEnd).not.toHaveBeenCalled();
    expect(h.tweens[0].cancelled).toBe(true);
    expect(runner.isBusy()).toBe(false);
  });

  it('a stale tween completion after cancel does nothing', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver);
    const onEnd = jest.fn();
    const p = runner.run({ name: 'open', onEnd, steps: [{ kind: 'tween', at: 0, duration: 100, target: h.sv('x'), to: 1 }] });
    runner.cancel();
    await p;
    h.tweens[0].done();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('reduced motion turns tweens into ordered sets and still runs calls', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver, { reducedMotion: () => true });
    const calls: string[] = [];
    const onEnd = jest.fn();
    const p = runner.run(spec(h, calls, onEnd));
    expect(h.tweens).toHaveLength(0);
    expect(h.log).toEqual(['set:a=1']);
    jest.advanceTimersByTime(50);
    expect(calls).toEqual(['c50']);
    jest.advanceTimersByTime(150);
    expect(h.log).toEqual(['set:a=1', 'set:b=5']);
    jest.advanceTimersByTime(200);
    await p;
    expect(calls).toEqual(['c50', 'c400']);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(h.tweens).toHaveLength(0);
  });

  it('run while busy skips the previous run first', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver);
    const callsA: string[] = [];
    const endA = jest.fn();
    const first = runner.run(spec(h, callsA, endA));
    jest.advanceTimersByTime(10);
    const callsB: string[] = [];
    const endB = jest.fn();
    const second = runner.run({ name: 'moveCheck', onEnd: endB, steps: [{ kind: 'call', at: 100, run: () => callsB.push('b') }] });
    await first;
    expect(endA).toHaveBeenCalledTimes(1);
    expect(callsA).toEqual(['c50', 'c400']);
    expect(runner.isBusy()).toBe(true);
    jest.advanceTimersByTime(100);
    await second;
    expect(callsB).toEqual(['b']);
    expect(endB).toHaveBeenCalledTimes(1);
    expect(callsA).toEqual(['c50', 'c400']);
  });

  it('timeScale stretches offsets and an empty spec ends immediately', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver, { timeScale: 2 });
    const calls: string[] = [];
    const p = runner.run({ name: 'open', steps: [{ kind: 'call', at: 100, run: () => calls.push('x') }] });
    jest.advanceTimersByTime(199);
    expect(calls).toEqual([]);
    jest.advanceTimersByTime(1);
    await p;
    expect(calls).toEqual(['x']);
    const endEmpty = jest.fn();
    await runner.run({ name: 'open', steps: [], onEnd: endEmpty });
    expect(endEmpty).toHaveBeenCalledTimes(1);
  });

  it('a throwing call does not stall the sequence', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver);
    const onEnd = jest.fn();
    const p = runner.run({
      name: 'open',
      onEnd,
      steps: [
        {
          kind: 'call',
          at: 0,
          run: () => {
            throw new Error('boom');
          },
        },
        { kind: 'call', at: 10, run: () => undefined },
      ],
    });
    jest.advanceTimersByTime(10);
    await p;
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('supersedes overlapping same-target tweens: resolves once, ends on the later target', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver);
    const reveal = h.sv('reveal');
    const onEnd = jest.fn();
    const p = runner.run({
      name: 'reach',
      onEnd,
      steps: [
        { kind: 'tween', at: 0, duration: 350, target: reveal, to: 100 },
        { kind: 'tween', at: 200, duration: 600, target: reveal, to: 200 },
      ],
    });
    jest.advanceTimersByTime(200);
    expect(h.tweens).toHaveLength(2);
    expect(h.tweens[0].cancelled).toBe(true);
    h.tweens[0].done(); // late callback from the cancelled tween is ignored
    expect(onEnd).not.toHaveBeenCalled();
    h.finishTweens();
    await p;
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect((reveal as unknown as Fake).value).toBe(200);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('finishes via the safety net when the driver never calls onDone', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver);
    const x = h.sv('x');
    const onEnd = jest.fn();
    const p = runner.run({ name: 'open', onEnd, steps: [{ kind: 'tween', at: 0, duration: 100, target: x, to: 7 }] });
    jest.advanceTimersByTime(349);
    expect(onEnd).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await p;
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect((x as unknown as Fake).value).toBe(7);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('skip after a supersede applies only the surviving end state', async () => {
    const h = makeDriver();
    const runner = createSequenceRunner(h.driver);
    const r = h.sv('r');
    const onEnd = jest.fn();
    const p = runner.run({
      name: 'reach',
      onEnd,
      steps: [
        { kind: 'tween', at: 0, duration: 350, target: r, to: 100 },
        { kind: 'tween', at: 100, duration: 600, target: r, to: 200 },
        { kind: 'call', at: 900, run: () => undefined },
      ],
    });
    jest.advanceTimersByTime(100);
    h.log.length = 0;
    runner.skip();
    await p;
    expect(h.log).toEqual(['set:r=200']);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
