import { AnchorGenerationService } from '../AnchorGenerationService';
import { Image } from 'react-native';
import { useDevImageModelStore } from '@/stores/devImageModelStore';

jest.mock('@/services/backendWarmup', () => ({ warmUpBackend: jest.fn() }));
jest.mock('@/services/AuthService', () => ({ AuthService: { getIdToken: jest.fn(async () => 'test-token') } }));
jest.mock('@/services/ErrorTrackingService', () => ({ ErrorTrackingService: { addBreadcrumb: jest.fn(), captureException: jest.fn() } }));
jest.mock('@/services/FrictionAnalytics', () => ({ FrictionAnalytics: { stepCompleted: jest.fn(), flowError: jest.fn() } }));
jest.mock('@/services/PerformanceMonitoring', () => ({ PerformanceMonitoring: { startTrace: () => ({ putAttribute: jest.fn(), stop: jest.fn() }) } }));
jest.mock('@/utils/developerMasterAccount', () => ({ DEVELOPER_MASTER_ACCOUNT_ID: 'dev-master-account' }));

describe('Anchor comparison request', () => {
  const originalFetch = global.fetch;
  beforeEach(() => { useDevImageModelStore.setState({ anchor: null, vision: null }); });
  afterEach(() => { global.fetch = originalFetch; useDevImageModelStore.setState({ anchor: null, vision: null }); });

  it.each(['Network unavailable', 'Selected model unavailable'])('reports %s instead of showing developer fixtures for a pinned model', async message => {
    const resolve = jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({ uri: 'fixture.jpg', width: 1, height: 1, scale: 1 });
    global.fetch = jest.fn().mockRejectedValue(new Error(message));
    useDevImageModelStore.getState().select('anchor', 'gemini-nano-banana-2.1');
    try {
      await expect(AnchorGenerationService.generate({
        sigilSvg: '<svg/>', styleChoice: 'cosmic', intentionText: 'I focus', category: 'career', generationAttempt: 1, userId: 'dev-master-account',
      })).rejects.toThrow(message);
      expect(resolve).not.toHaveBeenCalled();
    } finally { resolve.mockRestore(); }
  });

  it('sends the selected Anchor model while leaving Auto requests unchanged', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ variations: [] }) });
    global.fetch = fetchMock;
    const input = { sigilSvg: '<svg/>', styleChoice: 'cosmic' as const, intentionText: 'I focus', category: 'career' as const, generationAttempt: 1 };
    useDevImageModelStore.getState().select('anchor', 'gpt-image-2.5-sunburst');
    await AnchorGenerationService.generate(input);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ devImageModel: 'gpt-image-2.5-sunburst', sigilSvg: '<svg/>' });
    useDevImageModelStore.getState().select('anchor', null);
    await AnchorGenerationService.generate(input);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty('devImageModel');
  });
});
