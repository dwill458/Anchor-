// Lab-only. Fixed numeric phases/fields; no identifiers or payload contents.
let sequence = 0;
export const labNow = () => global.performance?.now?.() ?? Date.now();
const nativeSamples: Array<{ kind: number; depth: number; nativeElapsedMs: number }> = [];
export function labEvent(phase: number, data: Record<string, number> = {}) {
  if (phase === 7) {
    if (nativeSamples.length < 30000) nativeSamples.push(data as { kind: number; depth: number; nativeElapsedMs: number });
    return;
  }
  console.warn('[PERF003]', JSON.stringify({ phase, t: labNow(), ...data }));
}
export function flushNativeSamples() {
  for (const kind of [1,2,3]) {
    const samples = nativeSamples.filter(x=>x.kind===kind), times=samples.map(x=>x.nativeElapsedMs).sort((a,b)=>a-b);
    if(times.length) labEvent(21,{kind, calls:times.length, p50Ms:times[Math.floor((times.length-1)*0.5)],
      p95Ms:times[Math.floor((times.length-1)*0.95)], maxMs:times[times.length-1],
      maxDepth:Math.max(...samples.map(x=>x.depth))});
  }
  nativeSamples.length=0;
}
export function labSpan(phase: number) {
  const op = ++sequence, start = labNow();
  labEvent(phase, { op, edge: 0 });
  return () => labEvent(phase, { op, edge: 1, durationMs: labNow()-start });
}
