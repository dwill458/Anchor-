import { useSessionStore } from '@/stores/sessionStore';
import type { V2RecommendationContext } from './recommendationClient';

/**
 * In-memory read-through cache for the per-Anchor recommendation context.
 *
 * Home, Anchor Details and Practice all read the same context for the same
 * Anchor. Before this cache each of them mounted with nothing, drew a
 * "Loading today's practice" placeholder and swapped the full Today card in
 * after the request, which moved everything below it by a card's height just
 * after the navigation transition finished.
 *
 * Screens seed their first render from `peek` and revalidate in the
 * background. An entry is only "fresh" (skip the request entirely) for a short
 * window and only while no practice has been recorded since it was fetched,
 * because a completed session is exactly what changes the recommendation.
 *
 * Kept in its own module so tests that mock the client still see a real,
 * empty cache.
 */

export const V2_RECOMMENDATION_FRESH_MS = 30_000;

type Entry = { value: V2RecommendationContext; fetchedAt: number; practiceMarker: string };

const entries = new Map<string, Entry>();

function currentPracticeMarker(): string {
  try {
    const state = useSessionStore.getState();
    return `${state.lastSession?.id ?? ''}:${state.practiceHistory?.length ?? 0}`;
  } catch {
    return '';
  }
}

export function rememberV2RecommendationContext(anchorId: string, value: V2RecommendationContext): void {
  const entry = { value, fetchedAt: Date.now(), practiceMarker: currentPracticeMarker() };
  entries.set(anchorId, entry);
  if (value.anchorId && value.anchorId !== anchorId) entries.set(value.anchorId, entry);
}

/** The last context seen for this Anchor, at any age. */
export function peekV2RecommendationContext(anchorId: string | null | undefined): V2RecommendationContext | null {
  if (!anchorId) return null;
  return entries.get(anchorId)?.value ?? null;
}

/** True when the cached context can be shown without asking the server again. */
export function isV2RecommendationContextFresh(anchorId: string | null | undefined): boolean {
  if (!anchorId) return false;
  const entry = entries.get(anchorId);
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < V2_RECOMMENDATION_FRESH_MS && entry.practiceMarker === currentPracticeMarker();
}

export function invalidateV2RecommendationContext(anchorId?: string): void {
  if (anchorId) entries.delete(anchorId);
  else entries.clear();
}
