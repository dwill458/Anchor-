import { apiClient } from '@/services/ApiClient';
import { isWeeklyRecap, type WeeklyRecapEnvelope, type WeeklyRecapHistoryItem } from './types';

export type RecapErrorKind = 'disabled' | 'not_available' | 'offline' | 'invalid' | 'unknown';
export class WeeklyRecapRequestError extends Error {
  constructor(public readonly kind: RecapErrorKind, message: string) { super(message); }
}

export const deviceTimeZone = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
};

type Envelope<T> = { success: boolean; data?: T; error?: { code?: string; message?: string } };

function classify(error: unknown): WeeklyRecapRequestError {
  const e = error as { response?: { status?: number; data?: { error?: { code?: string } } }; code?: string; message?: string };
  const code = e?.response?.data?.error?.code;
  if (code === 'FEATURE_DISABLED') return new WeeklyRecapRequestError('disabled', 'Weekly Insight 2.0 is not enabled.');
  if (code === 'WEEK_NOT_AVAILABLE') return new WeeklyRecapRequestError('not_available', 'That week is not available yet.');
  if (!e?.response) return new WeeklyRecapRequestError('offline', 'You appear to be offline.');
  return new WeeklyRecapRequestError('unknown', e?.message ?? 'Weekly Insight is unavailable.');
}

/** `null` recap = the account has no history yet (first-week empty state). */
export async function fetchWeeklyRecap(weekKey: 'latest' | string): Promise<WeeklyRecapEnvelope | null> {
  try {
    const response = await apiClient.get<Envelope<{ id?: string; recap: unknown; feedback?: string | null; updatedAt?: string; reason?: string }>>(
      `/api/v2/weekly-recap/${encodeURIComponent(weekKey)}`, { params: { timeZone: deviceTimeZone() } });
    const body = response.data;
    if (!body.success || !body.data) throw new WeeklyRecapRequestError('unknown', body.error?.message ?? 'Weekly Insight is unavailable.');
    if (body.data.recap === null) return null;
    if (!isWeeklyRecap(body.data.recap)) throw new WeeklyRecapRequestError('invalid', 'This recap could not be read.');
    return { id: body.data.id ?? body.data.recap.weekKey, recap: body.data.recap, feedback: body.data.feedback ?? null, updatedAt: body.data.updatedAt ?? '' };
  } catch (error) {
    throw error instanceof WeeklyRecapRequestError ? error : classify(error);
  }
}

export async function fetchWeeklyRecapHistory(before?: string): Promise<{ items: WeeklyRecapHistoryItem[]; nextCursor: string | null }> {
  try {
    const response = await apiClient.get<Envelope<{ items: WeeklyRecapHistoryItem[]; nextCursor: string | null }>>('/api/v2/weekly-recaps', { params: { limit: 26, ...(before ? { before } : {}) } });
    if (!response.data.success || !response.data.data) throw new WeeklyRecapRequestError('unknown', 'History is unavailable.');
    return response.data.data;
  } catch (error) {
    throw error instanceof WeeklyRecapRequestError ? error : classify(error);
  }
}
