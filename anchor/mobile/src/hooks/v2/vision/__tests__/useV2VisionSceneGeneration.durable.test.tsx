import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

const mockSecureValues = new Map<string, string>();
const mockReadSecureValue = jest.fn(async (key: string) => mockSecureValues.get(key) ?? null);
const mockWriteSecureValue = jest.fn(async (key: string, value: string) => { mockSecureValues.set(key, value); });
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();

jest.mock('@/stores/encryptedPersistStorage', () => ({
  readSecureValue: (...args: unknown[]) => mockReadSecureValue(...args as [string]),
  writeSecureValue: (...args: unknown[]) => mockWriteSecureValue(...args as [string, string]),
}));

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
  ApiClientError: class MockApiClientError extends Error {
    code?: string;
    status?: number;
    constructor(message: string, code?: string, status?: number) { super(message); this.code = code; this.status = status; }
  },
}));

jest.mock('@/stores/authStore', () => {
  const { create } = jest.requireActual('zustand');
  return { useAuthStore: create(() => ({ user: { id: 'owner-a' } })) };
});

jest.mock('expo-crypto', () => ({ randomUUID: () => 'durable-scene-id' }));
jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));

import { useAuthStore } from '@/stores/authStore';
import { useV2VisionSceneGeneration } from '../useV2VisionSceneGeneration';

const envelope = <T,>(data: T) => ({ data: { success: true, data } });
const makeSession = (id: string, imageUrl = 'https://cdn.example.test/reference-expired.jpg') => ({
  id, anchorId: 'anchor-1', visionId: 'vision-1', status: 'ACTIVE' as const,
  description: 'A scene beside the sea', draftPrompt: '', selectedCandidateId: null, viewedRoundId: null,
  references: [{ assetId: 'asset-reference-1', role: 'place' as const, imageUrl }], rounds: [],
  expiresAt: '2026-10-21T00:00:00.000Z',
});
const runningJob = {
  id: 'scene-job-1', kind: 'SCENE' as const, visionId: 'vision-1', anchorId: 'anchor-1', setNumber: 1,
  retryCount: 0, status: 'RUNNING' as const, stage: 'creating_images', error: null,
  candidates: [{ id: 'candidate-1', assetId: 'asset-result-1', role: 'vision', prompt: '', sortOrder: 0,
    status: 'SUCCEEDED' as const, imageUrl: 'https://cdn.example.test/result-old.jpg' }],
};
const options = { operation: 'CREATE' as const, references: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => { resolve = nextResolve; reject = nextReject; });
  return { promise, resolve, reject };
}

describe('useV2VisionSceneGeneration durable requests and foreground recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureValues.clear();
    mockReadSecureValue.mockImplementation(async key => mockSecureValues.get(key) ?? null);
    mockWriteSecureValue.mockImplementation(async (key, value) => { mockSecureValues.set(key, value); });
    mockGet.mockResolvedValue(envelope(null));
    mockPatch.mockResolvedValue(envelope(null));
    useAuthStore.setState({ user: { id: 'owner-a' } as never });
  });

  it('reuses the same persisted idempotency key when a network failure is retried', async () => {
    let serverSession: ReturnType<typeof makeSession> | null = null;
    mockGet.mockImplementation(async (url: string) => envelope(url.endsWith('/creation-sessions') ? serverSession : null));
    mockPost.mockImplementation(async (url: string, body: Record<string, unknown>) => {
      if (url.endsWith('/creation-sessions')) {
        serverSession = makeSession(String(body.id));
        return envelope(serverSession);
      }
      if (url.endsWith('/scene-generation')) {
        if (sceneRequests++ === 0) throw new Error('socket closed after request was sent');
        return envelope(runningJob);
      }
      throw new Error(`Unexpected endpoint: ${url}`);
    });
    let sceneRequests = 0;
    const hook = renderHook(() => useV2VisionSceneGeneration('anchor-1'));
    await waitFor(() => expect(hook.result.current.conversation.loaded).toBe(true));

    await act(async () => { expect(await hook.result.current.start('A quiet morning at the beach', null, null, options)).toBe(false); });
    const sceneCalls = mockPost.mock.calls.filter(([url]) => String(url).endsWith('/scene-generation'));
    const firstKey = sceneCalls[0][1].idempotencyKey;
    expect(firstKey).toBe('vision-scene-durable-scene-id');
    expect(JSON.parse([...mockSecureValues.values()][0]).pending).toMatchObject({ fingerprint: expect.any(String), key: firstKey });

    await act(async () => { expect(await hook.result.current.start('A quiet morning at the beach', null, null, options)).toBe(true); });
    const retriedCalls = mockPost.mock.calls.filter(([url]) => String(url).endsWith('/scene-generation'));
    expect(retriedCalls.map(([, body]) => body.idempotencyKey)).toEqual([firstKey, firstKey]);
  });

  it('restores an unaccepted pending request across hook remount and retries with the durable key', async () => {
    let serverSession: ReturnType<typeof makeSession> | null = null;
    let sceneRequests = 0;
    mockGet.mockImplementation(async (url: string) => envelope(url.endsWith('/creation-sessions') ? serverSession : null));
    mockPost.mockImplementation(async (url: string, body: Record<string, unknown>) => {
      if (url.endsWith('/creation-sessions')) {
        serverSession = makeSession(String(body.id));
        return envelope(serverSession);
      }
      if (url.endsWith('/scene-generation')) {
        if (sceneRequests++ === 0) throw new Error('connection lost before acknowledgement');
        return envelope(runningJob);
      }
      throw new Error(`Unexpected endpoint: ${url}`);
    });

    const first = renderHook(() => useV2VisionSceneGeneration('anchor-1'));
    await waitFor(() => expect(first.result.current.conversation.loaded).toBe(true));
    await act(async () => { expect(await first.result.current.start('A quiet morning at the beach', null, null, options)).toBe(false); });
    const firstKey = mockPost.mock.calls.find(([url]) => String(url).endsWith('/scene-generation'))?.[1].idempotencyKey;
    first.unmount();

    const restored = renderHook(() => useV2VisionSceneGeneration('anchor-1'));
    await waitFor(() => expect(restored.result.current.conversation.session?.id).toBe('durable-scene-id'));
    await act(async () => { expect(await restored.result.current.start('A quiet morning at the beach', null, null, options)).toBe(true); });
    const sceneCalls = mockPost.mock.calls.filter(([url]) => String(url).endsWith('/scene-generation'));
    expect(sceneCalls.map(([, body]) => body.idempotencyKey)).toEqual([firstKey, firstKey]);
  });

  it('discards a successful start response when its owner changes before it returns', async () => {
    const response = deferred<ReturnType<typeof envelope>>();
    mockGet.mockResolvedValue(envelope(null));
    mockPost.mockReturnValue(response.promise);
    const hook = renderHook(() => useV2VisionSceneGeneration('anchor-1'));
    await waitFor(() => expect(hook.result.current.conversation.loaded).toBe(true));

    let started!: Promise<boolean>;
    await act(async () => { started = hook.result.current.start('A private scene for owner A'); await Promise.resolve(); });
    expect(mockPost).toHaveBeenCalledTimes(1);
    const requestConfig = mockPost.mock.calls[0][2];
    act(() => useAuthStore.setState({ user: { id: 'owner-b' } as never }));
    expect(requestConfig.anchorAuthGuard()).toBe(false);

    await act(async () => {
      response.resolve(envelope(runningJob));
      expect(await started).toBe(false);
    });
    expect(hook.result.current.job).toBeNull();
  });

  it('hides an accepted owner A job immediately and ignores its stale refresh failure after switching to B', async () => {
    const staleRefresh = deferred<ReturnType<typeof envelope>>();
    mockGet.mockImplementation((url: string) => {
      if (url.endsWith('/creation-sessions')) return Promise.resolve(envelope(null));
      if (url.endsWith('/scene-generation/scene-job-1')) return staleRefresh.promise;
      throw new Error(`Unexpected endpoint: ${url}`);
    });
    mockPost.mockResolvedValue(envelope(runningJob));

    const hook = renderHook(() => useV2VisionSceneGeneration('anchor-1'));
    await waitFor(() => expect(hook.result.current.conversation.loaded).toBe(true));
    await act(async () => { expect(await hook.result.current.start('A private owner A scene')).toBe(true); });
    expect(hook.result.current.job?.id).toBe('scene-job-1');

    let refreshing!: Promise<void>;
    act(() => { refreshing = hook.result.current.refresh(); });
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(
      '/api/v2/anchors/anchor-1/vision/scene-generation/scene-job-1',
      expect.objectContaining({ anchorAuthGuard: expect.any(Function) }),
    ));
    act(() => useAuthStore.setState({ user: { id: 'owner-b' } as never }));
    expect(hook.result.current.job).toBeNull();
    expect(hook.result.current.error).toBeNull();

    await act(async () => {
      staleRefresh.reject(new Error('owner A refresh failed after switch'));
      await refreshing;
    });
    expect(hook.result.current.job).toBeNull();
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.conversation.owner).toBe('owner-b');
  });

  it('refreshes signed URLs and resumes job polling when the app returns to foreground', async () => {
    jest.useFakeTimers();
    const listeners: Array<(state: string) => void> = [];
    const appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((...args: unknown[]) => {
      listeners.push(args[1] as (state: string) => void);
      return { remove: jest.fn() } as never;
    });
    const saved = makeSession('session-existing');
    const refreshed = makeSession('session-existing', 'https://cdn.example.test/reference-fresh.jpg');
    let sessionReads = 0;
    mockGet.mockImplementation(async (url: string) => {
      if (url.endsWith('/creation-sessions')) return envelope(++sessionReads >= 3 ? refreshed : saved);
      if (url.endsWith('/scene-generation/scene-job-1')) {
        return envelope({ ...runningJob, candidates: [{ ...runningJob.candidates[0], imageUrl: 'https://cdn.example.test/result-fresh.jpg' }] });
      }
      throw new Error(`Unexpected endpoint: ${url}`);
    });
    mockPost.mockImplementation(async (url: string) => {
      if (url.endsWith('/scene-generation')) return envelope(runningJob);
      throw new Error(`Unexpected endpoint: ${url}`);
    });

    try {
      const hook = renderHook(() => useV2VisionSceneGeneration('anchor-1'));
      await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
      expect(hook.result.current.conversation.session?.references[0].imageUrl).toBe('https://cdn.example.test/reference-expired.jpg');
      await act(async () => { expect(await hook.result.current.start('A new scene by the water', null, null, { operation: 'EDIT', sessionId: saved.id })).toBe(true); });
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });

      act(() => listeners.forEach(listener => listener('background')));
      const jobReadsBeforeBackgroundWait = mockGet.mock.calls.filter(([url]) => String(url).includes('/scene-generation/scene-job-1')).length;
      await act(async () => { jest.advanceTimersByTime(5000); await Promise.resolve(); });
      expect(mockGet.mock.calls.filter(([url]) => String(url).includes('/scene-generation/scene-job-1'))).toHaveLength(jobReadsBeforeBackgroundWait);

      await act(async () => {
        listeners.forEach(listener => listener('active'));
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      });
      expect(hook.result.current.conversation.session?.references[0].imageUrl).toBe('https://cdn.example.test/reference-fresh.jpg');
      expect(hook.result.current.job?.candidates[0].imageUrl).toBe('https://cdn.example.test/result-fresh.jpg');
      const readsAfterReturn = mockGet.mock.calls.filter(([url]) => String(url).includes('/scene-generation/scene-job-1')).length;
      expect(readsAfterReturn).toBe(jobReadsBeforeBackgroundWait + 1);

      await act(async () => { jest.advanceTimersByTime(2100); await Promise.resolve(); await Promise.resolve(); });
      expect(mockGet.mock.calls.filter(([url]) => String(url).includes('/scene-generation/scene-job-1'))).toHaveLength(readsAfterReturn + 1);
      hook.unmount();
    } finally {
      appStateSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});
