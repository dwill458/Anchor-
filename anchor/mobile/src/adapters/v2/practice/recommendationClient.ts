import { apiClient } from '@/services/ApiClient';
import { useAuthStore } from '@/stores/authStore';
import { HomeStartupProfiler } from '@/utils/homeStartupProfiler';
import type { V2RecommendationAction } from '@/constants/v2/practice';
import {
  invalidateV2RecommendationContext,
  isV2RecommendationContextFresh,
  peekV2RecommendationContext,
  rememberV2RecommendationContext,
} from './recommendationCache';

export type V2RecommendationSignalType = 'destination_reached' | 'waypoint_reached' | 'intention_completed';

export type V2RecommendationContext = {
  anchorId: string;
  completionSignal: { id: string; type: V2RecommendationSignalType; occurredAt: string } | null;
  vision: { exists: boolean; seenToday: boolean; visionId?: string | null };
  thread: {
    strength?: number;
    delta7d: number | null;
    delta7dStatus: 'AVAILABLE' | 'UNAVAILABLE';
    status: 'AVAILABLE' | 'UNAVAILABLE';
    blockerReason?: string;
  };
  recommendation: { action: V2RecommendationAction; reason: string };
};

type Envelope<T> = { success: boolean; data?: T; error?: { message?: string } };

const encode = (value: string) => encodeURIComponent(value);

const inFlight = new Map<string, Promise<V2RecommendationContext>>();

/** GET is deliberately non-consuming: never acknowledge from this read path. */
export async function fetchV2RecommendationContext(anchorId: string, signal?: AbortSignal): Promise<V2RecommendationContext> {
  const accountId = useAuthStore.getState().user?.id ?? null;
  const requestKey = `${accountId ?? 'anonymous'}:${anchorId}`;
  const existing = inFlight.get(requestKey);
  if (existing) return existing;

  const span = HomeStartupProfiler.start('today_recommendation_request', { anchorId });
  const request = apiClient.get<Envelope<V2RecommendationContext>>(
    `/api/v2/anchors/${encode(anchorId)}/recommendation-context`,
    { signal, params: { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } },
  ).then((response) => {
    span({ ok: response.data.success, serverTiming: String(response.headers?.['server-timing'] ?? '') || null });
    if (!response.data.success || !response.data.data) throw new Error(response.data.error?.message ?? 'Recommendation is unavailable.');
    rememberV2RecommendationContext(anchorId, response.data.data, accountId);
    return response.data.data;
  }, (error: unknown) => {
    span({ ok: false });
    throw error;
  }).finally(() => {
    inFlight.delete(requestKey);
  });

  inFlight.set(requestKey, request);
  return request;
}

/** Pre-warms cache in the background; never throws on failure. */
export async function prefetchV2RecommendationContext(anchorId: string, signal?: AbortSignal): Promise<V2RecommendationContext | null> {
  if (!anchorId) return null;
  if (isV2RecommendationContextFresh(anchorId)) return peekV2RecommendationContext(anchorId);
  try {
    return await fetchV2RecommendationContext(anchorId, signal);
  } catch {
    return peekV2RecommendationContext(anchorId);
  }
}

/** Pre-warms multiple anchors, preferring batch route with concurrent fallback. */
export async function fetchV2RecommendationContextBatch(anchorIds: string[], signal?: AbortSignal): Promise<V2RecommendationContext[]> {
  const ids = Array.from(new Set(anchorIds.filter(Boolean)));
  if (ids.length === 0) return [];
  const needed = ids.filter((id) => !isV2RecommendationContextFresh(id));
  if (needed.length === 0) {
    return ids.map((id) => peekV2RecommendationContext(id)).filter((c): c is V2RecommendationContext => Boolean(c));
  }
  try {
    const response = await apiClient.get<Envelope<V2RecommendationContext[]>>(
      '/api/v2/recommendations/batch',
      { signal, params: { anchorIds: needed.join(','), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } },
    );
    if (response.data.success && Array.isArray(response.data.data)) {
      response.data.data.forEach((context) => {
        if (context.anchorId) rememberV2RecommendationContext(context.anchorId, context);
      });
      return ids.map((id) => peekV2RecommendationContext(id)).filter((c): c is V2RecommendationContext => Boolean(c));
    }
  } catch {
    // Fallback to concurrent single fetches
  }
  await Promise.allSettled(needed.map((id) => prefetchV2RecommendationContext(id, signal)));
  return ids.map((id) => peekV2RecommendationContext(id)).filter((c): c is V2RecommendationContext => Boolean(c));
}

/** This is intentionally called only from an explicit recommendation engagement/dismissal handler. */
export async function acknowledgeV2RecommendationSignal(anchorId: string, signalId: string, signalType: V2RecommendationSignalType): Promise<void> {
  await apiClient.post(`/api/v2/anchors/${encode(anchorId)}/recommendation-signals/${encode(signalId)}/ack`, { signalType });
  // An acknowledged signal changes what the next read returns.
  invalidateV2RecommendationContext(anchorId);
}
