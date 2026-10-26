import { buildCourseLogDays, courseLogTotals, courseStripLayout, formatCourseDuration, practiceModeKey, type CourseLogRow } from '../courseLogModel';

describe('formatCourseDuration', () => {
  it('uses seconds under a minute, whole minutes when exact, otherwise one decimal', () => {
    expect(formatCourseDuration(10)).toBe('10 sec');
    expect(formatCourseDuration(59)).toBe('59 sec');
    expect(formatCourseDuration(60)).toBe('1 min');
    expect(formatCourseDuration(60 + 180)).toBe('4 min');
    expect(formatCourseDuration(30 + 180)).toBe('3.5 min');
    expect(formatCourseDuration(0)).toBe('0 sec');
  });
});

describe('practiceModeKey', () => {
  it('maps every stored spelling to the app mode id', () => {
    expect(practiceModeKey('focus')).toBe('focus');
    expect(practiceModeKey('Deep Prime')).toBe('deep_prime');
    expect(practiceModeKey('deep_prime')).toBe('deep_prime');
    expect(practiceModeKey('Visualize')).toBe('visualize');
    expect(practiceModeKey('release')).toBe('release');
    expect(practiceModeKey(null)).toBe('focus');
  });
});

describe('buildCourseLogDays', () => {
  const now = new Date(2026, 9, 25, 12, 0, 0);
  const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 0, 0).toISOString();
  const row = (id: string, ts: string, seconds: number, kind: CourseLogRow['kind'] = 'session'): CourseLogRow => ({ id, timestamp: ts, kind, title: 'x', mode: 'focus', seconds });

  it('groups by local day, newest first, with Today/Yesterday labels and per-day counts and totals', () => {
    const days = buildCourseLogDays([row('a', at(24, 5), 60), row('b', at(24, 3), 180), row('c', at(21, 8), 60), row('d', at(25, 9), 30)], now);
    expect(days.map(day => day.label)).toEqual(['Today', 'Yesterday', 'Oct 21']);
    expect(days[1].rows.map(r => r.id)).toEqual(['a', 'b']);
    expect(days[1].meta).toMatch(/^Sat, Oct 24 · 2 sessions · 4 min$/);
    expect(days[0].meta).toMatch(/^Sun, Oct 25 · 1 session · 30 sec$/);
    expect(days[2].meta).toMatch(/^Wed · 1 session · 1 min$/);
  });

  it('counts only sessions in totals; event rows add neither count nor time', () => {
    const rows = [row('a', at(24, 5), 60), row('e', at(24, 6), 0, 'event')];
    expect(courseLogTotals(rows)).toEqual({ sessions: 1, seconds: 60 });
    expect(buildCourseLogDays(rows, now)[0].meta).toMatch(/1 session · 1 min$/);
  });
});

describe('courseStripLayout', () => {
  it.each([3, 4, 5, 6, 7])('draws one node per waypoint for %i waypoints, current one flagged', (n) => {
    const layout = courseStripLayout(n, 1);
    expect(layout.nodes).toHaveLength(n);
    expect(layout.nodes.map(node => node.state)).toEqual(['reached', 'current', ...Array(n - 2).fill('upcoming')]);
    expect(layout.complete).toBe(false);
    const xs = layout.nodes.map(node => node.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it('has no current node and reads complete when every waypoint is reached', () => {
    const layout = courseStripLayout(5, 5);
    expect(layout.complete).toBe(true);
    expect(layout.nodes.every(node => node.state === 'reached')).toBe(true);
  });
});
