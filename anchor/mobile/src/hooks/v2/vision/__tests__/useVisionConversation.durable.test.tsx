import { act, renderHook, waitFor } from '@testing-library/react-native';

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
}));

jest.mock('@/stores/authStore', () => {
  const { create } = jest.requireActual('zustand');
  return { useAuthStore: create(() => ({ user: { id: 'owner-a' } })) };
});

jest.mock('expo-crypto', () => ({ randomUUID: () => 'durable-draft-id' }));

import { useAuthStore } from '@/stores/authStore';
import { useVisionConversation } from '../useVisionConversation';

const envelope = <T,>(data: T) => ({ data: { success: true, data } });
const session = (id: string, ownerLabel: string) => ({
  id, anchorId: 'anchor-1', visionId: `vision-${ownerLabel}`, status: 'ACTIVE' as const,
  description: `Scene for ${ownerLabel}`, draftPrompt: '', selectedCandidateId: null, viewedRoundId: null,
  references: [], rounds: [], expiresAt: '2026-10-21T00:00:00.000Z',
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => { resolve = nextResolve; reject = nextReject; });
  return { promise, resolve, reject };
}

describe('useVisionConversation durable owner-bound drafts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureValues.clear();
    mockReadSecureValue.mockImplementation(async key => mockSecureValues.get(key) ?? null);
    mockWriteSecureValue.mockImplementation(async (key, value) => { mockSecureValues.set(key, value); });
    mockGet.mockResolvedValue(envelope(null));
    useAuthStore.setState({ user: { id: 'owner-a' } as never });
  });

  it('coalesces queued draft snapshots and waits for the latest durable value', async () => {
    const firstWrite = deferred<void>();
    mockWriteSecureValue.mockImplementationOnce(() => firstWrite.promise)
      .mockImplementation(async (key, value) => { mockSecureValues.set(key, value); });
    const hook = renderHook(() => useVisionConversation('anchor-1'));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    let first!: Promise<void>, second!: Promise<void>, third!: Promise<void>;
    act(() => {
      hook.result.current.saveDraft({ description: 'First' });
      first = hook.result.current.flushDraft();
    });
    await waitFor(() => expect(mockWriteSecureValue).toHaveBeenCalledTimes(1));
    act(() => {
      hook.result.current.saveDraft({ description: 'Second' });
      second = hook.result.current.flushDraft();
      hook.result.current.saveDraft({ description: 'Latest' });
      third = hook.result.current.flushDraft();
    });
    await act(async () => { firstWrite.resolve(); await Promise.all([first, second, third]); });
    expect(mockWriteSecureValue).toHaveBeenCalledTimes(2);
    expect(JSON.parse([...mockSecureValues.values()][0]).description).toBe('Latest');
    hook.unmount();
  });

  it('restores an encrypted local draft after the hook is remounted', async () => {
    const first = renderHook(() => useVisionConversation('anchor-1'));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));

    await act(async () => {
      first.result.current.saveDraft({
        description: 'A quiet studio by the sea',
        draftPrompt: 'Morning light through tall windows',
        references: [{ id: 'ref-1', assetId: 'asset-1', uri: 'file:///private/ref.jpg', mimeType: 'image/jpeg', role: 'place' }],
      });
      await first.result.current.flushDraft();
    });
    const stored = [...mockSecureValues.entries()][0];
    expect(stored[0]).toBe('vision-conversation.owner-a.anchor-1');
    expect(JSON.parse(stored[1])).toMatchObject({
      description: 'A quiet studio by the sea',
      draftPrompt: 'Morning light through tall windows',
      references: [{ assetId: 'asset-1', uri: 'file:///private/ref.jpg' }],
    });
    first.unmount();

    const second = renderHook(() => useVisionConversation('anchor-1'));
    await waitFor(() => expect(second.result.current.loaded).toBe(true));
    expect(second.result.current.draft.current).toMatchObject({
      description: 'A quiet studio by the sea',
      draftPrompt: 'Morning light through tall windows',
      references: [{ assetId: 'asset-1', uri: 'file:///private/ref.jpg' }],
    });
  });

  it('ignores an in-flight owner A response after switching to owner B', async () => {
    const staleOwnerA = deferred<ReturnType<typeof envelope>>();
    const ownerB = session('session-b', 'owner-b');
    mockGet.mockImplementationOnce(() => staleOwnerA.promise).mockResolvedValueOnce(envelope(ownerB));
    useAuthStore.setState({ user: { id: 'owner-a' } as never });

    const hook = renderHook(() => useVisionConversation('anchor-1'));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    const requestForA = mockGet.mock.calls[0];

    act(() => useAuthStore.setState({ user: { id: 'owner-b' } as never }));
    await waitFor(() => expect(hook.result.current.session?.id).toBe('session-b'));
    expect(mockReadSecureValue).toHaveBeenCalledWith('vision-conversation.owner-a.anchor-1');
    expect(mockReadSecureValue).toHaveBeenCalledWith('vision-conversation.owner-b.anchor-1');
    expect(requestForA[1].anchorAuthGuard()).toBe(false);

    await act(async () => { staleOwnerA.resolve(envelope(session('session-a', 'owner-a'))); });
    expect(hook.result.current.session?.id).toBe('session-b');
  });

  it('does not reveal owner A local data after switching to owner B', async () => {
    mockSecureValues.set('vision-conversation.owner-a.anchor-1', JSON.stringify({
      id: 'local-owner-a', description: 'Private scene for A', draftPrompt: 'A only', references: [], updatedAt: Date.now(),
    }));
    mockGet.mockResolvedValue(envelope(null));
    const hook = renderHook(() => useVisionConversation('anchor-1'));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    expect(hook.result.current.draft.current?.description).toBe('Private scene for A');

    act(() => useAuthStore.setState({ user: { id: 'owner-b' } as never }));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    expect(hook.result.current.owner).toBe('owner-b');
    expect(hook.result.current.session).toBeNull();
    expect(hook.result.current.draft.current).toBeNull();
    expect(mockReadSecureValue).toHaveBeenCalledWith('vision-conversation.owner-b.anchor-1');
  });

  it('ignores malformed local data instead of presenting it as a prior scene', async () => {
    mockSecureValues.set('vision-conversation.owner-a.anchor-1', '{not-valid-json');
    mockGet.mockResolvedValue(envelope(null));
    const hook = renderHook(() => useVisionConversation('anchor-1'));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    expect(hook.result.current.session).toBeNull();
    expect(hook.result.current.draft.current).toBeNull();
  });

  it('serializes a queued draft patch before abandoning its session, then starts a fresh draft', async () => {
    const original = session('session-original', 'owner-a');
    mockGet.mockResolvedValue(envelope(original));
    const firstPatch = deferred<ReturnType<typeof envelope>>();
    const abandonPatch = deferred<ReturnType<typeof envelope>>();
    mockPatch.mockReturnValueOnce(firstPatch.promise).mockReturnValueOnce(abandonPatch.promise);
    const hook = renderHook(() => useVisionConversation('anchor-1'));
    await waitFor(() => expect(hook.result.current.session?.id).toBe('session-original'));

    act(() => hook.result.current.saveDraft({ description: 'Updated original scene' }));
    let flushing!: Promise<void>;
    act(() => { flushing = hook.result.current.flushDraft(); });
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][0]).toBe('/api/v2/anchors/anchor-1/vision/creation-sessions/session-original');
    let abandoning!: Promise<void>;
    act(() => { abandoning = hook.result.current.startDifferent(); });
    firstPatch.resolve(envelope(original));
    await act(async () => { await flushing; });
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2));
    expect(mockPatch.mock.calls[1][0]).toBe('/api/v2/anchors/anchor-1/vision/creation-sessions/session-original');
    expect(mockPatch.mock.calls[1][1]).toEqual({ status: 'ABANDONED' });
    abandonPatch.resolve(envelope(original));
    await act(async () => { await abandoning; });

    expect(hook.result.current.session).toBeNull();
    expect(hook.result.current.draft.current).toMatchObject({ id: 'durable-draft-id', description: '' });
    expect(mockPatch.mock.calls.map(([url]) => url)).toEqual([
      '/api/v2/anchors/anchor-1/vision/creation-sessions/session-original',
      '/api/v2/anchors/anchor-1/vision/creation-sessions/session-original',
    ]);
  });

  it('persists a seal receipt before PATCH and replays the same choice after a lost acknowledgment', async () => {
    const active = session('session-seal', 'owner-a');
    mockGet.mockResolvedValue(envelope(active));
    const lostAcknowledgment = deferred<ReturnType<typeof envelope>>();
    mockPatch.mockReturnValueOnce(lostAcknowledgment.promise).mockResolvedValueOnce(envelope({ ...active, status: 'SEALED' }));

    const first = renderHook(() => useVisionConversation('anchor-1'));
    await waitFor(() => expect(first.result.current.session?.id).toBe(active.id));
    let sealing!: Promise<void>;
    act(() => {
      sealing = first.result.current.update({
        selectedCandidateId: 'candidate-original-2',
        viewedRoundId: 'round-original',
        status: 'SEALED',
      });
    });
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));

    const receiptKey = 'vision-conversation.owner-a.anchor-1';
    expect(JSON.parse(mockSecureValues.get(receiptKey)!)).toMatchObject({
      id: active.id,
      pendingSeal: { selectedCandidateId: 'candidate-original-2', viewedRoundId: 'round-original' },
    });
    expect(mockPatch.mock.calls[0][1]).toEqual({
      selectedCandidateId: 'candidate-original-2', viewedRoundId: 'round-original', status: 'SEALED',
    });

    lostAcknowledgment.reject(new Error('Connection ended before acknowledgment'));
    await act(async () => { await expect(sealing).rejects.toThrow('Connection ended before acknowledgment'); });
    expect(JSON.parse(mockSecureValues.get(receiptKey)!)).toMatchObject({
      pendingSeal: { selectedCandidateId: 'candidate-original-2', viewedRoundId: 'round-original' },
    });
    first.unmount();

    const second = renderHook(() => useVisionConversation('anchor-1'));
    await waitFor(() => expect(second.result.current.loaded).toBe(true));
    expect(mockPatch).toHaveBeenCalledTimes(2);
    expect(mockPatch.mock.calls[1][0]).toBe(`/api/v2/anchors/anchor-1/vision/creation-sessions/${active.id}`);
    expect(mockPatch.mock.calls[1][1]).toEqual({
      selectedCandidateId: 'candidate-original-2', viewedRoundId: 'round-original', status: 'SEALED',
    });
    expect(second.result.current.draft.current).toBeNull();
    expect(mockSecureValues.get(receiptKey)).toBe('null');
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('discards a durable seal receipt when its session has expired', async () => {
    const receiptKey = 'vision-conversation.owner-a.anchor-1';
    mockSecureValues.set(receiptKey, JSON.stringify({
      id: 'expired-session', description: 'Scene for owner-a', draftPrompt: '', references: [], updatedAt: Date.now(),
      pendingSeal: { selectedCandidateId: 'candidate-original-2', viewedRoundId: 'round-original' },
    }));
    mockPatch.mockRejectedValue(Object.assign(new Error('Session expired'), { status: 404 }));

    const hook = renderHook(() => useVisionConversation('anchor-1'));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch.mock.calls[0][0]).toBe('/api/v2/anchors/anchor-1/vision/creation-sessions/expired-session');
    expect(mockPatch.mock.calls[0][1]).toEqual({
      selectedCandidateId: 'candidate-original-2', viewedRoundId: 'round-original', status: 'SEALED',
    });
    expect(hook.result.current.session).toBeNull();
    expect(hook.result.current.draft.current).toBeNull();
    expect(mockSecureValues.get(receiptKey)).toBe('null');
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
