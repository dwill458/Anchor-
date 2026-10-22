import { CELEBRATION_SKIPPABLE_AFTER_MS, useCelebrationStore } from '../celebrationStore';

const store = () => useCelebrationStore.getState();

beforeEach(() => {
  store().reset();
});

describe('celebration coordinator', () => {
  it('plays a scene immediately when nothing is active and reports its view', () => {
    expect(store().request(2, 'repeat-practice', { durationMs: 2000 })).toBe('play');
    expect(store().active).toEqual({ id: 'repeat-practice', level: 2, skippable: false });
    expect(store().queueLength).toBe(0);
  });

  it('preempts a lower level, calls its onSkip, and drops it instead of requeueing', () => {
    const lowerSkip = jest.fn();
    const lowerStart = jest.fn();
    store().request(2, 'lower', { durationMs: 3000, onSkip: lowerSkip, onStart: lowerStart });

    const higherStart = jest.fn();
    expect(store().request(3, 'higher', { durationMs: 3500, onStart: higherStart })).toBe('play');

    expect(lowerSkip).toHaveBeenCalledTimes(1);
    expect(store().active).toEqual({ id: 'higher', level: 3, skippable: true });
    expect(store().queueLength).toBe(0);

    store().finish('higher');
    expect(store().active).toBeNull();
    expect(lowerStart).not.toHaveBeenCalled();
    expect(higherStart).not.toHaveBeenCalled();
  });

  it('makes a lower level wait and starts it through onStart when the higher one finishes', () => {
    const higherSkip = jest.fn();
    store().request(4, 'major', { durationMs: 6000, onSkip: higherSkip });

    const lowerSkip = jest.fn();
    const lowerStart = jest.fn();
    expect(store().request(2, 'reinforce', { durationMs: 2000, onSkip: lowerSkip, onStart: lowerStart })).toBe('deferred');
    expect(store().queueLength).toBe(1);
    expect(lowerStart).not.toHaveBeenCalled();

    store().finish('major');
    expect(higherSkip).not.toHaveBeenCalled();
    expect(lowerStart).toHaveBeenCalledTimes(1);
    expect(lowerSkip).not.toHaveBeenCalled();
    expect(store().active).toEqual({ id: 'reinforce', level: 2, skippable: false });
    expect(store().queueLength).toBe(0);
  });

  it('orders waiting scenes by level descending, then first in first out', () => {
    store().request(4, 'major');
    const started: string[] = [];
    store().request(2, 'two-a', { onStart: () => started.push('two-a') });
    store().request(3, 'three', { onStart: () => started.push('three') });
    store().request(2, 'two-b', { onStart: () => started.push('two-b') });

    store().finish('major');
    expect(store().active?.id).toBe('three');
    store().finish('three');
    expect(store().active?.id).toBe('two-a');
    store().finish('two-a');
    expect(store().active?.id).toBe('two-b');
    store().finish('two-b');

    expect(started).toEqual(['three', 'two-a', 'two-b']);
    expect(store().active).toBeNull();
  });

  it('drops a level 1 scene while anything is active and plays it when idle', () => {
    expect(store().request(1, 'quiet-idle')).toBe('play');
    expect(store().request(1, 'quiet-blocked')).toBe('dropped');
    expect(store().active?.id).toBe('quiet-idle');
    expect(store().queueLength).toBe(0);

    store().request(3, 'milestone');
    expect(store().request(1, 'quiet-under-milestone')).toBe('dropped');
    expect(store().queueLength).toBe(0);
  });

  it('makes an equal level wait rather than preempt', () => {
    const activeSkip = jest.fn();
    store().request(2, 'first', { onSkip: activeSkip });
    const secondStart = jest.fn();
    expect(store().request(2, 'second', { onStart: secondStart })).toBe('deferred');

    expect(activeSkip).not.toHaveBeenCalled();
    expect(store().active?.id).toBe('first');
    expect(store().queueLength).toBe(1);

    store().finish('first');
    expect(secondStart).toHaveBeenCalledTimes(1);
  });

  it('treats a duplicate active id as idempotent', () => {
    const onStart = jest.fn();
    expect(store().request(3, 'same', { durationMs: 4000, onStart })).toBe('play');
    expect(store().request(3, 'same', { durationMs: 4000, onStart })).toBe('duplicate');
    expect(store().queueLength).toBe(0);
    expect(store().active?.id).toBe('same');

    store().finish('same');
    expect(store().active).toBeNull();
    expect(onStart).not.toHaveBeenCalled();
  });

  it('allows the same id again after finish', () => {
    expect(store().request(3, 'same')).toBe('play');
    store().finish('same');
    expect(store().request(3, 'same')).toBe('play');
    expect(store().active?.id).toBe('same');
  });

  it('treats a duplicate queued id as idempotent', () => {
    store().request(4, 'major');
    const onStart = jest.fn();
    expect(store().request(2, 'queued', { onStart })).toBe('deferred');
    expect(store().request(2, 'queued', { onStart })).toBe('deferred');
    expect(store().queueLength).toBe(1);

    store().finish('major');
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(store().queueLength).toBe(0);
  });

  it('skips only scenes longer than the skippable threshold, landing on onSkip', () => {
    expect(CELEBRATION_SKIPPABLE_AFTER_MS).toBe(2500);

    const atThresholdSkip = jest.fn();
    store().request(2, 'at-threshold', { durationMs: CELEBRATION_SKIPPABLE_AFTER_MS, onSkip: atThresholdSkip });
    expect(store().active?.skippable).toBe(false);
    expect(store().skip()).toBe(false);
    expect(atThresholdSkip).not.toHaveBeenCalled();
    expect(store().active?.id).toBe('at-threshold');

    store().finish('at-threshold');
    const unknownDurationSkip = jest.fn();
    store().request(3, 'no-duration', { onSkip: unknownDurationSkip });
    expect(store().active?.skippable).toBe(false);
    expect(store().skip()).toBe(false);
    expect(unknownDurationSkip).not.toHaveBeenCalled();

    store().finish('no-duration');
    const longSkip = jest.fn();
    const nextStart = jest.fn();
    store().request(4, 'long', { durationMs: 6000, onSkip: longSkip });
    store().request(2, 'next', { onStart: nextStart });
    expect(store().active?.skippable).toBe(true);
    expect(store().skip()).toBe(true);
    expect(longSkip).toHaveBeenCalledTimes(1);
    expect(nextStart).toHaveBeenCalledTimes(1);
    expect(store().active?.id).toBe('next');
  });

  it('returns false from skip when nothing is active', () => {
    expect(store().skip()).toBe(false);
  });

  it('treats a finish of an unknown id as a no-op', () => {
    store().request(2, 'playing', { durationMs: 2000 });
    const before = store().active;
    store().finish('never-requested');
    expect(store().active).toBe(before);
    expect(store().queueLength).toBe(0);
  });

  it('removes a queued scene when it is finished before it plays', () => {
    store().request(4, 'major');
    const queuedStart = jest.fn();
    store().request(2, 'queued', { onStart: queuedStart });
    store().finish('queued');
    expect(store().queueLength).toBe(0);

    store().finish('major');
    expect(queuedStart).not.toHaveBeenCalled();
    expect(store().active).toBeNull();
  });

  it('keeps the store consistent when callbacks throw', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      // onSkip throws during preemption: the new scene still plays.
      store().request(2, 'lower', {
        durationMs: 3000,
        onSkip: () => {
          throw new Error('skip failed');
        },
      });
      expect(store().request(3, 'higher')).toBe('play');
      expect(store().active?.id).toBe('higher');

      // onStart throws on promotion: the promoted scene is still the active one.
      store().request(2, 'waiting', {
        onStart: () => {
          throw new Error('start failed');
        },
      });
      store().finish('higher');
      expect(store().active?.id).toBe('waiting');

      // onSkip throws on skip: the scene is still finished.
      store().request(4, 'long', {
        durationMs: 6000,
        onSkip: () => {
          throw new Error('skip failed');
        },
      });
      store().request(2, 'after');
      expect(store().skip()).toBe(true);
      expect(store().active?.id).toBe('after');
      expect(store().queueLength).toBe(0);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
