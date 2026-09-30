/** Session-only presentation memory. It never replaces server progress or persists inspection. */
type Visit = { progress: number; visitedAt: number };
const visits = new Map<string, Visit>();
let owner: string | null = null;
export function journeySessionKey(accountId: string | null, courseId: string): string {
  if (owner !== accountId) { visits.clear(); owner = accountId; }
  return JSON.stringify([accountId, courseId]);
}
export function rememberedJourney(key: string, actual: number, now = Date.now()): { from: number; animate: boolean } {
  const visit = visits.get(key);
  return visit && now-visit.visitedAt >= 10000 && visit.progress !== actual
    ? { from: visit.progress, animate: true } : { from: actual, animate: false };
}
export function rememberJourney(key: string, progress: number, now = Date.now()): void {
  if (JSON.parse(key)[0] !== owner) return;
  visits.delete(key);
  visits.set(key, { progress, visitedAt: now });
  if (visits.size > 32) visits.delete(visits.keys().next().value!);
}
