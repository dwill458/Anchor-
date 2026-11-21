const mockUpdateMove = jest.fn();
const mockGetForAnchor = jest.fn();
const mockReconcile = jest.fn(async (_args: unknown) => undefined);

jest.mock('@/services/notifications/chartMoveReminders', () => ({
  reconcileMoveReminders: (args: unknown) => mockReconcile(args),
  cancelMoveRemindersForAnchor: jest.fn(async () => undefined),
}));

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

describe('useAnchorChart.setMovePlan', () => {
  beforeEach(() => {
    resetAnchorChartCache();
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 'chart-user' } as never });
  });

  const plan = { cue: 'After I wake up', date: '2026-11-17', time: '15:00', remind: true };
  const withPlan = (): CourseDetail =>
    ({ ...course('m1'), moves: [{ id: 'm1', waypointId: 'w1', status: 'ACTIVE', title: 'Open the curtains', plan }] }) as unknown as CourseDetail;

  it('PATCHes only the plan, publishes the result and reconciles reminders', async () => {
    mockGetForAnchor.mockResolvedValue(snapshot(course('m1')));
    mockUpdateMove.mockResolvedValue(withPlan());
    const { result } = renderHook(() => useAnchorChart('anchor-1'));
    await waitFor(() => expect(result.current.data?.chart?.id).toBe('course-1'));
    mockReconcile.mockClear();

    let ok = false;
    await act(async () => {
      ok = await result.current.setMovePlan('m1', plan);
    });
    expect(ok).toBe(true);
    expect(mockUpdateMove).toHaveBeenCalledWith('course-1', 'm1', { plan });
    expect(mockReconcile).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'chart-user',
        anchorId: 'anchor-1',
        view: { active: true, currentWaypointId: 'w1' },
        moves: [expect.objectContaining({ id: 'm1', plan })],
      })
    );
  });

  it('clears with plan: null and returns false on failure', async () => {
    mockGetForAnchor.mockResolvedValue(snapshot(course('m1')));
    mockUpdateMove.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAnchorChart('anchor-1'));
    await waitFor(() => expect(result.current.data?.chart?.id).toBe('course-1'));
    let ok = true;
    await act(async () => {
      ok = await result.current.setMovePlan('m1', null);
    });
    expect(mockUpdateMove).toHaveBeenCalledWith('course-1', 'm1', { plan: null });
    expect(ok).toBe(false);
  });
});
