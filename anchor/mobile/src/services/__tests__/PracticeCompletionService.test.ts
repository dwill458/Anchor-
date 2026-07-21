import { PracticeCompletionService } from '../PracticeCompletionService';
import { apiClient } from '../ApiClient';
import { AnalyticsService } from '../AnalyticsService';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';

const input = (accountId: string, sessionId = 'stable-session') => ({
  sessionId,
  accountId,
  anchorId: 'anchor-1',
  anchorLocalId: 'anchor-1',
  anchorServerId: 'anchor-1',
  mode: 'release' as const,
  plannedDurationSeconds: 45,
  actualDurationSeconds: 45,
  startedAt: '2026-07-21T12:00:00.000Z',
  completedAt: '2026-07-21T12:00:45.000Z',
  source: 'anchor_detail' as const,
  guidanceVoice: 'none' as const,
  backgroundAudio: 'off' as const,
});

describe('PracticeCompletionService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    useSessionStore.getState().reset();
    useAuthStore.setState({ user: { id: 'account-completion-test' } as any });
  });

  it('records and queues one durable event for repeated completion callbacks', async () => {
    useAuthStore.setState({ user: { id: 'account-completion-a' } as any });
    const track = jest.spyOn(AnalyticsService, 'track').mockImplementation(() => undefined);
    const first = await PracticeCompletionService.completePracticeSession(
      input('account-completion-a'),
      { flushImmediately: false },
    );
    const second = await PracticeCompletionService.completePracticeSession(
      input('account-completion-a'),
      { flushImmediately: false },
    );

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(useSessionStore.getState().practiceHistory).toHaveLength(1);
    expect(useSessionStore.getState().practiceHistory[0]).toEqual(expect.objectContaining({
      id: 'stable-session', practiceMode: 'release', localDateKey: '2026-07-21',
    }));
    expect(track.mock.calls.filter(([name]) => name === 'practice_session_completed')).toHaveLength(1);
  });

  it('retains an offline event and retries the identical ID', async () => {
    useAuthStore.setState({ user: { id: 'account-completion-b' } as any });
    await PracticeCompletionService.completePracticeSession(
      input('account-completion-b', 'offline-session'),
      { flushImmediately: false },
    );
    const post = jest.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('offline'));
    await PracticeCompletionService.flush('account-completion-b');
    expect(post).toHaveBeenCalledWith('/api/practice/sessions', expect.objectContaining({ id: 'offline-session' }));
    expect(useSessionStore.getState().practiceHistory[0].syncState).not.toBe('synced');

    post.mockResolvedValueOnce({ data: { success: true } } as any);
    await PracticeCompletionService.flush('account-completion-b');
    expect(post.mock.calls.filter(([, body]) => (body as any).id === 'offline-session')).toHaveLength(2);
    expect(useSessionStore.getState().practiceHistory[0].syncState).toBe('synced');
  });

  it('refuses cross-account writes', async () => {
    await expect(
      PracticeCompletionService.completePracticeSession(input('another-account')),
    ).rejects.toThrow('active account');
    expect(useSessionStore.getState().practiceHistory).toEqual([]);
  });
});
