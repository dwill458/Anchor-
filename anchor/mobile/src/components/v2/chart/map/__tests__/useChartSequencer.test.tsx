import { act, renderHook } from '@testing-library/react-native';
import type { ChartMapAnimState, SequenceSpec } from '../chartMapContracts';
import { buildRouteTable, waypointPlacement } from '../chartMapGeometry';
import { arrivalSequence, reachSequence } from '../chartMapSequences';
import { useChartSequencer } from '../useChartSequencer';

type Anim = { to: number; config: any; cb: (finished: boolean) => void };
class Shared {
  current: number;
  running: Anim | null = null;
  constructor(initial = 0) {
    this.current = initial;
  }
  get value() {
    return this.current;
  }
  set value(next: any) {
    if (next && typeof next === 'object' && 'to' in next) {
      this.running = next;
    } else {
      this.running = null;
      this.current = next;
    }
  }
  /** Finish the running animation the way the UI thread would. */
  finish() {
    const anim = this.running;
    if (!anim) return;
    this.running = null;
    this.current = anim.to;
    anim.cb(true);
  }
}

jest.mock('react-native-reanimated', () => ({
  withTiming: (to: number, config: any, cb: (finished: boolean) => void) => ({ to, config, cb }),
  cancelAnimation: (shared: any) => {
    // Real Reanimated reports a cancelled animation with finished=false.
    const anim = shared.running;
    shared.running = null;
    anim?.cb(false);
  },
  runOnJS: (fn: any) => fn,
  withDelay: (_d: number, a: any) => a,
  withRepeat: (a: any) => a,
  withSequence: (...a: any[]) => a[a.length - 1],
  Easing: {
    cubic: 'cubic',
    linear: 'linear',
    bezier: () => 'bezier',
    inOut: (e: any) => `inOut(${e})`,
    out: (e: any) => `out(${e})`,
  },
  ReduceMotion: { Never: 'never' },
}));

const tweenSpec = (target: Shared, log: string[]): SequenceSpec => ({
  name: 'reach',
  steps: [
    { kind: 'call', at: 0, run: () => log.push('start') },
    { kind: 'tween', at: 100, duration: 400, easing: 'out', target: target as any, to: 1, from: 0 },
    { kind: 'call', at: 600, run: () => log.push('late') },
  ],
  onEnd: () => log.push('end'),
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useChartSequencer', () => {
  it('returns one stable runner', () => {
    const hook = renderHook(({ reduced }) => useChartSequencer(reduced), { initialProps: { reduced: false } });
    const first = hook.result.current;
    hook.rerender({ reduced: true });
    expect(hook.result.current).toBe(first);
  });

  it('drives a tween with the mapped easing and resolves when it finishes', async () => {
    const hook = renderHook(() => useChartSequencer(false));
    const target = new Shared(5);
    const log: string[] = [];
    let resolved = false;
    const promise = hook.result.current.run(tweenSpec(target, log)).then(() => {
      resolved = true;
    });
    expect(hook.result.current.isBusy()).toBe(true);
    expect(log).toEqual(['start']);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(target.running?.config).toMatchObject({ duration: 400, easing: 'out(cubic)', reduceMotion: 'never' });
    expect(target.current).toBe(0); // explicit `from` pinned
    act(() => {
      target.finish();
    });
    expect(target.current).toBe(1);
    act(() => {
      jest.advanceTimersByTime(500);
    });
    await promise;
    expect(resolved).toBe(true);
    expect(log).toEqual(['start', 'late', 'end']);
    expect(hook.result.current.isBusy()).toBe(false);
  });

  it('skip resolves every target to its end state and runs pending calls once', async () => {
    const hook = renderHook(() => useChartSequencer(false));
    const target = new Shared(0);
    const log: string[] = [];
    const promise = hook.result.current.run(tweenSpec(target, log));
    act(() => {
      jest.advanceTimersByTime(150);
    });
    act(() => hook.result.current.skip());
    await promise;
    expect(target.current).toBe(1);
    expect(target.running).toBeNull();
    expect(log).toEqual(['start', 'late', 'end']);
    expect(jest.getTimerCount()).toBe(0);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(log).toEqual(['start', 'late', 'end']);
  });

  it('unmount mid-sequence leaves no timers, cancels the tween and runs nothing afterwards', async () => {
    const hook = renderHook(() => useChartSequencer(false));
    const target = new Shared(0);
    const log: string[] = [];
    const promise = hook.result.current.run(tweenSpec(target, log));
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(target.running).not.toBeNull();
    hook.unmount();
    expect(target.running).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    await promise;
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(log).toEqual(['start']);
  });

  it('a stale completion after unmount does nothing', () => {
    const hook = renderHook(() => useChartSequencer(false));
    const target = new Shared(0);
    const log: string[] = [];
    void hook.result.current.run(tweenSpec(target, log));
    act(() => {
      jest.advanceTimersByTime(150);
    });
    const anim = target.running!;
    hook.unmount();
    expect(() => anim.cb(true)).not.toThrow();
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(log).toEqual(['start']);
  });

  it('reduced motion (read through the ref) clamps tweens to a short linear fade', () => {
    const hook = renderHook(({ reduced }) => useChartSequencer(reduced), { initialProps: { reduced: false } });
    hook.rerender({ reduced: true });
    const target = new Shared(0);
    void hook.result.current.run({
      name: 'open',
      steps: [{ kind: 'tween', at: 0, duration: 700, easing: 'inOut', target: target as any, to: 1 }],
    });
    expect(target.running?.config).toMatchObject({ duration: 180, easing: 'linear' });
    hook.unmount();
  });

  describe('real sequences complete without skip', () => {
    const makeAnim = () => {
      const all: Shared[] = [];
      const sv = (v = 0) => {
        const x = new Shared(v);
        all.push(x);
        return x;
      };
      const anim = {
        camera: { cx: sv(426), cy: sv(590), s: sv(1) },
        revealArc: sv(), fog: sv(), mapOpacity: sv(), flagIndex: sv(-1), flagDrop: sv(), flagOpacity: sv(),
        pulse: sv(1), stampIndex: sv(-1), stamp: sv(), glyph: sv(), goldDot: sv(),
      };
      return { anim: anim as unknown as ChartMapAnimState, all };
    };
    const placement = waypointPlacement(5);
    const table = buildRouteTable();

    const drive = async (hook: { result: { current: { run: (s: SequenceSpec) => Promise<void> } } }, spec: SequenceSpec, all: Shared[]) => {
      const onEnd = jest.fn();
      let resolved = false;
      const promise = hook.result.current.run({ ...spec, onEnd }).then(() => {
        resolved = true;
      });
      for (let t = 0; t < 4000 && !resolved; t += 25) {
        await act(async () => {
          jest.advanceTimersByTime(25);
          all.forEach((x) => x.finish());
          await Promise.resolve();
        });
      }
      await promise;
      // Nothing more may fire after natural completion (a stray act scheduler timer may remain for a tick).
      jest.advanceTimersByTime(10000);
      expect(jest.getTimerCount()).toBe(0);
      return { onEnd, resolved };
    };

    it('reachSequence resolves and fires onEnd once', async () => {
      const hook = renderHook(() => useChartSequencer(false));
      const { anim, all } = makeAnim();
      const onAdvance = jest.fn();
      const onCommitCard = jest.fn();
      const spec = reachSequence({
        anim, placement, index: 1, endArc: placement.arcs[1], nextRevealArc: placement.arcs[1] + 40,
        reducedMotion: false, onAdvance, onCommitCard,
      });
      const { onEnd, resolved } = await drive(hook, spec, all);
      expect(resolved).toBe(true);
      expect(onEnd).toHaveBeenCalledTimes(1);
      expect(onAdvance).toHaveBeenCalledTimes(1);
      expect(onCommitCard).toHaveBeenCalledTimes(1);
      expect(anim.revealArc.value).toBe(placement.arcs[1] + 40);
      expect(anim.fog.value).toBe(0);
      expect(anim.stampIndex.value).toBe(-1);
      expect(hook.result.current.isBusy()).toBe(false);
    });

    it('arrivalSequence resolves and fires onEnd once', async () => {
      const hook = renderHook(() => useChartSequencer(false));
      const { anim, all } = makeAnim();
      const onArrived = jest.fn();
      const spec = arrivalSequence({ anim, placement, table, index: 4, reducedMotion: false, onArrived });
      const { onEnd, resolved } = await drive(hook, spec, all);
      expect(resolved).toBe(true);
      expect(onEnd).toHaveBeenCalledTimes(1);
      expect(onArrived).toHaveBeenCalledTimes(1);
      expect(anim.revealArc.value).toBe(table.total);
      expect(anim.fog.value).toBe(1);
      expect(anim.goldDot.value).toBe(1);
      expect(hook.result.current.isBusy()).toBe(false);
    });

    it('a cancelled tween never reports done', () => {
      const hook = renderHook(() => useChartSequencer(false));
      const target = new Shared(0);
      const log: string[] = [];
      void hook.result.current.run(tweenSpec(target, log));
      act(() => {
        jest.advanceTimersByTime(150);
      });
      const anim = target.running!;
      hook.unmount(); // cancelAnimation -> cb(false)
      anim.cb(false);
      expect(log).toEqual(['start']);
    });
  });
});
