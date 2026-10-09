import { renderHook } from '@testing-library/react-native';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { selectChartPreview, useChartPreview } from '../useChartPreview';
import { chartPreviewCourses } from '@/components/chart/__fixtures__/chartPreviewStates';

jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ useAnchorChart: jest.fn() }));

describe('Chart preview selection', () => {
  it.each([
    [54, 1000, 0], [0, 1000, 0], [1200, 1000, 1], [54, 0, 30 / 84],
    [-10, 1000, 0], [NaN, 1000, 0], [Infinity, 1000, 0], [54, -1, 30 / 85],
  ])('clamps current %s / target %s to %s from the recorded baseline', (current, target, progress) => {
    const course = chartPreviewCourses.normal!;
    const changed = { ...course, waypoints: course.waypoints.map((w, i) => i === 0
      ? { ...w, metric: { label: null, baseline: 84, current, target } } : w) };
    expect(selectChartPreview(changed).progress).toBe(progress);
    expect(selectChartPreview(changed).startValue).toBe(84);
  });

  it('returns the requested empty shape', () => {
    expect(selectChartPreview(null)).toEqual({ status: 'empty', waypointIndex: 0, waypointTotal: 0,
      title: 'Chart your first waypoint', current: null, target: null, startValue: null, progress: 0, nextMove: null, category: null });
  });

  it('keeps a just-reached waypoint visible until the server starts the next', () => {
    expect(selectChartPreview(chartPreviewCourses.reached)).toMatchObject({ status: 'active',
      waypointIndex: 1, progress: 1, nextMove: null });
  });

  it('only marks the Chart complete when the server confirms it', () => {
    expect(selectChartPreview(chartPreviewCourses.complete)).toMatchObject({ status: 'complete',
      title: 'Chart complete', waypointIndex: 5, waypointTotal: 5, progress: 1, nextMove: null });
    const course = chartPreviewCourses.normal!;
    expect(selectChartPreview({ ...course, waypoints: course.waypoints.map(w => ({ ...w, state: 'REACHED' })) }).status).toBe('active');
  });

  it('does not invent numeric values for an unmeasured waypoint', () => {
    const course = chartPreviewCourses.normal!;
    expect(selectChartPreview({ ...course, waypoints: course.waypoints.map(w => ({ ...w, metric: null })) }))
      .toMatchObject({ current: null, target: null, startValue: null, progress: 0 });
  });

  it('uses live route ordering and excludes cancelled waypoints', () => {
    const course = chartPreviewCourses.normal!;
    expect(selectChartPreview({ ...course, currentWaypointId: 'w3', waypoints: [
      ...course.waypoints.slice().reverse().map(w => w.id === 'w2' ? { ...w, state: 'CANCELLED' as const } : w),
    ] })).toMatchObject({ waypointIndex: 2, waypointTotal: 4, title: 'Waypoint 3' });
  });

  it('does not show completed or suggested moves as next actions', () => {
    const course = chartPreviewCourses.normal!;
    expect(selectChartPreview({ ...course, moves: course.moves!.map(m => ({ ...m, status: 'COMPLETED' })) }).nextMove).toBeNull();
  });

  it('selects fresh data from the shared hook and switches Anchors', () => {
    const mock = jest.mocked(useAnchorChart);
    mock.mockReturnValue({ data: { chart: chartPreviewCourses.normal }, loading: false, error: null } as ReturnType<typeof useAnchorChart>);
    const { result, rerender } = renderHook(({ id }) => useChartPreview(id), { initialProps: { id: 'a' } });
    expect(result.current?.progress).toBe((254 - 84) / (1000 - 84));
    mock.mockReturnValue({ data: { chart: chartPreviewCourses.regressed }, loading: false, error: null } as ReturnType<typeof useAnchorChart>);
    rerender({ id: 'b' });
    expect(mock).toHaveBeenLastCalledWith('b');
    expect(result.current?.progress).toBe(0);
  });

  it('carries the real Anchor category through the single preview hook', () => {
    jest.mocked(useAnchorChart).mockReturnValue({ data: { anchor: { category: 'health' },
      chart: chartPreviewCourses.normal } } as ReturnType<typeof useAnchorChart>);
    expect(renderHook(() => useChartPreview('health-anchor')).result.current?.category).toBe('health');
  });

  it.each([{ data: null, loading: true, error: null }, { data: null, loading: false, error: { kind: 'offline' } }])
    ('does not present unknown or failed reads as an empty Chart', source => {
      jest.mocked(useAnchorChart).mockReturnValue(source as ReturnType<typeof useAnchorChart>);
      expect(renderHook(() => useChartPreview('a')).result.current).toBeNull();
    });
});
