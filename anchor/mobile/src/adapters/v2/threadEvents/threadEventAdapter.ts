import { apiClient } from '@/services/ApiClient';
import { V2_PRACTICE_MILESTONE_COUNTS, V2_THREAD_EVENT_PRIORITY, channelForThreadEvent, evolutionStageForPersistedThreshold, type V2PracticeCompletionType, type V2ThreadEventChannel } from '@/constants/v2/threadEvents';
import type { V2PersistedThreadEvent, V2ThreadEventBundle, V2ThreadEventIntake } from './types';

type Envelope<T> = { success: boolean; data?: T; error?: { message?: string } };
const encode = (value: string) => encodeURIComponent(value);

/** Validates server payload semantics without deriving an event from device state. */
export function classifyV2ThreadEvent(event: V2PersistedThreadEvent) {
  const persistedStage = evolutionStageForPersistedThreshold(event.metadata.thresholdValue);
  const isEvolution = event.eventType === 'EVOLUTION_STAGE_REACHED' && Boolean(persistedStage);
  const isPracticeMilestone = event.eventType === 'PRACTICE_MILESTONE_REACHED'
    && V2_PRACTICE_MILESTONE_COUNTS.includes(event.metadata.practiceCount as 10 | 25 | 50);
  return { channel: channelForThreadEvent(event), isEvolution, persistedStage, isPracticeMilestone };
}

export function intakeV2ThreadEvents(intake: V2ThreadEventIntake): V2PersistedThreadEvent[] {
  const validCompletion = !intake.completionType || (['FOCUS_SESSION', 'DEEP_PRIME_SESSION', 'VISUALIZE_SESSION'] as V2PracticeCompletionType[]).includes(intake.completionType as V2PracticeCompletionType);
  if (!validCompletion) return [];
  return intake.events.filter((event) => Boolean(event.eventId && event.ledgerSequence && event.correlationId));
}

export function bundleV2ThreadEvents(events: V2PersistedThreadEvent[]): V2ThreadEventBundle[] {
  const byCorrelation = new Map<string, V2PersistedThreadEvent[]>();
  events.forEach((event) => {
    const existing = byCorrelation.get(event.correlationId) ?? [];
    existing.push(event);
    byCorrelation.set(event.correlationId, existing);
  });
  return Array.from(byCorrelation.entries()).map(([correlationId, group]) => {
    const ordered = [...group].sort((a, b) => {
      return V2_THREAD_EVENT_PRIORITY[b.eventType] - V2_THREAD_EVENT_PRIORITY[a.eventType] || a.correlationSequence - b.correlationSequence || a.eventId.localeCompare(b.eventId);
    });
    const primary = ordered[0];
    return { bundleKey: correlationId, primary, supporting: ordered.slice(1, 3), channel: channelForThreadEvent(primary) };
  }).sort((a, b) => Number(a.primary.ledgerSequence) - Number(b.primary.ledgerSequence));
}

/** CCR-TE-01 API contract: this client is read/presentation-only and creates no domain event. */
export async function fetchV2EligibleThreadEvents(channel: V2ThreadEventChannel, signal?: AbortSignal): Promise<V2PersistedThreadEvent[]> {
  const response = await apiClient.get<Envelope<V2PersistedThreadEvent[]>>('/api/v2/thread-events/eligible', { signal, params: { channel } });
  if (!response.data.success || !response.data.data) throw new Error(response.data.error?.message ?? 'Thread Events are unavailable.');
  return response.data.data;
}

export async function claimV2ThreadEventBundle(bundle: V2ThreadEventBundle): Promise<void> {
  await apiClient.post('/api/v2/thread-events/presentation-claims', { eventIds: [bundle.primary, ...bundle.supporting].map((event) => event.eventId), channel: bundle.channel, bundleKey: bundle.bundleKey });
}

export async function updateV2ThreadEventReceipt(eventId: string, channel: V2ThreadEventChannel, status: 'PRESENTED' | 'ACKNOWLEDGED' | 'DISMISSED'): Promise<void> {
  await apiClient.post(`/api/v2/thread-events/${encode(eventId)}/presentations/${channel.toLowerCase()}`, { status });
}
