jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ trackChart: jest.fn() }));
const mockPick = jest.fn();
jest.mock('@/hooks/v2/vision/visionPhotoInput', () => ({ pickVisionPhoto: (...args: unknown[]) => mockPick(...args) }));
const mockPrepare = jest.fn();
jest.mock('../askChartPhoto', () => ({ ...jest.requireActual('../askChartPhoto'), prepareAskPhoto: (...args: unknown[]) => mockPrepare(...args) }));
jest.mock('@/services/ApiClient', () => ({ apiClient: { defaults: {}, post: jest.fn() }, ApiClientError: class extends Error {} }));
jest.mock('@/services/AuthService', () => ({ AuthService: { getIdToken: jest.fn() } }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ChartRequestError } from '@/services/v2/chartV2Api';
import { useAskAttachments } from '../useAskAttachments';

type Upload = (anchorId: string, body: unknown, options: { onProgress?: (n: number) => void; signal?: AbortSignal }) => Promise<{ assetId: string; width: number; height: number }>;

function setup() {
  const uploads: Array<{ resolve: (id: string) => void; reject: (error: unknown) => void; options: Parameters<Upload>[2] }> = [];
  const uploadPhoto = jest.fn<ReturnType<Upload>, Parameters<Upload>>((_a, _b, options) => new Promise((resolve, reject) => {
    uploads.push({ resolve: id => resolve({ assetId: id, width: 1, height: 1 }), reject, options });
  }));
  const hook = renderHook(() => useAskAttachments({ anchorId: 'anchor-1', api: { uploadPhoto } }));
  return { hook, uploads, uploadPhoto };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPick.mockResolvedValue({ status: 'picked', photo: { uri: 'file:///picked.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } });
  mockPrepare.mockResolvedValue({ base64Image: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg', uri: 'file:///out.jpg' });
});

describe('useAskAttachments', () => {
  it('prepares, uploads with progress, and becomes ready with the server’s asset id', async () => {
    const { hook, uploads, uploadPhoto } = setup();
    await act(async () => { await hook.result.current.add('library'); });
    expect(hook.result.current.items[0]).toMatchObject({ uri: 'file:///picked.jpg' });
    await waitFor(() => expect(uploadPhoto).toHaveBeenCalledTimes(1));
    expect(uploadPhoto).toHaveBeenCalledWith('anchor-1', { base64Image: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg' }, expect.any(Object));
    expect(hook.result.current.pending).toBe(true);
    expect(hook.result.current.items[0].status).toBe('uploading');
    act(() => uploads[0].options.onProgress?.(0.5));
    expect(hook.result.current.items[0].progress).toBe(0.5);
    await act(async () => uploads[0].resolve('asset-1'));
    expect(hook.result.current.items[0]).toMatchObject({ status: 'ready', assetId: 'asset-1' });
    expect(hook.result.current.pending).toBe(false);
    expect(hook.result.current.readyIds).toEqual(['asset-1']);
  });

  it('keeps a failed upload with a plain reason, and retries it without picking again', async () => {
    const { hook, uploads, uploadPhoto } = setup();
    await act(async () => { await hook.result.current.add('camera'); });
    await waitFor(() => expect(uploads).toHaveLength(1));
    await act(async () => uploads[0].reject(new ChartRequestError('offline', undefined)));
    expect(hook.result.current.failed).toBe(true);
    expect(hook.result.current.items[0].error).toMatch(/No connection/);
    act(() => hook.result.current.retry(hook.result.current.items[0].id));
    await waitFor(() => expect(uploadPhoto).toHaveBeenCalledTimes(2));
    expect(mockPick).toHaveBeenCalledTimes(1);
    await act(async () => uploads[1].resolve('asset-2'));
    expect(hook.result.current.items[0]).toMatchObject({ status: 'ready', assetId: 'asset-2', error: undefined });
  });

  it('reports a photo that could not be prepared as failed, not as ready', async () => {
    mockPrepare.mockRejectedValueOnce(new Error('bad file'));
    const { hook, uploadPhoto } = setup();
    await act(async () => { await hook.result.current.add('library'); });
    await waitFor(() => expect(hook.result.current.failed).toBe(true));
    expect(uploadPhoto).not.toHaveBeenCalled();
    expect(hook.result.current.readyIds).toEqual([]);
  });

  it('removing a photo mid-upload cancels it', async () => {
    const { hook, uploads } = setup();
    await act(async () => { await hook.result.current.add('library'); });
    await waitFor(() => expect(uploads).toHaveLength(1));
    act(() => hook.result.current.remove(hook.result.current.items[0].id));
    expect(hook.result.current.items).toEqual([]);
    expect(uploads[0].options.signal?.aborted).toBe(true);
    await act(async () => uploads[0].resolve('asset-late'));
    expect(hook.result.current.items).toEqual([]);
  });

  it('does nothing when the picker is cancelled, and explains a refusal (with Settings when it cannot ask again)', async () => {
    const { hook } = setup();
    mockPick.mockResolvedValueOnce({ status: 'cancelled' });
    await act(async () => { await hook.result.current.add('library'); });
    expect(hook.result.current.items).toEqual([]);
    expect(hook.result.current.notice).toBeNull();

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockPick.mockResolvedValueOnce({ status: 'denied', message: 'Allow camera access to take a photo.', canAskAgain: false });
    await act(async () => { await hook.result.current.add('camera'); });
    expect(hook.result.current.notice).toMatch(/camera/i);
    expect(alert).toHaveBeenCalledWith('Camera is off', expect.any(String), expect.arrayContaining([expect.objectContaining({ text: 'Open Settings' })]));
    alert.mockRestore();

    mockPick.mockResolvedValueOnce({ status: 'error', message: 'The camera is not available right now.' });
    await act(async () => { await hook.result.current.add('camera'); });
    expect(hook.result.current.notice).toBe('The camera is not available right now.');
  });

  it('allows at most three photos and clears them once the message is sent', async () => {
    const { hook, uploads } = setup();
    for (let i = 0; i < 4; i += 1) {
      mockPick.mockResolvedValueOnce({ status: 'picked', photo: { uri: `file:///p${i}.jpg`, mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } });
      await act(async () => { await hook.result.current.add('library'); });
    }
    expect(hook.result.current.items).toHaveLength(3);
    expect(hook.result.current.canAdd).toBe(false);
    expect(hook.result.current.notice).toMatch(/up to 3 photos/);
    await waitFor(() => expect(uploads).toHaveLength(3));
    act(() => hook.result.current.clear());
    expect(hook.result.current.items).toEqual([]);
    expect(hook.result.current.canAdd).toBe(true);
  });

  it('cancels uploads that are still running when the screen goes away', async () => {
    const { hook, uploads } = setup();
    await act(async () => { await hook.result.current.add('library'); });
    await waitFor(() => expect(uploads).toHaveLength(1));
    hook.unmount();
    expect(uploads[0].options.signal?.aborted).toBe(true);
  });
});
