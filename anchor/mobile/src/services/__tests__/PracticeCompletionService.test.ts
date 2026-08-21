import { PracticeCompletionService } from '../PracticeCompletionService';
import { apiClient } from '../ApiClient';
import { AnalyticsService } from '../AnalyticsService';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useChartJourneyStore } from '@/stores/chartJourneyStore';

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

  it('does not lose a completion queued while an older queue snapshot is flushing', async () => {
    const accountId = 'account-completion-concurrent';
    useAuthStore.setState({ user: { id: accountId } as any });
    await PracticeCompletionService.completePracticeSession(
      input(accountId, 'older-session'),
      { flushImmediately: false },
    );

    let releaseOlderPost!: (value: unknown) => void;
    const olderPost = new Promise((resolve) => { releaseOlderPost = resolve; });
    let markOlderPostStarted!: () => void;
    const olderPostStarted = new Promise<void>((resolve) => { markOlderPostStarted = resolve; });
    const post = jest.spyOn(apiClient, 'post').mockImplementationOnce(() => {
      markOlderPostStarted();
      return olderPost as any;
    });
    const firstFlush = PracticeCompletionService.flush(accountId);
    await olderPostStarted;
    expect(post).toHaveBeenCalledWith(
      '/api/practice/sessions',
      expect.objectContaining({ id: 'older-session' }),
    );

    await PracticeCompletionService.completePracticeSession(
      input(accountId, 'newer-session'),
      { flushImmediately: false },
    );
    releaseOlderPost({ data: { success: true } });
    await firstFlush;

    post.mockResolvedValueOnce({ data: { success: true } } as any);
    await PracticeCompletionService.flush(accountId);
    expect(post.mock.calls.map(([, body]) => (body as any).id)).toEqual([
      'older-session',
      'newer-session',
    ]);
    expect(useSessionStore.getState().practiceHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'older-session', syncState: 'synced' }),
      expect.objectContaining({ id: 'newer-session', syncState: 'synced' }),
    ]));
  });

  it('refuses cross-account writes', async () => {
    await expect(
      PracticeCompletionService.completePracticeSession(input('another-account')),
    ).rejects.toThrow('active account');
    expect(useSessionStore.getState().practiceHistory).toEqual([]);
  });

  it('does not rebind or mark the prior account after an account switch during a durable write', async () => {
    useAuthStore.setState({ user: { id: 'account-a' } as any });
    await useChartJourneyStore.getState().bindAccount('account-a');
    useChartJourneyStore.getState().markFirstAnchorCreated('anchor-1');

    let releaseWrite!: () => void;
    const writePending = new Promise<void>((resolve) => { releaseWrite = resolve; });
    jest.spyOn(PracticeCompletionService, 'queueCanonicalCompletion').mockReturnValue(writePending);

    const completion = PracticeCompletionService.completePracticeSession(
      input('account-a', 'account-switch-session'),
      { flushImmediately: false },
    );
    useAuthStore.setState({ user: { id: 'account-b' } as any });
    await useChartJourneyStore.getState().bindAccount('account-b');
    releaseWrite();
    await completion;

    expect(useChartJourneyStore.getState().accountId).toBe('account-b');
    expect(useChartJourneyStore.getState().newUserIntroStage).toBe('not_eligible');
  });
});
