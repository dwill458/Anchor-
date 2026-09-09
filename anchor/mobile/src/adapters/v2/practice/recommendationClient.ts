import { apiClient } from '@/services/ApiClient';
import type { V2RecommendationAction } from '@/constants/v2/practice';

export type V2RecommendationSignalType = 'destination_reached' | 'waypoint_reached' | 'intention_completed';

export type V2RecommendationContext = {
  anchorId: string;
  completionSignal: { id: string; type: V2RecommendationSignalType; occurredAt: string } | null;
  vision: { exists: boolean; seenToday: boolean; visionId?: string | null };
  thread: { delta7d: number | null; delta7dStatus: 'AVAILABLE' | 'UNAVAILABLE'; status: 'AVAILABLE' | 'UNAVAILABLE'; blockerReason?: string };
  recommendation: { action: V2RecommendationAction; reason: string };
};

type Envelope<T> = { success: boolean; data?: T; error?: { message?: string } };

const encode = (value: string) => encodeURIComponent(value);

/** GET is deliberately non-consuming: never acknowledge from this read path. */
export async function fetchV2RecommendationContext(anchorId: string, signal?: AbortSignal): Promise<V2RecommendationContext> {
  const response = await apiClient.get<Envelope<V2RecommendationContext>>(
    `/api/v2/anchors/${encode(anchorId)}/recommendation-context`,
    { signal, params: { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } },
  );
  if (!response.data.success || !response.data.data) throw new Error(response.data.error?.message ?? 'Recommendation is unavailable.');
  return response.data.data;
}

/** This is intentionally called only from an explicit recommendation engagement/dismissal handler. */
export async function acknowledgeV2RecommendationSignal(anchorId: string, signalId: string, signalType: V2RecommendationSignalType): Promise<void> {
  await apiClient.post(`/api/v2/anchors/${encode(anchorId)}/recommendation-signals/${encode(signalId)}/ack`, { signalType });
}
