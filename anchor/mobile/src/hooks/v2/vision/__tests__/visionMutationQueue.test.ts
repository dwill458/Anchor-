import {
  enqueueVisionMutation,
  getVisionMutationFeedback,
  resetVisionMutationQueues,
  subscribeVisionMutations,
} from '../visionMutationQueue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}
const flushMicrotasks = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
const key = 'owner:anchor';

describe('Vision mutation queue and pending Undo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetVisionMutationQueues();
  });
  afterEach(() => {
    resetVisionMutationQueues();
    jest.useRealTimers();
  });

  it('runs edits in serial order and counts both active and queued writes', async () => {
    const firstSave = deferred<{ id: string }>();
    const order: string[] = [];
    const first = enqueueVisionMutation(key, 'First saved', async () => { order.push('first'); return firstSave.promise; });
    const second = enqueueVisionMutation(key, 'Second saved', async () => { order.push('second'); return { id: 'second' }; });
    expect(getVisionMutationFeedback(key).pending).toBe(2);
    await flushMicrotasks();
    expect(order).toEqual(['first']);
    firstSave.resolve({ id: 'first' });
    await first;
    await second;
    expect(order).toEqual(['first', 'second']);
    expect(getVisionMutationFeedback(key)).toMatchObject({ pending: 0, message: 'Second saved' });
  });

  it('waits for an in-flight forward save before sending Undo using the confirmed response', async () => {
    const save = deferred<{ id: string; updatedAt: string }>();
    const inverse = jest.fn(async (confirmed: { id: string; updatedAt: string }) => ({ ...confirmed, updatedAt: 'after-undo' }));
    const forward = enqueueVisionMutation(key, 'Crop saved', () => save.promise, inverse);
    const undo = getVisionMutationFeedback(key).undo!;
    const reversal = undo();
    expect(getVisionMutationFeedback(key).pending).toBe(2);
    await flushMicrotasks();
    expect(inverse).not.toHaveBeenCalled();
    const confirmed = { id: 'saved-scene', updatedAt: 'confirmed-server-version' };
    save.resolve(confirmed);
    await expect(forward).resolves.toEqual(confirmed);
    await expect(reversal).resolves.toBe(true);
    expect(inverse).toHaveBeenCalledWith(confirmed);
    expect(getVisionMutationFeedback(key)).toMatchObject({ pending: 0, message: 'Change undone', undo: null });
  });

  it.each(['null', 'throw'] as const)('never sends an inverse when a pending forward save fails by %s', async failure => {
    const save = deferred<{ id: string } | null>();
    const inverse = jest.fn(async (value: { id: string }) => value);
    const forward = enqueueVisionMutation(key, 'Photo moved', () => save.promise, inverse);
    const reversal = getVisionMutationFeedback(key).undo!();
    await flushMicrotasks();
    if (failure === 'throw') save.reject(new Error('Network lost'));
    else save.resolve(null);
    await expect(forward).resolves.toBeNull();
    await expect(reversal).resolves.toBe(false);
    expect(inverse).not.toHaveBeenCalled();
    expect(getVisionMutationFeedback(key)).toMatchObject({ pending: 0, undo: null });
    expect(getVisionMutationFeedback(key).message).toMatch(/couldn't save/i);
  });

  it.each(['null', 'throw'] as const)('reports a failed inverse by %s instead of a successful Undo', async failure => {
    await enqueueVisionMutation(key, 'Caption saved', async () => ({ id: 'scene' }), async () => {
      if (failure === 'throw') throw new Error('Undo could not reach the server');
      return null;
    });
    const reversal = getVisionMutationFeedback(key).undo!();
    await expect(reversal).resolves.toBe(false);
    expect(getVisionMutationFeedback(key)).toMatchObject({ pending: 0, undo: null });
    expect(getVisionMutationFeedback(key).message).toMatch(/couldn't save/i);
  });

  it('invalidates an earlier Undo when a new edit is queued', async () => {
    const oldInverse = jest.fn(async (value: { id: string }) => value);
    await enqueueVisionMutation(key, 'Old caption saved', async () => ({ id: 'old' }), oldInverse);
    const oldUndo = getVisionMutationFeedback(key).undo!;
    const latestSave = deferred<{ id: string }>();
    const latest = enqueueVisionMutation(key, 'New caption saved', () => latestSave.promise, async value => value);
    await expect(oldUndo()).resolves.toBe(false);
    expect(oldInverse).not.toHaveBeenCalled();
    latestSave.resolve({ id: 'latest' });
    await latest;
    expect(getVisionMutationFeedback(key).message).toBe('New caption saved');
  });

  it('sends an inverse once even if Undo is pressed repeatedly', async () => {
    const inverse = jest.fn(async (value: { id: string }) => value);
    await enqueueVisionMutation(key, 'Layout saved', async () => ({ id: 'vision' }), inverse);
    const undo = getVisionMutationFeedback(key).undo!;
    const first = undo();
    await expect(undo()).resolves.toBe(false);
    await expect(first).resolves.toBe(true);
    expect(inverse).toHaveBeenCalledTimes(1);
  });

  it('keeps different account lanes independent for the same Anchor', async () => {
    const accountA = deferred<{ id: string }>();
    const first = enqueueVisionMutation('account-a:anchor', 'Account A saved', () => accountA.promise);
    const second = enqueueVisionMutation('account-b:anchor', 'Account B saved', async () => ({ id: 'b' }));
    await expect(second).resolves.toEqual({ id: 'b' });
    expect(getVisionMutationFeedback('account-a:anchor').pending).toBe(1);
    expect(getVisionMutationFeedback('account-b:anchor')).toMatchObject({ pending: 0, message: 'Account B saved' });
    accountA.resolve({ id: 'a' });
    await first;
  });

  it('expires successful feedback and Undo after five seconds while preserving them until the deadline', async () => {
    await enqueueVisionMutation(key, 'Layout saved', async () => ({ id: 'vision' }), async value => value);
    jest.advanceTimersByTime(4999);
    expect(getVisionMutationFeedback(key).message).toBe('Layout saved');
    expect(getVisionMutationFeedback(key).undo).toEqual(expect.any(Function));
    jest.advanceTimersByTime(1);
    expect(getVisionMutationFeedback(key)).toEqual({ pending: 0, message: null, undo: null });
  });

  it.each(['null', 'throw'] as const)('expires %s failure feedback after 4.2 seconds', async failure => {
    await enqueueVisionMutation(key, 'Photo moved', async () => {
      if (failure === 'throw') throw new Error('Network lost');
      return null;
    });
    expect(getVisionMutationFeedback(key).message).toMatch(/couldn't save/i);
    jest.advanceTimersByTime(4199);
    expect(getVisionMutationFeedback(key).message).toMatch(/couldn't save/i);
    jest.advanceTimersByTime(1);
    expect(getVisionMutationFeedback(key)).toEqual({ pending: 0, message: null, undo: null });
  });

  it('prevents an older feedback timer from clearing a more recent pending save', async () => {
    await enqueueVisionMutation(key, 'First saved', async () => ({ id: 'first' }));
    jest.advanceTimersByTime(4000);
    const save = deferred<{ id: string }>();
    const second = enqueueVisionMutation(key, 'Second saving', () => save.promise);
    jest.advanceTimersByTime(2000);
    expect(getVisionMutationFeedback(key)).toMatchObject({ pending: 1, message: 'Second saving' });
    save.resolve({ id: 'second' });
    await second;
    jest.advanceTimersByTime(4999);
    expect(getVisionMutationFeedback(key).message).toBe('Second saving');
    jest.advanceTimersByTime(1);
    expect(getVisionMutationFeedback(key).message).toBeNull();
  });

  it('notifies subscribed surfaces and stops notifying after unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeVisionMutations(key, listener);
    await enqueueVisionMutation(key, 'Saved', async () => ({ id: 'vision' }));
    expect(listener).toHaveBeenCalled();
    const notifications = listener.mock.calls.length;
    unsubscribe();
    jest.advanceTimersByTime(5000);
    expect(listener).toHaveBeenCalledTimes(notifications);
  });
});
