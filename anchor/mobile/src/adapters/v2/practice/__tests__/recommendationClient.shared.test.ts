jest.mock('@/services/ApiClient', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('../recommendationCache', () => ({ rememberV2RecommendationContext: jest.fn() }));
import { apiClient } from '@/services/ApiClient';
import { useAuthStore } from '@/stores/authStore';
import { fetchV2RecommendationContext, type V2RecommendationContext } from '../recommendationClient';
import { rememberV2RecommendationContext } from '../recommendationCache';

it('canceling one selected screen does not cancel the shared five-Anchor prefetch', async () => {
  useAuthStore.setState({ user: { id: 'shared-thread-owner' } as never });
  let finish!: (value: unknown) => void;
  jest.mocked(apiClient.get).mockImplementationOnce((_url, config) => new Promise((resolve, reject) => {
    finish = resolve;
    config?.signal?.addEventListener?.('abort', () => reject(new Error('transport cancelled')));
  }) as never);
  const controller = new AbortController();
  const selectedRead = fetchV2RecommendationContext('shared-anchor', controller.signal);
  const warmRead = fetchV2RecommendationContext('shared-anchor');
  const warmOutcome = warmRead.then(value => ({ value }), error => ({ error }));
  const canceled = expect(selectedRead).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await canceled;
  const context: V2RecommendationContext = {
    anchorId: 'shared-anchor', completionSignal: null, vision: { exists: false, seenToday: false },
    thread: { strength: 68, delta7d: 4, delta7dStatus: 'AVAILABLE', status: 'AVAILABLE' },
    recommendation: { action: 'Focus', reason: 'server' },
  };
  finish({ data: { success: true, data: context } });
  await expect(warmOutcome).resolves.toEqual({ value: context });
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  expect(rememberV2RecommendationContext).toHaveBeenCalledWith('shared-anchor', context, 'shared-thread-owner');
});
