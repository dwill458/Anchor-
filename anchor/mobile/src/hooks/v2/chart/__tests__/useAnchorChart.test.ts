const mockGetForAnchor = jest.fn();

jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
  readSecureValue: jest.fn().mockResolvedValue(null),
  writeSecureValue: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/v2/chartV2Api', () => {
  const actual = jest.requireActual('@/services/v2/chartV2Api');
  return {
    ...actual,
    chartV2Api: {
      ...actual.chartV2Api,
      getForAnchor: (...args: unknown[]) => mockGetForAnchor(...args),
    },
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuthStore } from '@/stores/authStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import type { ChartForAnchor } from '@/services/v2/chartV2Api';
import { peekAnchorChart, primeAnchorChart, resetAnchorChartCache, useAnchorChart } from '../useAnchorChart';

const chartSnapshot = (intentionText: string): ChartForAnchor => ({
  anchor: {
    id: 'anchor-home-cache',
    intentionText,
    category: 'career',
    enhancedImageUrl: null,
    released: false,
  },
  chart: null,
  history: [],
  stats: null,
});

describe('useAnchorChart Home cache-first hydration', () => {
  beforeEach(() => {
    resetAnchorChartCache();
    jest.clearAllMocks();
    jest.mocked(encryptedPersistStorage.getItem).mockResolvedValue(null);
    useAuthStore.setState({ user: { id: 'chart-cache-user' } as never });
  });

  it('shows the encrypted Chart snapshot while server authority revalidates', async () => {
    const cached = chartSnapshot('Cached intention');
    const fresh = chartSnapshot('Server intention');
    jest.mocked(encryptedPersistStorage.getItem).mockResolvedValueOnce(JSON.stringify(cached));
    let finishServerRead!: (value: ChartForAnchor) => void;
    mockGetForAnchor.mockReturnValueOnce(new Promise<ChartForAnchor>((resolve) => { finishServerRead = resolve; }));

    const { result } = renderHook(() => useAnchorChart('anchor-home-cache'));

    await waitFor(() => expect(result.current.data).toEqual(cached));
    expect(result.current.stale).toBe(true);
    expect(mockGetForAnchor).toHaveBeenCalledWith('anchor-home-cache');
    expect(encryptedPersistStorage.getItem).toHaveBeenCalledWith(
      'anchor:v2:chart2:chart-cache-user:anchor-home-cache',
    );

    await act(async () => {
      finishServerRead(fresh);
    });
    await waitFor(() => expect(result.current.data).toEqual(fresh));
    expect(result.current.stale).toBe(false);
  });

  it('keeps in-memory Chart presentation caches isolated by account', () => {
    const cached = chartSnapshot('Private intention');
    useAuthStore.setState({ user: { id: 'chart-cache-user' } as never });
    primeAnchorChart('shared-local-id', { ...cached, anchor: { ...cached.anchor, id: 'shared-local-id' } });
    expect(peekAnchorChart('shared-local-id')?.anchor.intentionText).toBe('Private intention');

    useAuthStore.setState({ user: { id: 'other-account' } as never });
    expect(peekAnchorChart('shared-local-id')).toBeNull();
  });
});
