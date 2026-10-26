jest.mock('@/services/ApiClient', () => ({
  ...jest.requireActual('@/services/ApiClient'),
  apiClient: { post: jest.fn() },
}));

import { apiClient, ApiClientError } from '@/services/ApiClient';
import { chartV2Api } from '../chartV2Api';

it('uses v2 access for waypoint completion and returns the authoritative Chart', async () => {
  const completion = { completedWaypoint: { id: 'w1' }, chart: { id: 'c1', version: 6 } };
  jest.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true, data: completion } });
  const input = { idempotencyKey: 'chart2:reach:c1:w1:5', expectedCourseVersion: 5 };
  await expect(chartV2Api.completeWaypoint('course/1', 'waypoint/1', input)).resolves.toEqual(completion);
  expect(apiClient.post).toHaveBeenCalledWith('/api/v2/charts/course%2F1/waypoints/waypoint%2F1/complete', input);
});

it('preserves version-conflict classification for a stale completion', async () => {
  jest.mocked(apiClient.post).mockRejectedValueOnce(new ApiClientError('Version conflict', 'COURSE_VERSION_CONFLICT', 409));
  await expect(chartV2Api.completeWaypoint('c1', 'w1', { idempotencyKey: 'reach-key', expectedCourseVersion: 5 }))
    .rejects.toMatchObject({ kind: 'conflict', code: 'COURSE_VERSION_CONFLICT' });
});
