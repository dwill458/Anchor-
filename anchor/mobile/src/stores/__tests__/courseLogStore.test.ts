jest.mock('@/services/ChartApiClient', () => ({ chartApiClient: { getCourseLog: jest.fn() }, getChartErrorCode: () => 'NETWORK' }));
jest.mock('../courseStore', () => ({ chartLogCacheKey: (accountId: string, courseId: string) => `anchor:chart:log:${accountId}:${courseId}` }));
jest.mock('../encryptedPersistStorage', () => ({ encryptedPersistStorage: {
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
} }));

import {
  chartLogIndexKey,
  purgeCourseLogsForAccount,
  useCourseLogStore,
} from '../courseLogStore';
import { encryptedPersistStorage } from '../encryptedPersistStorage';
import { chartApiClient } from '@/services/ChartApiClient';
import type { CourseLogEntry } from '@/types/chart';

const event = (id: string): CourseLogEntry => ({ id, eventType: 'COURSE_CREATED', message: '', waypointId: null, occurredAt: '2026-08-03T00:00:00.000Z', recordedAt: '2026-08-03T00:00:00.000Z', snapshot: null, reflection: null, practiceSession: null, anchorLink: null });

describe('Course Log pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (encryptedPersistStorage.getItem as jest.Mock).mockResolvedValue(null);
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

  it('clears private in-memory entries synchronously and purges the account log keys', async () => {
    useCourseLogStore.setState({
      accountId: 'private-account',
      courseId: 'private-course',
      entries: [event('private-reflection')],
    });

    useCourseLogStore.getState().clearAccount('private-account');

    expect(useCourseLogStore.getState()).toMatchObject({
      accountId: null,
      courseId: null,
      entries: [],
    });

    await purgeCourseLogsForAccount('private-account');
    expect(encryptedPersistStorage.removeItem).toHaveBeenCalledWith(
      'anchor:chart:log:private-account:private-course',
    );
    expect(encryptedPersistStorage.removeItem).toHaveBeenCalledWith(
      chartLogIndexKey('private-account'),
    );
  });

  it('uses the durable index to purge logs that were not opened this session', async () => {
    (encryptedPersistStorage.getItem as jest.Mock).mockImplementation(async (key: string) =>
      key === chartLogIndexKey('restored-account')
        ? JSON.stringify({ schemaVersion: 1, accountId: 'restored-account', courseIds: ['historical-course'] })
        : null,
    );

    await purgeCourseLogsForAccount('restored-account');

    expect(encryptedPersistStorage.removeItem).toHaveBeenCalledWith(
      'anchor:chart:log:restored-account:historical-course',
    );
  });

  it('drops the previous account entries before awaiting the next account cache', async () => {
    const mockGetCourseLog = chartApiClient.getCourseLog as jest.Mock;
    mockGetCourseLog.mockResolvedValue({ data: [], pagination: { nextCursor: null, hasMore: false } });
    useCourseLogStore.setState({
      accountId: 'account-a',
      courseId: 'course-a',
      entries: [event('account-a-private-entry')],
    });

    const binding = useCourseLogStore.getState().bind('account-b', 'course-b');
    expect(useCourseLogStore.getState().entries).toEqual([]);
    expect(useCourseLogStore.getState().accountId).toBe('account-b');
    await binding;
  });
});
