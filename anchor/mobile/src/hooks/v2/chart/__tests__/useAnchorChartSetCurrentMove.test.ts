const mockUpdateMove = jest.fn();
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
      updateMove: (...args: unknown[]) => mockUpdateMove(...args),
    },
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuthStore } from '@/stores/authStore';
import type { ChartForAnchor } from '@/services/v2/chartV2Api';
import type { CourseDetail } from '@/types/chart';
import { resetAnchorChartCache, useAnchorChart } from '../useAnchorChart';

const course = (currentMoveId: string | null): CourseDetail =>
  ({
    id: 'course-1',
    destinationText: 'Destination',
    status: 'ACTIVE',
    version: 3,
    currentMoveId,
    currentWaypointId: 'w1',
    plottedAt: '2026-09-01T00:00:00Z',
    waypoints: [],
    moves: [],
  }) as unknown as CourseDetail;

const snapshot = (chart: CourseDetail): ChartForAnchor => ({
  anchor: { id: 'anchor-1', intentionText: 'Intent', category: 'career', enhancedImageUrl: null, released: false },
  chart,
  history: [],
  stats: null,
});

describe('useAnchorChart.setCurrentMove', () => {
  beforeEach(() => {
    resetAnchorChartCache();
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 'chart-user' } as never });
  });

  it('PATCHes makeCurrent and publishes the returned course', async () => {
    mockGetForAnchor.mockResolvedValue(snapshot(course('m1')));
    mockUpdateMove.mockResolvedValue(course('m2'));
    const { result } = renderHook(() => useAnchorChart('anchor-1'));
    await waitFor(() => expect(result.current.data?.chart?.id).toBe('course-1'));

    let ok = false;
    await act(async () => {
      ok = await result.current.setCurrentMove('m2');
    });
    expect(ok).toBe(true);
    expect(mockUpdateMove).toHaveBeenCalledWith('course-1', 'm2', { makeCurrent: true });
    await waitFor(() => expect(result.current.data?.chart?.currentMoveId).toBe('m2'));
  });

  it('returns false when the request fails', async () => {
    mockGetForAnchor.mockResolvedValue(snapshot(course('m1')));
    mockUpdateMove.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAnchorChart('anchor-1'));
    await waitFor(() => expect(result.current.data?.chart?.id).toBe('course-1'));
    let ok = true;
    await act(async () => {
      ok = await result.current.setCurrentMove('m2');
    });
    expect(ok).toBe(false);
  });
});
