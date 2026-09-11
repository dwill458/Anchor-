import { apiClient } from '@/services/ApiClient';
import type { WeeklyInsightFeedbackRating } from '@/constants/v2/weeklyInsightRoutes';
import type { WeeklyInsightSnapshot } from './types';

type Envelope<T> = { success: boolean; data?: T; error?: { message?: string } };
const unwrap = <T,>(payload: Envelope<T>): T => { if (!payload.success || payload.data === undefined) throw new Error(payload.error?.message ?? 'Weekly Insight is unavailable.'); return payload.data; };

/** Persisted snapshot history is the only production archive source. */
export async function fetchWeeklyInsightHistory(anchorId?: string): Promise<WeeklyInsightSnapshot[]> {
  const response = await apiClient.get<Envelope<WeeklyInsightSnapshot[]>>('/api/v2/weekly-insights', { params: anchorId ? { anchorId } : undefined });
  return unwrap(response.data);
}
/** The device requests generation but never submits facts or a narrative. */
export async function generateWeeklyInsightSnapshot(anchorId?: string): Promise<WeeklyInsightSnapshot> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const response = await apiClient.post<Envelope<WeeklyInsightSnapshot>>('/api/v2/weekly-insights/generate', { anchorId: anchorId ?? null, timeZone });
  return unwrap(response.data);
}
export async function persistWeeklyInsightFeedback(snapshotId: string, rating: WeeklyInsightFeedbackRating): Promise<void> {
  const response = await apiClient.post<Envelope<unknown>>(`/api/v2/weekly-insights/${encodeURIComponent(snapshotId)}/feedback`, { rating });
  unwrap(response.data);
}
