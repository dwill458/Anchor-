const mockGetCourseLog = jest.fn();
const mockReadCourseLogCache = jest.fn();
const mockWriteCourseLogCache = jest.fn();
let mockChartResponse: {
  data: { chart: { id: string; version: number } | null; history: Array<{ id: string }> } | null;
  loading: boolean;
  refresh: jest.Mock;
} = { data: { chart: { id: 'course-1', version: 1 }, history: [] }, loading: false, refresh: jest.fn() };

jest.mock('@/services/ChartApiClient', () => ({
  chartApiClient: {
    getCourseLog: (...args: unknown[]) => mockGetCourseLog(...args),
  },
}));

jest.mock('@/stores/courseLogStore', () => ({
  readCourseLogCache: (...args: unknown[]) => mockReadCourseLogCache(...args),
  writeCourseLogCache: (...args: unknown[]) => mockWriteCourseLogCache(...args),
}));

jest.mock('../useAnchorChart', () => ({
  useAnchorChart: () => mockChartResponse,
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuthStore } from '@/stores/authStore';
import type { CourseLogEntry } from '@/types/chart';
import { useAnchorCourseLog } from '../useAnchorCourseLog';

const entry = (id: string): CourseLogEntry => ({
  id,
  eventType: 'WAYPOINT_REACHED',
  message: id,
  waypointId: `waypoint-${id}`,
  occurredAt: '2026-09-28T12:00:00.000Z',
  recordedAt: '2026-09-28T12:00:00.000Z',
  snapshot: { waypointTitle: id },
  reflection: null,
  practiceSession: null,
  anchorLink: null,
});

describe('useAnchorCourseLog Home cache-first loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChartResponse = {
      data: { chart: { id: 'course-1', version: 1 }, history: [] },
      loading: false,
      refresh: jest.fn(),
    };
    useAuthStore.setState({ user: { id: 'progress-cache-user' } as never });
    mockReadCourseLogCache.mockResolvedValue([entry('cached')]);
    mockWriteCourseLogCache.mockResolvedValue(undefined);
  });

  it('shows the encrypted Progress evidence while its server log revalidates', async () => {
    let finishServerRead!: (value: { data: CourseLogEntry[] }) => void;
    mockGetCourseLog.mockReturnValueOnce(new Promise((resolve) => { finishServerRead = resolve; }));

    const { result } = renderHook(() => useAnchorCourseLog('anchor-1'));
    await waitFor(() => expect(result.current.entries).toEqual([entry('cached')]));
    expect(result.current.loading).toBe(true);
    expect(mockReadCourseLogCache).toHaveBeenCalledWith('progress-cache-user', 'course-1');

    await act(async () => {
      finishServerRead({ data: [entry('server')] });
    });
    await waitFor(() => expect(result.current.entries).toEqual([entry('server')]));
    expect(result.current.loading).toBe(false);
    expect(mockWriteCourseLogCache).toHaveBeenCalledWith('progress-cache-user', 'course-1', [entry('server')]);
  });

  it('settles the Progress dependency when the confirmed Chart has no routes', async () => {
    mockChartResponse = { data: null, loading: false, refresh: jest.fn() };

    const { result } = renderHook(() => useAnchorCourseLog('anchor-without-chart'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasChart).toBe(false);
    expect(mockGetCourseLog).not.toHaveBeenCalled();
  });
});
