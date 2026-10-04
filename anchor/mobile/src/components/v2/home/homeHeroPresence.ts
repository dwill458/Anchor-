import type { PracticeSessionRecord } from '@/types/practice';
import { localDateString } from '@/utils/primingAnalytics';

/**
 * The Home hero's presence: its light, its status ring and its entrance. All of it is
 * presentation. Nothing here decides what the user should practise or how strong a thread is.
 */

/** Metallic gold taken from the foil expression, so the ring and the foil line read as one material. */
export const HERO_GOLD = '#B08A48';
export const HERO_GOLD_LIGHT = '#E2CB92';

/**
 * Entrance timing. The prototype pace is deliberately slowed (see feedback_prototype_timing_too_fast):
 * the draw-on is the ~1s the brief asks for, the ground settles beneath it, and the ring starts once
 * the line has landed so the eye has one thing to follow at a time.
 */
export const HERO_ENTRANCE = {
  /** Home's first mount stalls the JS thread; starting a beat later keeps that stall out of the animation. */
  startDelayMs: 200,
  drawMs: 1100,
  drawDelayMs: 120,
  groundMs: 900,
  /** A raster coin is held back until its image has loaded, but never longer than this. */
  imageWaitMs: 600,
  ringDelayMs: 1300,
  ringMs: 1100,
  /** How long until the entrance props can be dropped and the coin renders in its steady state. */
  settleMs: 1600,
} as const;

/** Ring sits this far outside the paper mount, and is this thick. Hairline: it is status, not frame. */
export const HERO_RING = { gap: 8, stroke: 1.6 } as const;

/** Halo is this multiple of the coin's diameter. The gradient is gone well before the edge. */
export const HERO_HALO_SCALE = 1.5;

/** A cold start shows the entrance once. Swiping the carousel or coming back from a screen must not replay it. */
let entrancePlayed = false;
export function hasHeroEntrancePlayed(): boolean {
  return entrancePlayed;
}
export function markHeroEntrancePlayed(): void {
  entrancePlayed = true;
}
/** Test seam. */
export function resetHeroEntranceForTests(): void {
  entrancePlayed = false;
}

/**
 * The keys (id, server id, local id) of every Anchor with a completed session on the local calendar
 * day of `now`. One pass over the history, so Home can ask per Anchor without re-filtering sessions.
 * Scoped to the signed-in account: a previous account's sessions on this device never light a ring.
 */
export function anchorsPracticedToday(
  sessions: readonly PracticeSessionRecord[],
  accountId: string | null,
  now: Date = new Date(),
): Set<string> {
  const keys = new Set<string>();
  if (!accountId) return keys;
  const today = localDateString(now);
  for (const session of sessions) {
    if (session.accountId !== accountId) continue;
    const completed = new Date(session.completedAt);
    if (Number.isNaN(completed.getTime()) || localDateString(completed) !== today) continue;
    if (session.anchorId) keys.add(session.anchorId);
    if (session.anchorServerId) keys.add(session.anchorServerId);
    if (session.anchorLocalId) keys.add(session.anchorLocalId);
  }
  return keys;
}

export function hasPracticedToday(
  practicedKeys: ReadonlySet<string>,
  anchor: { id: string; localId?: string | null },
): boolean {
  return practicedKeys.has(anchor.id) || Boolean(anchor.localId && practicedKeys.has(anchor.localId));
}

/**
 * How much warmth the halo carries, 0..1, from the Anchor's Consistency (Thread Strength).
 * An unmeasured Anchor is not "cold" — it sits at a quiet baseline, so a new Anchor still has light
 * and the first practice makes it brighter rather than switching it on.
 */
export function heroWarmth(strength: number | null | undefined): number {
  if (typeof strength !== 'number' || !Number.isFinite(strength)) return 0.25;
  return 0.25 + 0.75 * Math.min(1, Math.max(0, strength / 100));
}
