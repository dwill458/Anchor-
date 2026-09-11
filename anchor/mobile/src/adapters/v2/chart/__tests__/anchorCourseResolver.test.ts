import { chartApiClient } from '@/services/ChartApiClient';
import { resolveV2ChartCourse } from '../anchorCourseResolver';

jest.mock('@/services/ChartApiClient', () => ({
  chartApiClient: { resolveForAnchor: jest.fn() },
}));

describe('resolveV2ChartCourse', () => {
  it('returns the server Course ID for Chart-only continuation', async () => {
    (chartApiClient.resolveForAnchor as jest.Mock).mockResolvedValue({ data: { id: 'course-real-1' } });

    const courseId = await resolveV2ChartCourse('anchor-real-1', 'chart-entry-1');

    expect(courseId).toBe('course-real-1');
    expect(courseId).not.toBe('anchor-real-1');
    expect(chartApiClient.resolveForAnchor).toHaveBeenCalledWith({
      anchorId: 'anchor-real-1',
      idempotencyKey: 'chart-entry-1',
    });
  });
});
