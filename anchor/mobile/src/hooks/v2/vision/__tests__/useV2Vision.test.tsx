import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
  ApiClientError: class MockApiClientError extends Error {
    status?: number;
    constructor(message: string, code?: string, status?: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { useV2Vision } from '../useV2Vision';

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
    mockPost.mockResolvedValueOnce(envelope(vision('vision-new')));

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
