/** A transient presentation clock, never stored in the draft or AsyncStorage. */
export const ETCHING = { minimum: 4500, cycle: 1500, draw: 1200, entrance: 250, settle: 40 } as const;
const starts = new Map<string, number>();
const cuts = new Map<string, { request: () => void; resolve?: () => void }>();
/** The visible renderer acknowledges its actual finished stroke on the UI thread. */
export function registerEtchingCycle(requestId: string, request: () => void): () => void {
  const cut = { request } as { request: () => void; resolve?: () => void };
  cuts.set(requestId, cut);
  return () => { cut.resolve?.(); if (cuts.get(requestId) === cut) cuts.delete(requestId); };
}
export function requestEtchingCut(requestId: string): Promise<void> {
  const cut = cuts.get(requestId);
  // A result arriving after Back can be kept immediately: there is no visible stroke to cut.
  if (!cut) return Promise.resolve();
  return new Promise((resolve) => { cut.resolve = resolve; cut.request(); });
}
export function acknowledgeEtchingCut(requestId: string): void { cuts.get(requestId)?.resolve?.(); }
export function startEtching(requestId: string, now = Date.now()): void { starts.set(requestId, now); }
export function etchingStartedAt(requestId?: string): number { return starts.get(requestId ?? '') ?? Date.now(); }
export function finishEtching(requestId: string): void { starts.delete(requestId); }
export function etchingSample(elapsed: number): { progress: number; finished: boolean } {
  'worklet';
  const phase = Math.max(0, elapsed - ETCHING.entrance) % ETCHING.cycle;
  const t = Math.min(1, phase / ETCHING.draw);
  return { progress: t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, finished: phase >= ETCHING.draw };
}
