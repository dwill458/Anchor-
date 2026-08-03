import { apiClient } from '../ApiClient';
import { reflectionService } from '../ReflectionService';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useReflectionDraftStore, type ReflectionDraft } from '@/stores/reflectionDraftStore';

const queuedDraft: ReflectionDraft = {
  draftKey: 'queued-draft', accountId: 'account-1', source: 'MANUAL_COURSE', promptType: 'COURSE_STATUS', promptVersion: 1,
  courseId: 'course-1', body: 'private writing', updatedAt: new Date().toISOString(), saveState: 'draft', retryCount: 0, idempotencyKey: 'stable-idempotency-key',
};

describe('ReflectionService queued creates', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    useAuthStore.setState({ user: { id: 'account-1' } as never });
    useCourseStore.setState({ flags: { chart_enabled: true, chart_write_enabled: true, chart_ai_planner_enabled: false, chart_reflections_enabled: true, chart_notifications_enabled: false, chart_existing_user_intro_enabled: false } });
    useReflectionDraftStore.setState({ accountId: 'account-1', hydrated: true, drafts: {}, handledOfferKeys: [] });
  });

  it('queues only after an explicit create and preserves the stable idempotency key across retry', async () => {
    await reflectionService.queueExplicitCreate(queuedDraft);
    expect(useReflectionDraftStore.getState().drafts['queued-draft']).toMatchObject({ saveState: 'queued', idempotencyKey: 'stable-idempotency-key' });
    jest.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Network error'));
    await reflectionService.flushQueuedCreates('account-1');
    expect(useReflectionDraftStore.getState().drafts['queued-draft']).toMatchObject({ saveState: 'queued', retryCount: 1, idempotencyKey: 'stable-idempotency-key' });
    jest.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: { success: true, data: { id: 'reflection-1' } } } as never);
    await reflectionService.flushQueuedCreates('account-1');
    expect(apiClient.post).toHaveBeenLastCalledWith('/api/reflections', expect.objectContaining({ idempotencyKey: 'stable-idempotency-key' }));
    expect(useReflectionDraftStore.getState().drafts['queued-draft']).toBeUndefined();
  });

  it('does not flush queued creates while reflection creation is disabled', async () => {
    await reflectionService.queueExplicitCreate(queuedDraft);
    useCourseStore.setState((state) => ({ flags: { ...state.flags, chart_reflections_enabled: false } }));
    const post = jest.spyOn(apiClient, 'post');
    await reflectionService.flushQueuedCreates('account-1');
    expect(post).not.toHaveBeenCalled();
    expect(useReflectionDraftStore.getState().drafts['queued-draft'].saveState).toBe('queued');
  });

  it('never puts update or delete requests into the create queue', async () => {
    jest.spyOn(apiClient, 'patch').mockResolvedValueOnce({ data: { success: true, data: { id: 'reflection-1' } } } as never);
    jest.spyOn(apiClient, 'delete').mockResolvedValueOnce({ data: { success: true, data: { deleted: true } } } as never);
    await reflectionService.update('reflection-1', { body: 'edited' });
    await reflectionService.delete('reflection-1');
    expect(useReflectionDraftStore.getState().drafts).toEqual({});
  });
});
