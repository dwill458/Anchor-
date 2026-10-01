import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { categories, getCategoryColor } from '@/theme/v2';
import { WORLD_LAYERS } from '@/components/v2/chart/chartJourneyGeometry';
import { fireEvent, render, within } from '@testing-library/react-native';
import { useChartPreview, selectChartPreview } from '@/hooks/useChartPreview';
import { chartPreviewCourses } from '../__fixtures__/chartPreviewStates';
import { ChartPreview } from '../ChartPreview';
import { ChartProgressBar } from '../ChartProgressBar';
import { ChartMapCrop } from '../ChartMapCrop';

jest.mock('@/hooks/useChartPreview', () => ({ ...jest.requireActual('@/hooks/useChartPreview'), useChartPreview: jest.fn() }));
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ useAnchorChart: jest.fn() }));

const variants = ['hero', 'card', 'row'] as const;
const loadMap = (tree: ReturnType<typeof render>) => {
  for (const layer of WORLD_LAYERS) {
    const image = tree.queryByTestId(`chart-world-layer-${layer.id}`, { includeHiddenElements: true });
    if (image) fireEvent(image, 'load');
  }
};

it.each(Object.keys(categories).flatMap(category => variants.map(variant => ({ category, variant }))))
  ('uses $category color with the current Chart map in $variant', ({ category, variant }) => {
    jest.mocked(useChartPreview).mockReturnValue({ ...selectChartPreview(chartPreviewCourses.normal), category });
    const tree = render(<ChartPreview variant={variant} anchorId="a" onPress={jest.fn()} />);
    loadMap(tree);
    expect(StyleSheet.flatten(tree.getByTestId('chart-progress-fill').props.style).backgroundColor).toBe(getCategoryColor(category));
    if (variant !== 'row') {
      expect(StyleSheet.flatten(tree.getByTestId('chart-world-node-preview-waypoint-1', { includeHiddenElements: true }).props.style).borderColor).toBe(getCategoryColor(category));
      expect(tree.getAllByTestId(/^chart-world-layer-/, { includeHiddenElements: true })).toHaveLength(WORLD_LAYERS.length);
      expect(tree.getByTestId('chart-preview-active-region', { includeHiddenElements: true }).props.stroke).toBe(getCategoryColor(category));
    }
  });
describe.each(variants)('%s ChartPreview', variant => {
  it.each(Object.entries(chartPreviewCourses))('renders and snapshots %s, and delegates presses', (state, course) => {
    const data = selectChartPreview(course);
    jest.mocked(useChartPreview).mockReturnValue(data);
    const onPress = jest.fn();
    const tree = render(<ChartPreview variant={variant} anchorId="a" onPress={onPress} />);
    loadMap(tree);
    expect(tree.toJSON()).toMatchSnapshot();
    expect(useChartPreview).toHaveBeenCalledWith('a');
    expect(tree.getAllByRole('button')).toHaveLength(1);
    fireEvent.press(tree.getByTestId('chart-preview'));
    expect(onPress).toHaveBeenCalledTimes(1);
    if (state === 'empty') expect(tree.getByText('Chart your first waypoint')).toBeTruthy();
    else {
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
  loadMap(tree);
  const crop = tree.getByTestId('chart-map-crop', { includeHiddenElements: true });
  const copy = tree.getByTestId('chart-preview-copy');
  expect(within(crop).queryByText('WAYPOINT 1 OF 5')).toBeNull();
  expect(within(copy).getByText('WAYPOINT 1 OF 5')).toBeTruthy();
  expect(within(crop).getByTestId('chart-world-node-preview-waypoint-1', { includeHiddenElements: true })).toBeTruthy();
  expect(StyleSheet.flatten(copy.props.style).position).not.toBe('absolute');
});

it.each(variants)('keeps %s unresolved reads distinct from empty', variant => {
  jest.mocked(useChartPreview).mockReturnValue(null);
  const tree = render(<ChartPreview variant={variant} anchorId="a" onPress={jest.fn()} />);
  expect(tree.queryByText('Chart your first waypoint')).toBeNull();
  expect(tree.getByText('Chart unavailable')).toBeTruthy();
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
  loadMap(tree);
  for (const width of [280, 600]) {
    fireEvent(tree.getByTestId('chart-map-crop', { includeHiddenElements: true }), 'layout', { nativeEvent: { layout: { width } } });
    const crop = StyleSheet.flatten(tree.getByTestId('chart-map-crop', { includeHiddenElements: true }).props.style);
    const node = StyleSheet.flatten(tree.getByTestId(`chart-world-node-preview-waypoint-${waypointIndex}`, { includeHiddenElements: true }).props.style);
    const left = node.transform.find((value: { translateX?: number }) => value.translateX !== undefined).translateX;
    const top = node.transform.find((value: { translateY?: number }) => value.translateY !== undefined).translateY;
    expect(crop.height).toBeCloseTo(width * 9 / 16);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left + node.width).toBeLessThanOrEqual(width);
    expect(top + node.height).toBeLessThanOrEqual(crop.height);
  }
});

it('moves the current map camera as the active waypoint advances and retains the category dotted path', () => {
  const data = selectChartPreview(chartPreviewCourses.normal, 'desire');
  const tree = render(<ChartMapCrop data={data} full={false} />);
  loadMap(tree);
  const positions: string[] = [];
  for (const waypointIndex of [1, 2, 3, 4, 5]) {
    tree.rerender(<ChartMapCrop data={{ ...data, waypointIndex }} full={false} />);
    loadMap(tree);
    expect(tree.getAllByTestId(/^chart-world-layer-/, { includeHiddenElements: true })).toHaveLength(WORLD_LAYERS.length);
    const route = tree.getByTestId('chart-preview-dotted-route', { includeHiddenElements: true });
    positions.push(route.props.d);
    const active = tree.getByTestId('chart-preview-active-route', { includeHiddenElements: true });
    expect(route.props.strokeDasharray).toBe('2 6');
    expect(active.props.strokeDasharray).toBe('2 6');
    expect(active.props.stroke).toBe(getCategoryColor('desire'));
  }
  expect(new Set(positions).size).toBe(5);
});
