import { parseChartDeepLink } from '../chartDeepLinks';

describe('parseChartDeepLink', () => {
  it('parses Chart root, Course, waypoint, and log links', () => {
    expect(parseChartDeepLink('anchor://chart')).toEqual({ kind: 'chart_home' });
    expect(parseChartDeepLink('anchor://chart/course-1')).toEqual({ kind: 'course', courseId: 'course-1' });
    expect(parseChartDeepLink('anchor://chart/course-1/waypoint/wp-2')).toEqual({
      kind: 'waypoint',
      courseId: 'course-1',
      waypointId: 'wp-2',
    });
    expect(parseChartDeepLink('anchor://chart/course-1/log')).toEqual({ kind: 'log', courseId: 'course-1' });
  });

  it('decodes safe IDs and ignores malformed targets', () => {
    expect(parseChartDeepLink('anchor://chart/course%201/waypoint/wp%202')).toEqual({
      kind: 'waypoint',
      courseId: 'course 1',
      waypointId: 'wp 2',
    });
    expect(parseChartDeepLink('anchor://chart/course-1/waypoint')).toBeNull();
    expect(parseChartDeepLink('anchor://chart/course-1/unknown/id')).toBeNull();
    expect(parseChartDeepLink('anchor://chart/%E0%A4%A')).toBeNull();
    expect(parseChartDeepLink('https://example.com/chart/course-1')).toBeNull();
  });
});
