jest.mock('@/services/ChartApiClient', () => ({ chartApiClient: { getCourseLog: jest.fn() }, getChartErrorCode: () => 'NETWORK' }));
jest.mock('../courseStore', () => ({ chartLogCacheKey: (accountId: string, courseId: string) => `anchor:chart:log:${accountId}:${courseId}` }));
jest.mock('../encryptedPersistStorage', () => ({ encryptedPersistStorage: { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined) } }));

import { useCourseLogStore } from '../courseLogStore';
import { chartApiClient } from '@/services/ChartApiClient';
import type { CourseLogEntry } from '@/types/chart';

const event = (id: string): CourseLogEntry => ({ id, eventType: 'COURSE_CREATED', message: '', waypointId: null, occurredAt: '2026-08-03T00:00:00.000Z', recordedAt: '2026-08-03T00:00:00.000Z', snapshot: null, reflection: null, practiceSession: null, anchorLink: null });

describe('Course Log pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCourseLogStore.setState({ accountId: 'account', courseId: 'course', entries: [], nextCursor: null, loading: false, refreshing: false, offline: false, errorCode: null });
  });

  it('preserves authoritative page order and suppresses duplicate event IDs', async () => {
    const mockGetCourseLog = chartApiClient.getCourseLog as jest.Mock;
    mockGetCourseLog
      .mockResolvedValueOnce({ data: [event('newest'), event('shared')], pagination: { nextCursor: 'cursor-1', hasMore: true } })
      .mockResolvedValueOnce({ data: [event('shared'), event('older')], pagination: { nextCursor: null, hasMore: false } });
    await useCourseLogStore.getState().refresh();
    expect(mockGetCourseLog).toHaveBeenCalledWith('course', { limit: 25 });
    await useCourseLogStore.getState().loadMore();
    expect(useCourseLogStore.getState().entries.map((item) => item.id)).toEqual(['newest', 'shared', 'older']);
  });
});
