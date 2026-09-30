/** A transient presentation clock, never stored in the draft or AsyncStorage. */
export const ETCHING = { minimum: 4500, cycle: 1500, draw: 1200, entrance: 250, settle: 40 } as const;
const starts = new Map<string, number>();
export function startEtching(requestId: string, now = Date.now()): void { starts.set(requestId, now); }
export function etchingStartedAt(requestId?: string): number { return starts.get(requestId ?? '') ?? Date.now(); }
export function finishEtching(requestId: string): void { starts.delete(requestId); }
/** The next finished stroke's hold, after the minimum performance duration. */
export function etchingRevealDelay(elapsed: number): number {
  const target = Math.max(ETCHING.minimum, elapsed);
  const phase = ((target - ETCHING.entrance) % ETCHING.cycle + ETCHING.cycle) % ETCHING.cycle;
  return target - elapsed + Math.max(0, ETCHING.draw - phase) + ETCHING.settle;
}
