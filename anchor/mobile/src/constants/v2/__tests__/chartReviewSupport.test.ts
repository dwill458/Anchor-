import { CHART_COPY, chartReviewSupport } from '../chartCopy';

describe('chart plan step support copy', () => {
  it('renders no waypoint count while the plan is still loading (zero waypoints)', () => {
    const copy = chartReviewSupport(0);
    expect(copy).toBe(CHART_COPY.review.evolve);
    expect(copy).not.toMatch(/\d/);
    expect(copy).not.toMatch(/waypoint/i);
  });

  it('states the real count once the plan has waypoints', () => {
    expect(chartReviewSupport(4)).toBe('We found 4 meaningful waypoints for this destination. Keep what fits. Change what doesn’t.');
    expect(chartReviewSupport(1)).toBe('We found 1 meaningful waypoint for this destination. Keep what fits. Change what doesn’t.');
  });
});
