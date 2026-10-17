/**
 * One in-flight action at a time, with stale-result protection. A second tap while the first is
 * running is dropped (not queued), and a result that arrives after `cancel()` or after a newer
 * run has started is reported as stale so it can never be applied to the screen or the board.
 */
export type SingleFlightResult<T> = { status: 'done'; value: T } | { status: 'busy' } | { status: 'stale' };

export function createSingleFlight() {
  let running = false;
  let generation = 0;
  return {
    get busy() { return running; },
    /** Abandons the run in flight: its result will be reported as stale and a new run may start at once. */
    cancel() { generation += 1; running = false; },
    async run<T>(action: () => Promise<T>): Promise<SingleFlightResult<T>> {
      if (running) return { status: 'busy' };
      running = true;
      const mine = ++generation;
      try {
        const value = await action();
        return mine === generation ? { status: 'done', value } : { status: 'stale' };
      } finally {
        if (mine === generation) running = false;
      }
    },
  };
}
