/**
 * Dev-only timeline for the creation → Home hand-off. One timestamped line per event so a single
 * run on device can be read top to bottom. Every call is a no-op outside `__DEV__` (and under
 * Jest), so the call sites can stay in place.
 */
const enabled = typeof __DEV__ !== 'undefined' && __DEV__ && !process.env.JEST_WORKER_ID;

let origin = 0;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Start a fresh run: later lines are timed from here. */
export function traceReset(label = 'run start'): void {
  if (!enabled) return;
  origin = now();
  console.log(`[creation-trace] +0ms ${label}`);
}

export function trace(label: string, data?: Record<string, unknown>): void {
  if (!enabled) return;
  if (!origin) origin = now();
  const ms = Math.round(now() - origin);
  console.log(`[creation-trace] +${ms}ms ${label}${data ? ` ${JSON.stringify(data)}` : ''}`);
}

export const creationTraceEnabled = enabled;
