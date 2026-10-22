type HomeStartupFields = Record<string, string | number | boolean | null | undefined>;

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const runtimeStartedAt = now();
let nextSpanId = 0;
const profilingEnabled = __DEV__ && !(typeof process !== 'undefined' && process.env.JEST_WORKER_ID);

/** Development-only monotonic timings for the post-bootstrap Home critical path. */
export const HomeStartupProfiler = {
  mark(stage: string, fields: HomeStartupFields = {}): void {
    if (!profilingEnabled) return;
    // Keep IDs and timings only. Intention text, profile data, and response payloads never enter logs.
    console.log('[HomeStartup]', JSON.stringify({
      stage,
      phase: 'mark',
      elapsedMs: Number((now() - runtimeStartedAt).toFixed(1)),
      ...fields,
    }));
  },

  start(stage: string, fields: HomeStartupFields = {}): (result?: HomeStartupFields) => void {
    if (!profilingEnabled) return () => undefined;
    const spanId = ++nextSpanId;
    const startedAt = now();
    console.log('[HomeStartup]', JSON.stringify({
      stage,
      phase: 'start',
      spanId,
      elapsedMs: Number((startedAt - runtimeStartedAt).toFixed(1)),
      ...fields,
    }));

    let ended = false;
    return (result = {}) => {
      if (ended) return;
      ended = true;
      const endedAt = now();
      console.log('[HomeStartup]', JSON.stringify({
        stage,
        phase: 'end',
        spanId,
        elapsedMs: Number((endedAt - runtimeStartedAt).toFixed(1)),
        durationMs: Number((endedAt - startedAt).toFixed(1)),
        ...fields,
        ...result,
      }));
    };
  },
};
