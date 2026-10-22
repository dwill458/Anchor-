const mockGetForAnchor = jest.fn();
const mockArchive = jest.fn();
const mockArchiveForAnchor = jest.fn();
const mockDelete = jest.fn();
const mockDeleteForAnchor = jest.fn();
const mockCancelNotifications = jest.fn().mockResolvedValue(undefined);

jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
  readSecureValue: jest.fn().mockResolvedValue(null),
  writeSecureValue: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/notifications/chartNotifications', () => ({
  cancelChartNotifications: (...args: unknown[]) => mockCancelNotifications(...args),
}));

jest.mock('@/services/v2/chartV2Api', () => {
  const actual = jest.requireActual('@/services/v2/chartV2Api');
  return {
    ...actual,
    chartV2Api: {
      ...actual.chartV2Api,
      getForAnchor: (...args: unknown[]) => mockGetForAnchor(...args),
      archive: (...args: unknown[]) => mockArchive(...args),
      archiveForAnchor: (...args: unknown[]) => mockArchiveForAnchor(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      deleteForAnchor: (...args: unknown[]) => mockDeleteForAnchor(...args),
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

  it('archives active chart, cancels notifications, and reloads anchor chart', async () => {
    const activeCourse = {
      id: 'course-1',
      destinationText: 'Destination 1',
      status: 'ACTIVE' as const,
      version: 2,
      currentWaypointId: 'wp-1',
      waypointCount: 1,
      reachedCount: 0,
      plottedAt: new Date().toISOString(),
      completedAt: null,
      archivedAt: null,
      destinationAnchorLink: null,
      waypoints: [],
    };
    const initial = {
      ...chartSnapshot('My Goal'),
      chart: activeCourse,
      history: [],
    };
    const freshArchived = {
      ...chartSnapshot('My Goal'),
      chart: null,
      history: [{ ...activeCourse, status: 'ARCHIVED' as const, archivedAt: new Date().toISOString() }],
    };

    mockGetForAnchor.mockResolvedValueOnce(initial);
    const { result } = renderHook(() => useAnchorChart('anchor-home-cache'));
    await waitFor(() => expect(result.current.data?.chart?.id).toBe('course-1'));

    mockArchive.mockResolvedValueOnce({ ...activeCourse, status: 'ARCHIVED' });
    mockGetForAnchor.mockResolvedValueOnce(freshArchived);

    let ok = false;
    await act(async () => {
      ok = await result.current.archiveChart();
    });

    expect(ok).toBe(true);
    expect(mockArchive).toHaveBeenCalledWith('course-1', 2);
    expect(mockCancelNotifications).toHaveBeenCalledWith('anchor-home-cache', 'chart-cache-user');
    await waitFor(() => expect(result.current.data?.chart).toBeNull());
    expect(result.current.data?.history.length).toBe(1);
  });

  it('deletes active chart, cancels notifications, and reloads anchor chart', async () => {
    const activeCourse = {
      id: 'course-2',
      destinationText: 'Destination 2',
      status: 'ACTIVE' as const,
      version: 1,
      currentWaypointId: 'wp-1',
      waypointCount: 1,
      reachedCount: 0,
      plottedAt: new Date().toISOString(),
      completedAt: null,
      archivedAt: null,
      destinationAnchorLink: null,
      waypoints: [],
    };
    const initial = {
      ...chartSnapshot('My Goal 2'),
      chart: activeCourse,
      history: [],
    };
    const freshDeleted = {
      ...chartSnapshot('My Goal 2'),
      chart: null,
      history: [],
    };

    mockGetForAnchor.mockResolvedValueOnce(initial);
    const { result } = renderHook(() => useAnchorChart('anchor-home-cache'));
    await waitFor(() => expect(result.current.data?.chart?.id).toBe('course-2'));

    mockDelete.mockResolvedValueOnce({ deleted: true });
    mockGetForAnchor.mockResolvedValueOnce(freshDeleted);

    let ok = false;
    await act(async () => {
      ok = await result.current.deleteChart();
    });

    expect(ok).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith('course-2', 1);
    expect(mockCancelNotifications).toHaveBeenCalledWith('anchor-home-cache', 'chart-cache-user');
    await waitFor(() => expect(result.current.data?.chart).toBeNull());
    expect(result.current.data?.history.length).toBe(0);
  });
});
