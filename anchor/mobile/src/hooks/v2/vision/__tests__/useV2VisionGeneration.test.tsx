import { act, renderHook, waitFor } from '@testing-library/react-native';
import { apiClient, ApiClientError } from '@/services/ApiClient';
import { useV2VisionGeneration } from '../useV2VisionGeneration';

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

const job = {
  id: 'job-1', visionId: 'vision-1', anchorId: 'anchor-1', setNumber: 1, retryCount: 0,
  status: 'COMPLETE', stage: 'complete', error: null, candidates: [],
};

describe('useV2VisionGeneration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { success: true, data: null } });
  });

  it('unwraps a persisted generation job after starting', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { success: true, data: job } });
    const { result } = renderHook(() => useV2VisionGeneration('anchor-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { expect(await result.current.start('A future with time and meaningful work.')).toBe(true); });
    expect(result.current.job?.id).toBe('job-1');
    expect(result.current.job?.status).toBe('COMPLETE');
  });

  it('opens the existing Vision premium flow when the server requires access', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new ApiClientError('Access required', 'VISION_PREMIUM_REQUIRED', 403));
    const onPremiumRequired = jest.fn();
    const { result } = renderHook(() => useV2VisionGeneration('anchor-1', onPremiumRequired));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { expect(await result.current.start('A future with time and meaningful work.')).toBe(false); });
    expect(onPremiumRequired).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('sends one start request however many times it is called at once', async () => {
    let resolvePost: (value: unknown) => void = () => undefined;
    (apiClient.post as jest.Mock).mockImplementation(() => new Promise(resolve => { resolvePost = resolve; }));
    const { result } = renderHook(() => useV2VisionGeneration('anchor-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let second: boolean | undefined;
    await act(async () => {
      const first = result.current.start('A future with time and meaningful work.');
      second = await result.current.start('A future with time and meaningful work.');
      resolvePost({ data: { success: true, data: { ...job, status: 'RUNNING' } } });
      await first;
    });
    expect(second).toBe(false);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('keeps polling a running set, pauses in the background and catches up on return', async () => {
    jest.useFakeTimers();
    try {
      const { AppState } = require('react-native');
      let listener: (state: string) => void = () => undefined;
      const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((...args: unknown[]) => {
        listener = args[1] as (state: string) => void;
        return { remove: jest.fn() };
      });
      const running = { ...job, status: 'RUNNING', stage: 'creating_images' };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { success: true, data: running } });
      renderHook(() => useV2VisionGeneration('anchor-1'));
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      const afterMount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => { jest.advanceTimersByTime(2600); await Promise.resolve(); });
      expect((apiClient.get as jest.Mock).mock.calls.length).toBe(afterMount + 1);

      await act(async () => { listener('background'); await Promise.resolve(); });
      const beforeBackground = (apiClient.get as jest.Mock).mock.calls.length;
      await act(async () => { jest.advanceTimersByTime(10_000); await Promise.resolve(); });
      expect((apiClient.get as jest.Mock).mock.calls.length).toBe(beforeBackground);

      await act(async () => { listener('active'); await Promise.resolve(); });
      expect((apiClient.get as jest.Mock).mock.calls.length).toBe(beforeBackground + 1);
      spy.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows a safe error when the deployed endpoint is unavailable', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new ApiClientError('Cannot GET /api/v2/vision/generation', 'ERR_BAD_REQUEST', 404));
    const { result } = renderHook(() => useV2VisionGeneration('anchor-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Image creation is unavailable right now. You can still add your own images.');
  });
});
