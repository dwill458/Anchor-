import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { categories, getCategoryColor } from '@/theme/v2';
import { MAP_W, MAP_H } from '@/components/v2/chart/map/chartMapContracts';
import { waypointPlacement } from '@/components/v2/chart/map/chartMapGeometry';
import { fireEvent, render, within } from '@testing-library/react-native';
import { useChartPreview, selectChartPreview } from '@/hooks/useChartPreview';
import { chartPreviewCourses } from '../__fixtures__/chartPreviewStates';
import { ChartPreview } from '../ChartPreview';
import { ChartProgressBar } from '../ChartProgressBar';
import { ChartMapCrop } from '../ChartMapCrop';

jest.mock('@/hooks/useChartPreview', () => ({ ...jest.requireActual('@/hooks/useChartPreview'), useChartPreview: jest.fn() }));
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ useAnchorChart: jest.fn() }));

const variants = ['hero', 'card', 'row'] as const;
// GPU textures in the Skia mock retain React internals. Snapshot the canvas
// boundary; category, marker states and crop geometry are asserted separately.
expect.addSnapshotSerializer({
  test: value => value?.type === 'Canvas',
  print: value => `<Canvas style=${JSON.stringify((value as { props: { style: unknown } }).props.style)} />`,
});
it.each(Object.keys(categories).flatMap(category => variants.map(variant => ({ category, variant }))))
  ('uses $category color with the current Chart map in $variant', ({ category, variant }) => {
    jest.mocked(useChartPreview).mockReturnValue({ ...selectChartPreview(chartPreviewCourses.normal), category });
    const tree = render(<ChartPreview variant={variant} anchorId="a" onPress={jest.fn()} />);
    expect(StyleSheet.flatten(tree.getByTestId('chart-progress-fill').props.style).backgroundColor).toBe(getCategoryColor(category));
    if (variant !== 'row') {
      const map = tree.UNSAFE_root.findAll((node: { props: { testID?: string; categoryColor?: string } }) => node.props.testID === 'chart-preview-etched-map' && node.props.categoryColor !== undefined)[0];
      expect(map.props.categoryColor).toBe(getCategoryColor(category));
      expect(map.props.category).toBe(category);
      expect(map.props.interactive).toBe(false);
    }
  });
describe.each(variants)('%s ChartPreview', variant => {
  it.each(Object.entries(chartPreviewCourses))('renders and snapshots %s, and delegates presses', (state, course) => {
    const data = selectChartPreview(course);
    jest.mocked(useChartPreview).mockReturnValue(data);
    const onPress = jest.fn();
    const tree = render(<ChartPreview variant={variant} anchorId="a" onPress={onPress} />);
    expect(tree.toJSON()).toMatchSnapshot();
    expect(useChartPreview).toHaveBeenCalledWith('a');
    expect(tree.getAllByRole('button')).toHaveLength(1);
    fireEvent.press(tree.getByTestId('chart-preview'));
    expect(onPress).toHaveBeenCalledTimes(1);
    if (state === 'empty') expect(tree.getByText('Chart your first waypoint')).toBeTruthy();
    else {
      if (variant !== 'row') {
        const map = tree.UNSAFE_root.findAll((node: { props: { testID?: string; categoryColor?: string } }) => node.props.testID === 'chart-preview-etched-map' && node.props.categoryColor !== undefined)[0];
        expect(map.props.arrived).toBe(state === 'complete');
        expect(map.props.anim.fog.value).toBe(state === 'complete' ? 1 : 0);
        if (state === 'complete') {
          expect(map.props.anim.flagOpacity.value).toBe(0);
          expect(map.props.markers.every((marker: { state: string }) => marker.state === 'done')).toBe(true);
        }
      }
      expect(tree.getByRole('progressbar').props.accessibilityValue.now).toBeCloseTo(data.progress * 100);
      if (state === 'complete') {
        expect(tree.getByText('Chart complete')).toBeTruthy();
        expect(tree.queryByText('Next move')).toBeNull();
      }
      if (variant === 'hero') expect(tree.getByText('started at 84')).toBeTruthy();
      else expect(tree.queryByText('started at 84')).toBeNull();
    }
    if (variant === 'row') {
      expect(tree.UNSAFE_queryAllByType(Image)).toHaveLength(0);
      expect(StyleSheet.flatten(tree.getByTestId('chart-preview').props.style).minHeight).toBeGreaterThanOrEqual(44);
      if (data.nextMove) {
        expect(tree.getByText(data.nextMove).props.numberOfLines).toBe(1);
        expect(tree.getByText(data.nextMove).props.ellipsizeMode).toBe('tail');
      }
    }
  });
});

it('contains the card node inside the map and the waypoint label in a separate flowing block', () => {
  jest.mocked(useChartPreview).mockReturnValue(selectChartPreview(chartPreviewCourses.normal));
  const tree = render(<ChartPreview variant="card" anchorId="a" onPress={jest.fn()} />);
  const crop = tree.getByTestId('chart-map-crop', { includeHiddenElements: true });
  const copy = tree.getByTestId('chart-preview-copy');
  expect(within(crop).queryByText('WAYPOINT 1 OF 5')).toBeNull();
  expect(within(copy).getByText('WAYPOINT 1 OF 5')).toBeTruthy();
  expect(within(crop).getByTestId('chart-map-marker-0', { includeHiddenElements: true })).toBeTruthy();
  expect(StyleSheet.flatten(copy.props.style).position).not.toBe('absolute');
});

it.each(variants)('keeps %s unresolved reads distinct from empty', variant => {
  jest.mocked(useChartPreview).mockReturnValue(null);
  const tree = render(<ChartPreview variant={variant} anchorId="a" onPress={jest.fn()} />);
  expect(tree.queryByText('Chart your first waypoint')).toBeNull();
  expect(tree.getByTestId('chart-preview-loading')).toBeTruthy();
});

it.each([0, -1, NaN, Infinity, 0.00001, 1, 2])('keeps bar width finite and visible only for positive progress %s', progress => {
  const tree = render(<ChartProgressBar progress={progress} />);
  const style = StyleSheet.flatten(tree.getByTestId('chart-progress-fill').props.style);
  const expected = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  expect(style.width).toBe(`${expected * 100}%`);
  expect(style.minWidth).toBe(expected > 0 ? 4 : 0);
});

it.each([1, 2, 3, 4, 5])('keeps cropped node %s within a 16:9 viewport at narrow and wide widths', waypointIndex => {
  const data = { ...selectChartPreview(chartPreviewCourses.normal), waypointIndex };
  const tree = render(<ChartMapCrop data={data} full={false} />);
  for (const width of [280, 600]) {
    fireEvent(tree.getByTestId('chart-map-crop', { includeHiddenElements: true }), 'layout', { nativeEvent: { layout: { width } } });
    const crop = StyleSheet.flatten(tree.getByTestId('chart-map-crop', { includeHiddenElements: true }).props.style);
    const top = -StyleSheet.flatten(tree.getByTestId('chart-preview-map-offset', { includeHiddenElements: true }).props.style).top;
    const point = waypointPlacement(data.waypointTotal).points[waypointIndex - 1];
    const y = point.y * width / MAP_W - top;
    const radius = 30 * width / MAP_W;
    expect(crop.height).toBeCloseTo(width * 9 / 16);
    expect(y - radius).toBeGreaterThanOrEqual(0);
    expect(y + radius).toBeLessThanOrEqual(crop.height);

  }
});

it('crops the etched map around each active waypoint, while hero retains the full map', () => {
  const data = selectChartPreview(chartPreviewCourses.normal, 'desire');
  const tree = render(<ChartMapCrop data={data} full={false} />);
  const offsets: number[] = [];
  for (const waypointIndex of [1, 2, 3, 4, 5]) {
    tree.rerender(<ChartMapCrop data={{ ...data, waypointIndex }} full={false} />);
    offsets.push(StyleSheet.flatten(tree.getByTestId('chart-preview-map-offset', { includeHiddenElements: true }).props.style).top);
    const map = tree.UNSAFE_root.findAll((node: { props: { testID?: string; categoryColor?: string } }) => node.props.testID === 'chart-preview-etched-map' && node.props.categoryColor !== undefined)[0];
    expect(map.props.anim.flagIndex.value).toBe(waypointIndex - 1);
    expect(map.props.anim.revealArc.value).toBeCloseTo(map.props.placement.arcs[waypointIndex - 1]);
    expect(map.props.categoryColor).toBe(getCategoryColor('desire'));
  }
  expect(new Set(offsets).size).toBe(5);
  tree.rerender(<ChartMapCrop data={data} full />);
  expect(StyleSheet.flatten(tree.getByTestId('chart-map-crop', { includeHiddenElements: true }).props.style).height).toBeCloseTo(320 * MAP_H / MAP_W);
  expect(StyleSheet.flatten(tree.getByTestId('chart-preview-map-offset', { includeHiddenElements: true }).props.style).top).toBe(0);
});
