import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { VisionReadModel } from '@/adapters/v2/vision';

const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockPut = jest.fn();
const mockPersistedSet = jest.fn();

jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: (...args: unknown[]) => mockPersistedSet(...args),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
  readSecureValue: jest.fn().mockResolvedValue(null),
  writeSecureValue: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    post: jest.fn(),
    put: (...args: unknown[]) => mockPut(...args),
    delete: jest.fn(),
  },
  ApiClientError: class MockApiClientError extends Error {
    status?: number;
    constructor(message: string, code?: string, status?: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/ApiClient';
import { peekV2Vision, resetV2VisionReadCache, useV2Vision } from '../useV2Vision';

const envelope = <T,>(data: T) => ({ data: { success: true, data } });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function savedVision(): VisionReadModel {
  return {
    id: 'vision-persistence',
    anchorId: 'anchor-persistence',
    title: 'My future',
    description: 'A future worth seeing',
    status: 'ACTIVE',
    scenes: [{
      id: 'scene-persistence',
      visionId: 'vision-persistence',
      sourceType: 'USER_UPLOAD',
      assetId: 'asset-persistence',
      resolvedImageUrl: 'https://cdn.example.com/real-photo.jpg',
      prompt: null,
      caption: 'Original caption',
      slotIndex: 0,
      focal: { x: 0.3, y: 0.7 },
      sortOrder: 0,
      isArchived: false,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    }],
    notes: [],
    seenToday: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('useV2Vision confirmed board persistence', () => {
  afterEach(() => resetV2VisionReadCache());

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReset();
    mockPatch.mockReset();
    mockPut.mockReset();
    mockPersistedSet.mockResolvedValue(undefined);
    useAuthStore.setState({ user: { id: 'vision-persistence-user' } as never });
    resetV2VisionReadCache();
  });

  it('sends and confirms an online caption while its encrypted retry record is slow', async () => {
    const initial = savedVision();
    mockGet.mockResolvedValue(envelope(initial));
    const board = renderHook(() => useV2Vision(initial.anchorId));
    await waitFor(() => expect(board.result.current.loading).toBe(false));
    const pendingWrite = deferred<void>();
    mockPersistedSet.mockImplementation((key: string) => key.startsWith('anchor:v2:vision-pending:') ? pendingWrite.promise : Promise.resolve());
    const confirmed = { ...initial, scenes: [{ ...initial.scenes[0], caption: 'New caption' }] };
    mockPatch.mockResolvedValueOnce(envelope(confirmed));
    let outcome: VisionReadModel | null = null;
    await act(async () => { outcome = await board.result.current.updateSceneCaption('scene-persistence', 'New caption'); });
    expect(outcome).toEqual(confirmed);
    expect(mockPatch).toHaveBeenCalledTimes(1);
    await act(async () => { pendingWrite.resolve(); await pendingWrite.promise; });
    board.unmount();
  });

  it('waits for durable retention before reporting an offline caption failure', async () => {
    const initial = savedVision();
    mockGet.mockResolvedValue(envelope(initial));
    const board = renderHook(() => useV2Vision(initial.anchorId));
    await waitFor(() => expect(board.result.current.loading).toBe(false));
    const pendingWrite = deferred<void>();
    mockPersistedSet.mockImplementation((key: string) => key.startsWith('anchor:v2:vision-pending:') ? pendingWrite.promise : Promise.resolve());
    mockPatch.mockRejectedValueOnce(new Error('Network unavailable'));
    let settled = false;
    let operation!: Promise<VisionReadModel | null>;
    act(() => { operation = board.result.current.updateSceneCaption('scene-persistence', 'Offline caption'); void operation.then(() => { settled = true; }); });
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(settled).toBe(false);
    await act(async () => { pendingWrite.resolve(); expect(await operation).toBeNull(); });
    expect(board.result.current.error).toBe('Network unavailable');
    board.unmount();
  });

  it('confirms an added photo placement while the encrypted retry record is slow', async () => {
    const initial = savedVision();
    mockGet.mockResolvedValue(envelope(initial));
    const board = renderHook(() => useV2Vision(initial.anchorId));
    await waitFor(() => expect(board.result.current.loading).toBe(false));
    const pendingWrite = deferred<void>();
    mockPersistedSet.mockImplementation((key: string) => key.startsWith('anchor:v2:vision-pending:') ? pendingWrite.promise : Promise.resolve());
    const confirmed = { ...initial, scenes: [{ ...initial.scenes[0], slotIndex: 2 }] };
    mockPut.mockResolvedValueOnce(envelope(confirmed));
    await act(async () => { expect(await board.result.current.updateSceneSlots([{ sceneId: 'scene-persistence', slotIndex: 2 }])).toEqual(confirmed); });
    expect(mockPut).toHaveBeenCalledTimes(1);
    await act(async () => { pendingWrite.resolve(); await pendingWrite.promise; });
    board.unmount();
  });

  it('confirms a note edit while its encrypted retry record is slow', async () => {
    const base = savedVision();
    const note = { id: 'note-1', visionId: base.id, content: { text: 'Old' }, presentation: { styleId: 'sticky_blush_pink' as const, x: .5, y: .5, width: .3, height: .3, rotation: 0, scale: 1, layerOrder: 0 }, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
    const initial = { ...base, notes: [note] };
    mockGet.mockResolvedValue(envelope(initial));
    const board = renderHook(() => useV2Vision(initial.anchorId));
    await waitFor(() => expect(board.result.current.loading).toBe(false));
    const pendingWrite = deferred<void>();
    mockPersistedSet.mockImplementation((key: string) => key.startsWith('anchor:v2:vision-pending:') ? pendingWrite.promise : Promise.resolve());
    const confirmed = { ...initial, notes: [{ ...note, content: { text: 'Updated' } }] };
    mockPatch.mockResolvedValueOnce(envelope(confirmed));
    await act(async () => { expect(await board.result.current.updateNote('note-1', { content: { text: 'Updated' } })).toEqual(confirmed); });
    expect(mockPatch).toHaveBeenCalledTimes(1);
    await act(async () => { pendingWrite.resolve(); await pendingWrite.promise; });
    board.unmount();
  });

  it('reports a failed photo position save and preserves the last confirmed framing', async () => {
    const initial = savedVision();
    mockGet.mockResolvedValue(envelope(initial));
    const board = renderHook(() => useV2Vision(initial.anchorId));
    await waitFor(() => expect(board.result.current.loading).toBe(false));
    mockPatch.mockRejectedValueOnce(new Error('Network unavailable. Try again.'));

    let outcome: unknown;
    await act(async () => {
      outcome = await board.result.current.syncScenePresentation('scene-persistence', {
        slotIndex: 2, focal: { x: 0.8, y: 0.2 },
      });
    });

    expect(outcome).toBeNull();
    expect(board.result.current.error).toBe('Network unavailable. Try again.');
    expect(board.result.current.vision).toEqual(initial);
    expect(peekV2Vision(initial.anchorId)).toEqual(initial);
  });

  it('keeps a failed save visible when Retry cannot reconnect, while retaining the confirmed board', async () => {
    const initial = savedVision();
    mockGet.mockResolvedValue(envelope(initial));
    const board = renderHook(() => useV2Vision(initial.anchorId));
    await waitFor(() => expect(board.result.current.loading).toBe(false));
    mockPatch.mockRejectedValueOnce(new Error('Network unavailable. Your change needs retry.'));
    await act(async () => { await board.result.current.syncScenePresentation('scene-persistence', { focal: { x: .8, y: .2 } }); });
    mockGet.mockRejectedValueOnce(new Error('Still offline'));
    await act(async () => { await board.result.current.refresh(); });
    expect(board.result.current.error).toBe('Network unavailable. Your change needs retry.');
    expect(board.result.current.vision).toEqual(initial);
  });

  it('commits confirmed slot and crop data to both mounted surfaces and encrypted persistence', async () => {
    const initial = savedVision();
    mockGet.mockResolvedValue(envelope(initial));
    const board = renderHook(() => useV2Vision(initial.anchorId));
    const visualize = renderHook(() => useV2Vision(initial.anchorId));
    await waitFor(() => expect(visualize.result.current.loading).toBe(false));
    const confirmed: VisionReadModel = {
      ...initial,
      updatedAt: '2026-10-02T00:00:00.000Z',
      scenes: [{ ...initial.scenes[0], slotIndex: 2, focal: { x: 0.8, y: 0.2 } }],
    };
    mockPatch.mockResolvedValueOnce(envelope(confirmed));

    let outcome: unknown;
    await act(async () => {
      outcome = await board.result.current.syncScenePresentation('scene-persistence', {
        slotIndex: 2, focal: { x: 0.8, y: 0.2 },
      });
    });

    expect(outcome).toEqual(confirmed);
    expect(board.result.current.vision).toEqual(confirmed);
    expect(visualize.result.current.vision).toEqual(confirmed);
    expect(peekV2Vision(initial.anchorId)).toEqual(confirmed);
    const readKey = 'anchor:v2:vision-read:vision-persistence-user:anchor-persistence';
    const readWrite = mockPersistedSet.mock.calls.filter(([storageKey]) => storageKey === readKey).at(-1);
    expect(readWrite).toBeDefined();
    const durableSnapshot = JSON.parse(readWrite![1]);
    expect(durableSnapshot).toEqual({
      schemaVersion: 1, accountId: 'vision-persistence-user', anchorId: 'anchor-persistence', value: confirmed,
    });
  });

  it.each(['caption', 'description'] as const)(
    'does not let a GET started before a confirmed %s edit erase it on either surface',
    async (field) => {
      const initial = savedVision();
      mockGet.mockResolvedValue(envelope(initial));
      const board = renderHook(() => useV2Vision(initial.anchorId));
      const otherSurface = renderHook(() => useV2Vision(initial.anchorId));
      await waitFor(() => expect(otherSurface.result.current.loading).toBe(false));
      const staleRead = deferred<ReturnType<typeof envelope<VisionReadModel>>>();
      mockGet.mockReturnValueOnce(staleRead.promise);
      let refresh!: Promise<void>;
      act(() => { refresh = otherSurface.result.current.refresh(); });
      const confirmed: VisionReadModel = {
        ...initial,
        updatedAt: '2026-10-02T00:00:00.000Z',
        ...(field === 'caption'
          ? { scenes: [{ ...initial.scenes[0], caption: 'My confirmed caption' }] }
          : { description: 'My confirmed future' }),
      };
      mockPatch.mockResolvedValueOnce(envelope(confirmed));
      await act(async () => {
        if (field === 'caption') {
          await board.result.current.updateSceneCaption('scene-persistence', 'My confirmed caption');
        } else {
          await board.result.current.updateVision({ description: 'My confirmed future' });
        }
      });
      expect(board.result.current.vision).toEqual(confirmed);

      await act(async () => {
        staleRead.resolve(envelope(initial));
        await refresh;
      });

      expect(board.result.current.vision).toEqual(confirmed);
      expect(otherSurface.result.current.vision).toEqual(confirmed);
      expect(peekV2Vision(initial.anchorId)).toEqual(confirmed);
    },
  );

  it('surfaces a conflicting photo update without overwriting confirmed content', async () => {
    const initial = savedVision();
    mockGet.mockResolvedValue(envelope(initial));
    const board = renderHook(() => useV2Vision(initial.anchorId));
    await waitFor(() => expect(board.result.current.loading).toBe(false));
    mockPatch.mockRejectedValueOnce(Object.assign(new Error('This Vision changed on another device. Refresh and try again.'), { status: 409 }));

    let outcome: unknown;
    await act(async () => {
      outcome = await board.result.current.syncScenePresentation('scene-persistence', { slotIndex: 3 });
    });

    expect(outcome).toBeNull();
    expect(board.result.current.error).toContain('another device');
    expect(board.result.current.vision).toEqual(initial);
  });

  it.each([1, 8])('keeps all original photos after a failed atomic replacement on a %s-photo board', async count => {
    const base = savedVision();
    const initial = { ...base, scenes: Array.from({ length: count }, (_, i) => ({ ...base.scenes[0],
      id: i ? `scene-${i}` : base.scenes[0].id, assetId: `original-${i}`, slotIndex: i, sortOrder: i })) };
    mockGet.mockResolvedValue(envelope(initial));
    const board = renderHook(() => useV2Vision(initial.anchorId));
    await waitFor(() => expect(board.result.current.loading).toBe(false));
    mockPatch.mockRejectedValueOnce(new Error('Replacement is unavailable'));
    let result: unknown;
    await act(async () => { result = await board.result.current.replaceScene('scene-persistence', { assetId: 'new-asset', sourceType: 'USER_UPLOAD' }); });
    expect(result).toBeNull();
    expect(board.result.current.vision).toEqual(initial);
    expect(peekV2Vision(initial.anchorId)).toEqual(initial);
    expect(board.result.current.error).toBe('Replacement is unavailable');
    expect(apiClient.delete).not.toHaveBeenCalled(); expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('undoes a confirmed replacement with the old asset and caption using the confirmed scene timestamp', async () => {
    const initial = savedVision();
    const confirmed = { ...initial, scenes: [{ ...initial.scenes[0], assetId: 'new-asset', sourceType: 'AI_GENERATED' as const,
      prompt: 'A new view', caption: 'New caption', updatedAt: '2026-10-02T00:00:00Z' }] };
    mockGet.mockResolvedValue(envelope(initial));
    const board = renderHook(() => useV2Vision(initial.anchorId));
    await waitFor(() => expect(board.result.current.loading).toBe(false));
    mockPatch.mockResolvedValueOnce(envelope(confirmed)).mockResolvedValueOnce(envelope(initial));
    await act(async () => { await board.result.current.replaceScene('scene-persistence', {
      assetId: 'new-asset', sourceType: 'AI_GENERATED', prompt: 'A new view', caption: 'New caption',
    }); });
    expect(board.result.current.vision).toEqual(confirmed);
    expect(mockPatch).toHaveBeenCalledWith('/api/v2/visions/vision-persistence/scenes/scene-persistence', {
      replacement: { assetId: 'new-asset', sourceType: 'AI_GENERATED', prompt: 'A new view', caption: 'New caption' },
      expectedUpdatedAt: initial.scenes[0].updatedAt,
    });
    await act(async () => { expect(await board.result.current.mutationFeedback.undo!()).toBe(true); });
    expect(mockPatch).toHaveBeenLastCalledWith('/api/v2/visions/vision-persistence/scenes/scene-persistence', {
      replacement: { assetId: initial.scenes[0].assetId, sourceType: initial.scenes[0].sourceType,
        prompt: initial.scenes[0].prompt, caption: initial.scenes[0].caption }, expectedUpdatedAt: confirmed.scenes[0].updatedAt,
    });
    expect(board.result.current.vision).toEqual(initial);
    expect(apiClient.delete).not.toHaveBeenCalled(); expect(apiClient.post).not.toHaveBeenCalled();
  });
});
