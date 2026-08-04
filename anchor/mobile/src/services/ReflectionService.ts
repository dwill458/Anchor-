import { AppState } from 'react-native';
import { apiClient, ApiClientError } from './ApiClient';
import { useAuthStore } from '@/stores/authStore';
import { useReflectionDraftStore, type ReflectionDraft } from '@/stores/reflectionDraftStore';
import { useCourseStore } from '@/stores/courseStore';
import type {
  CreateReflectionRequest,
  ReflectionRecord,
  UpdateReflectionRequest,
} from '@/types/chart';

function encodePath(value: string): string {
  return encodeURIComponent(value);
}

function responseData(value: unknown): ReflectionRecord {
  const envelope = value as { success?: boolean; data?: ReflectionRecord; error?: { code?: string; message?: string } };
  if (!envelope?.success || !envelope.data) {
    throw new ApiClientError(envelope?.error?.message ?? 'Reflection request failed', envelope?.error?.code);
  }
  return envelope.data;
}

export function isReflectionNetworkError(error: unknown): boolean {
  return !(error instanceof ApiClientError) && error instanceof Error && /network|timeout|connect/i.test(error.message);
}

export class ReflectionService {
  async create(payload: CreateReflectionRequest): Promise<ReflectionRecord> {
    // Request bodies deliberately never enter logger, analytics, breadcrumbs, or error context.
    const response = await apiClient.post('/api/reflections', payload);
    return responseData(response.data);
  }

  async update(reflectionId: string, payload: UpdateReflectionRequest): Promise<ReflectionRecord> {
    const response = await apiClient.patch(`/api/reflections/${encodePath(reflectionId)}`, payload);
    return responseData(response.data);
  }

  async delete(reflectionId: string): Promise<void> {
    const response = await apiClient.delete(`/api/reflections/${encodePath(reflectionId)}`);
    const envelope = response.data as { success?: boolean; error?: { code?: string; message?: string } };
    if (!envelope?.success) {
      throw new ApiClientError(envelope?.error?.message ?? 'Reflection delete failed', envelope?.error?.code);
    }
  }

  /**
   * Queueing is a single atomic store transition, not a content write with a
   * state field set on it. `upsert` deliberately cannot move a draft into the
   * queue, so no rerender or autosave can undo this.
   */
  async queueExplicitCreate(draft: ReflectionDraft): Promise<void> {
    await useReflectionDraftStore.getState().markQueued(draft.draftKey, draft);
  }

  /** True once the draft is durably stored as `queued` and safe to promise. */
  isQueued(draftKey: string): boolean {
    return useReflectionDraftStore.getState().drafts[draftKey]?.saveState === 'queued';
  }

  async flushQueuedCreates(accountId: string): Promise<void> {
    if (useAuthStore.getState().user?.id !== accountId) return;
    if (!useCourseStore.getState().flags.chart_reflections_enabled) return;
    const state = useReflectionDraftStore.getState();
    if (state.accountId !== accountId) return;
    for (const draft of Object.values(state.drafts)) {
      if (draft.saveState !== 'queued' || draft.tombstoned || draft.retryCount >= 3) continue;
      try {
        await this.create(draftToCreateRequest(draft));
        await useReflectionDraftStore.getState().remove(draft.draftKey);
      } catch (error) {
        const code = error instanceof ApiClientError ? error.code : undefined;
        if (code === 'IDEMPOTENCY_CONFLICT' || code === 'REFLECTION_INVALID' || code === 'FEATURE_DISABLED') {
          await useReflectionDraftStore.getState().markFailed(draft.draftKey);
          continue;
        }
        if (isReflectionNetworkError(error)) {
          await useReflectionDraftStore.getState().scheduleRetry(draft.draftKey);
          continue;
        }
        // An account/auth failure must not be replayed against a changed account.
        if (code === 'ACCOUNT_MISMATCH' || /session expired|access denied/i.test(error instanceof Error ? error.message : '')) {
          await useReflectionDraftStore.getState().remove(draft.draftKey);
        } else {
          await useReflectionDraftStore.getState().markFailed(draft.draftKey);
        }
      }
    }
  }
}

export function draftToCreateRequest(draft: ReflectionDraft): CreateReflectionRequest {
  return {
    idempotencyKey: draft.idempotencyKey,
    source: draft.source,
    promptType: draft.promptType,
    promptVersion: draft.promptVersion,
    ...(draft.body ? { body: draft.body } : {}),
    ...(draft.structuredContent ? { structuredContent: draft.structuredContent } : {}),
    ...(draft.moodBefore ? { moodBefore: draft.moodBefore } : {}),
    ...(draft.moodAfter ? { moodAfter: draft.moodAfter } : {}),
    ...(draft.practiceSessionId ? { practiceSessionId: draft.practiceSessionId } : {}),
    ...(draft.anchorId ? { anchorId: draft.anchorId } : {}),
    ...(draft.courseId ? { courseId: draft.courseId } : {}),
    ...(draft.waypointId ? { waypointId: draft.waypointId } : {}),
  };
}

export const reflectionService = new ReflectionService();

let lifecycleSubscription: { remove: () => void } | null = null;

/** Safe to call once from the Chart shell; it flushes only explicitly queued drafts. */
export function startReflectionQueueSync(): () => void {
  if (lifecycleSubscription) return () => undefined;
  const flush = () => {
    const accountId = useAuthStore.getState().user?.id;
    if (accountId) void reflectionService.flushQueuedCreates(accountId);
  };
  lifecycleSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') flush();
  });
  flush();
  return () => {
    lifecycleSubscription?.remove();
    lifecycleSubscription = null;
  };
}
