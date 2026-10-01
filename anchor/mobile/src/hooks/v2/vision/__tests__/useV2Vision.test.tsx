import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockPersistedGet = jest.fn();

jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: {
    getItem: (...args: unknown[]) => mockPersistedGet(...args),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
  readSecureValue: jest.fn().mockResolvedValue(null),
  writeSecureValue: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
  ApiClientError: class MockApiClientError extends Error {
    status?: number;
    constructor(message: string, code?: string, status?: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { resetV2VisionReadCache, useV2Vision } from '../useV2Vision';
import { useAuthStore } from '@/stores/authStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const vision = (id: string) => ({
  id,
  anchorId: id.replace('vision-', 'anchor-'),
  title: null,
  description: `Vision ${id}`,
  status: 'ACTIVE' as const,
  scenes: [
    {
      id: `scene-${id}`,
      visionId: id,
      sourceType: 'USER_UPLOAD' as const,
      assetId: `asset-${id}`,
      resolvedImageUrl: `https://cdn.example.com/${id}.jpg`,
      prompt: null,
      sortOrder: 0,
      isArchived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ],
  seenToday: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
});

// Every real V2 route responds with this envelope; the hook must unwrap it, not treat it as the model.
const envelope = <T,>(data: T) => ({ data: { success: true, data } });

describe('useV2Vision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPersistedGet.mockResolvedValue(null);
    useAuthStore.setState({ user: { id: 'vision-cache-user' } as never });
    resetV2VisionReadCache();
  });

  it('cancels the previous Anchor request and ignores its late response', async () => {
    const first = deferred<ReturnType<typeof envelope>>();
    const second = deferred<ReturnType<typeof envelope>>();
    mockGet.mockImplementation((url: string) => (url.includes('/anchor-a/') ? first.promise : second.promise));

    const { result, rerender, unmount } = renderHook(
      ({ anchorId }: { anchorId: string }) => useV2Vision(anchorId),
      { initialProps: { anchorId: 'anchor-a' } },
    );

    rerender({ anchorId: 'anchor-b' });
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(mockGet.mock.calls[0][1].signal.aborted).toBe(true);

    await act(async () => {
      second.resolve(envelope(vision('vision-anchor-b')));
      await second.promise;
    });
    await waitFor(() => expect(result.current.vision?.id).toBe('vision-anchor-b'));

    await act(async () => {
      first.resolve(envelope(vision('vision-anchor-a')));
      await first.promise;
    });
    expect(result.current.vision?.id).toBe('vision-anchor-b');
    unmount();
  });

  it('unwraps the real {success,data} envelope on fetch instead of treating it as the model', async () => {
    mockGet.mockResolvedValueOnce(envelope(vision('vision-1')));

    const { result } = renderHook(() => useV2Vision('anchor-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    // A hook that failed to unwrap would expose {success:true,data:{...}} as `vision`,
    // so `vision.id` would be undefined and the surface would render nothing real.
    expect(result.current.vision?.id).toBe('vision-1');
    expect(result.current.state.state).toBe('ready');
  });

  it('reload replaces stale local state with the freshly fetched persisted Vision', async () => {
    mockGet.mockResolvedValueOnce(envelope(vision('vision-1')));
    const { result } = renderHook(() => useV2Vision('anchor-1'));
    await waitFor(() => expect(result.current.vision?.id).toBe('vision-1'));

    const updated = { ...vision('vision-1'), description: 'Updated after reload' };
    mockGet.mockResolvedValueOnce(envelope(updated));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.vision?.description).toBe('Updated after reload');
  });

  it('createVision unwraps the envelope and sets the real persisted Vision', async () => {
    mockGet.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }));
    mockPost.mockResolvedValueOnce(envelope({ ...vision('vision-new'), anchorId: 'anchor-1' }));

    const { result } = renderHook(() => useV2Vision('anchor-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: unknown;
    await act(async () => {
      created = await result.current.createVision({
        description: 'A real future',
        scenes: [{ assetId: 'asset-real-1', sourceType: 'USER_UPLOAD' }],
      });
    });

    expect((created as { id: string }).id).toBe('vision-new');
    expect(result.current.vision?.id).toBe('vision-new');
    expect(result.current.state.state).toBe('ready');
  });

  it('createVision failure surfaces an error and never fabricates a Vision', async () => {
    mockGet.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }));
    mockPost.mockRejectedValueOnce(new Error('Asset not found or not owned by user'));

    const { result } = renderHook(() => useV2Vision('anchor-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: unknown;
    await act(async () => {
      created = await result.current.createVision({
        description: 'A real future',
        scenes: [{ assetId: 'fabricated-id', sourceType: 'USER_UPLOAD' }],
      });
    });

    expect(created).toBeNull();
    expect(result.current.vision).toBeNull();
    expect(result.current.error).toBe('Asset not found or not owned by user');
  });

  it('restores the encrypted Vision presentation while server authority revalidates', async () => {
    const cached = { ...vision('vision-cached'), anchorId: 'anchor-1' };
    const snapshot = {
      schemaVersion: 1,
      accountId: 'vision-cache-user',
      anchorId: 'anchor-1',
      value: cached,
    };
    mockPersistedGet.mockImplementation(async (key: string) =>
      key === 'anchor:v2:vision-read:vision-cache-user:anchor-1' ? JSON.stringify(snapshot) : null,
    );
    const server = deferred<ReturnType<typeof envelope>>();
    mockGet.mockReturnValueOnce(server.promise);

    const { result } = renderHook(() => useV2Vision('anchor-1'));
    await waitFor(() => expect(result.current.vision?.id).toBe('vision-cached'));
    expect(result.current.loading).toBe(false);
    expect(mockGet).toHaveBeenCalledTimes(1);

    await act(async () => {
      server.resolve(envelope(vision('vision-anchor-1')));
      await server.promise;
    });
    await waitFor(() => expect(result.current.vision?.id).toBe('vision-anchor-1'));
  });

  it('keeps the cached Vision presentation when server revalidation fails', async () => {
    const cached = { ...vision('vision-cached'), anchorId: 'anchor-1' };
    mockPersistedGet.mockImplementation(async (key: string) => key.endsWith(':anchor-1')
      ? JSON.stringify({ schemaVersion: 1, accountId: 'vision-cache-user', anchorId: 'anchor-1', value: cached })
      : null,
    );
    mockGet.mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useV2Vision('anchor-1'));
    await waitFor(() => expect(result.current.vision?.id).toBe('vision-cached'));
    expect(result.current.state.state).toBe('ready');
  });

  it('uploadAsset returns the real server-issued Asset id on success', async () => {
    mockGet.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }));
    mockPost.mockResolvedValueOnce(
      envelope({ id: 'asset-real-42', resolvedUrl: 'https://cdn.example.com/asset-real-42.jpg', mimeType: 'image/jpeg', fileSizeBytes: 1024, createdAt: '2026-09-01T00:00:00.000Z' }),
    );

    const { result } = renderHook(() => useV2Vision('anchor-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadAsset>> | undefined;
    await act(async () => {
      uploadResult = await result.current.uploadAsset({ base64Image: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg' });
    });

    expect(uploadResult).toEqual({ ok: true, asset: expect.objectContaining({ id: 'asset-real-42' }) });
    expect(mockPost).toHaveBeenCalledWith('/api/v2/assets/upload', {
      base64Image: 'data:image/jpeg;base64,AAAA',
      mimeType: 'image/jpeg',
    });
  });

  it('uploadAsset surfaces a message on failure without fabricating an asset id', async () => {
    mockGet.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }));
    mockPost.mockRejectedValueOnce(new Error('base64Image is malformed or exceeds the 5MB limit'));

    const { result } = renderHook(() => useV2Vision('anchor-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadAsset>> | undefined;
    await act(async () => {
      uploadResult = await result.current.uploadAsset({ base64Image: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg' });
    });

    expect(uploadResult).toEqual({ ok: false, message: 'base64Image is malformed or exceeds the 5MB limit' });
  });
});

describe('useV2Vision across screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPersistedGet.mockResolvedValue(null);
    useAuthStore.setState({ user: { id: 'vision-sync-user' } as never });
    resetV2VisionReadCache();
  });

  const twoScenes = (order: [number, number]) => {
    const base = vision('vision-1');
    const scene = (id: string, sortOrder: number) => ({ ...base.scenes[0], id, assetId: `asset-${id}`, resolvedImageUrl: `https://cdn.example.com/${id}.jpg`, sortOrder });
    return { ...base, scenes: [scene('dashboard', order[0]), scene('app-store', order[1])] };
  };

  it('shows a reorder made on one screen on every other screen for that Anchor', async () => {
    mockGet.mockResolvedValueOnce(envelope(twoScenes([0, 1])));
    const practice = renderHook(() => useV2Vision('anchor-1'));
    await waitFor(() => expect(practice.result.current.tiles.map(tile => tile.sceneId)).toEqual(['dashboard', 'app-store']));
    const visionScreen = renderHook(() => useV2Vision('anchor-1'));
    await waitFor(() => expect(visionScreen.result.current.vision?.id).toBe('vision-1'));

    // The person puts the App Store image first on the Vision screen.
    mockPut.mockResolvedValueOnce({ data: { success: true, data: [] } });
    mockGet.mockResolvedValue(envelope(twoScenes([1, 0])));
    await act(async () => {
      await visionScreen.result.current.reorderScenes([{ id: 'app-store', sortOrder: 0 }, { id: 'dashboard', sortOrder: 1 }]);
    });

    await waitFor(() => expect(visionScreen.result.current.tiles.map(tile => tile.sceneId)).toEqual(['app-store', 'dashboard']));
    // Practice's own copy followed, so Visualize cannot open on the previous hero.
    await waitFor(() => expect(practice.result.current.tiles.map(tile => tile.sceneId)).toEqual(['app-store', 'dashboard']));
    expect(practice.result.current.tiles[0].isHero).toBe(true);
  });

  it('does not leak a read from one Anchor into another', async () => {
    mockGet.mockImplementation((url: string) => Promise.resolve(envelope(vision(url.includes('/anchor-a/') ? 'vision-anchor-a' : 'vision-anchor-b'))));
    const a = renderHook(() => useV2Vision('anchor-a'));
    const b = renderHook(() => useV2Vision('anchor-b'));
    await waitFor(() => expect(a.result.current.vision?.id).toBe('vision-anchor-a'));
    await waitFor(() => expect(b.result.current.vision?.id).toBe('vision-anchor-b'));
  });
});
