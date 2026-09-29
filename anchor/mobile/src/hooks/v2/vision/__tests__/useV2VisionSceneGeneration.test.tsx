import { act, renderHook, waitFor } from '@testing-library/react-native';
import { apiClient, ApiClientError } from '@/services/ApiClient';
import { useV2VisionSceneGeneration } from '../useV2VisionSceneGeneration';

jest.mock('@/services/ApiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  ApiClientError: class ApiClientError extends Error {
    code?: string;
    status?: number;
    constructor(message: string, errorCode?: string, errorStatus?: number) {
      super(message);
      this.code = errorCode;
      this.status = errorStatus;
    }
  },
}));

const running = {
  id: 'scene-job-1', kind: 'SCENE', visionId: 'vision-1', anchorId: 'anchor-1', setNumber: 1, retryCount: 0,
  status: 'RUNNING', stage: 'creating_images', error: null, candidates: [],
};

describe('useV2VisionSceneGeneration', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('starts a described scene on its own endpoint, never on the numbered sets', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { success: true, data: running } });
    const { result } = renderHook(() => useV2VisionSceneGeneration('anchor-1'));
    await act(async () => { expect(await result.current.start('Working from a beach house')).toBe(true); });
    const [path, body] = (apiClient.post as jest.Mock).mock.calls[0];
    expect(path).toBe('/api/v2/anchors/anchor-1/vision/scene-generation');
    expect(body).toEqual({ sceneDescription: 'Working from a beach house', idempotencyKey: expect.stringMatching(/^[A-Za-z0-9-]{12,100}$/) });
    expect(result.current.job?.id).toBe('scene-job-1');
    // Nothing is fetched until a job exists: there is no set to resume.
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('follows its own job by id until it finishes', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { success: true, data: running } });
    const { result } = renderHook(() => useV2VisionSceneGeneration('anchor-1'));
    await act(async () => { await result.current.start('Working from a beach house'); });
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { success: true, data: { ...running, status: 'COMPLETE', candidates: [
      { id: 'c1', assetId: 'a1', role: 'r', prompt: 'p', sortOrder: 0, imageUrl: 'https://x/1.jpg' },
      { id: 'c2', assetId: 'a2', role: 'r', prompt: 'p', sortOrder: 1, imageUrl: 'https://x/2.jpg' },
    ] } } });
    await act(async () => { await result.current.refresh(); });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v2/anchors/anchor-1/vision/scene-generation/scene-job-1');
    expect(result.current.job?.status).toBe('COMPLETE');
    expect(result.current.job?.candidates).toHaveLength(2);
  });

  it('sends one start request however many times it is called at once', async () => {
    let resolvePost: (value: unknown) => void = () => undefined;
    (apiClient.post as jest.Mock).mockImplementation(() => new Promise(resolve => { resolvePost = resolve; }));
    const { result } = renderHook(() => useV2VisionSceneGeneration('anchor-1'));
    let second: boolean | undefined;
    await act(async () => {
      const first = result.current.start('Working from a beach house');
      second = await result.current.start('Working from a beach house');
      resolvePost({ data: { success: true, data: running } });
      await first;
    });
    expect(second).toBe(false);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('opens the Vision premium flow when access is required', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new ApiClientError('Access required', 'VISION_PREMIUM_REQUIRED', 403));
    const onPremiumRequired = jest.fn();
    const { result } = renderHook(() => useV2VisionSceneGeneration('anchor-1', onPremiumRequired));
    await act(async () => { expect(await result.current.start('Working from a beach house')).toBe(false); });
    expect(onPremiumRequired).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('explains a full board in the person\'s terms', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new ApiClientError('full', 'VISION_IMAGE_LIMIT', 400));
    const { result } = renderHook(() => useV2VisionSceneGeneration('anchor-1'));
    await act(async () => { await result.current.start('Working from a beach house'); });
    await waitFor(() => expect(result.current.error).toBe('Your board is full. Remove an image to add another.'));
  });

  it('retries a paused job through the shared retry endpoint', async () => {
    (apiClient.post as jest.Mock)
      .mockResolvedValueOnce({ data: { success: true, data: { ...running, status: 'FAILED' } } })
      .mockResolvedValueOnce({ data: { success: true, data: { ...running, status: 'QUEUED', retryCount: 1 } } });
    const { result } = renderHook(() => useV2VisionSceneGeneration('anchor-1'));
    await act(async () => { await result.current.start('Working from a beach house'); });
    await act(async () => { expect(await result.current.retry()).toBe(true); });
    expect((apiClient.post as jest.Mock).mock.calls[1][0]).toBe('/api/v2/anchors/anchor-1/vision/generation/scene-job-1/retry');
    expect(result.current.job?.retryCount).toBe(1);
  });
});
