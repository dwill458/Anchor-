import { createSingleFlight } from '../visionSingleFlight';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};

describe('createSingleFlight', () => {
  it('drops a second tap while the first is running, then allows another run', async () => {
    const flight = createSingleFlight();
    const first = deferred<string>();
    const action = jest.fn(() => first.promise);
    const a = flight.run(action);
    expect(flight.busy).toBe(true);
    expect(await flight.run(action)).toEqual({ status: 'busy' });
    first.resolve('one');
    expect(await a).toEqual({ status: 'done', value: 'one' });
    expect(action).toHaveBeenCalledTimes(1);
    expect(flight.busy).toBe(false);
    expect(await flight.run(async () => 'two')).toEqual({ status: 'done', value: 'two' });
  });

  it('reports a cancelled run as stale and never lets it block or overwrite the next one', async () => {
    const flight = createSingleFlight();
    const slow = deferred<string>();
    const stale = flight.run(() => slow.promise);
    flight.cancel();
    expect(flight.busy).toBe(false);
    const fresh = await flight.run(async () => 'fresh');
    expect(fresh).toEqual({ status: 'done', value: 'fresh' });
    slow.resolve('late');
    expect(await stale).toEqual({ status: 'stale' });
  });

  it('releases the lock when the action throws', async () => {
    const flight = createSingleFlight();
    await expect(flight.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(flight.busy).toBe(false);
    expect(await flight.run(async () => 1)).toEqual({ status: 'done', value: 1 });
  });

  it('keeps a newer run locked when a stale one finishes', async () => {
    const flight = createSingleFlight();
    const old = deferred<string>();
    const oldRun = flight.run(() => old.promise);
    flight.cancel();
    const next = deferred<string>();
    const nextRun = flight.run(() => next.promise);
    old.resolve('old');
    await oldRun;
    expect(flight.busy).toBe(true);
    expect(await flight.run(async () => 'x')).toEqual({ status: 'busy' });
    next.resolve('new');
    expect(await nextRun).toEqual({ status: 'done', value: 'new' });
  });
});
