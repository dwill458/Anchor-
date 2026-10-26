import React from 'react';
import * as RN from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';
import { ChartCourseReviewScreen } from '../ChartCourseReviewScreen';
import type { DraftWaypoint } from '../ChartRouteEditor';

// Mock the getter's owning module: spying on a Babel namespace copy of react-native
// does not replace the named import used by ChartCourseReviewScreen.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 360, height: 780, scale: 1, fontScale: 1 })),
}));

jest.mock('../ChartKeyboardFrame', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { ChartKeyboardFrame: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) => <View>{children}{footer}</View> };
});

jest.mock('../ChartRouteEditor', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    ChartRouteEditor: ({ waypoints, testID, renderRowExtra }: { waypoints: DraftWaypoint[]; testID: string; renderRowExtra?: (waypoint: DraftWaypoint, index: number) => React.ReactNode }) => (
      <View testID={testID}>{waypoints.map((waypoint, index) => <View key={waypoint.key} testID={`mock-waypoint-${waypoint.key}`}><Text>{waypoint.title}</Text>{renderRowExtra?.(waypoint, index)}</View>)}</View>
    ),
  };
});

const waypoints: DraftWaypoint[] = [
  { key: 'a', title: 'Build a steady workout routine', rationale: 'Start with a regular habit.', kind: 'MILESTONE', metricLabel: null, metricTarget: null, metricBaseline: null },
  { key: 'b', title: 'Increase workout volume gradually', rationale: null, kind: 'MILESTONE', metricLabel: null, metricTarget: null, metricBaseline: null },
  { key: 'c', title: 'Celebrate measurable strength gains', rationale: null, kind: 'MILESTONE', metricLabel: null, metricTarget: null, metricBaseline: null },
];

describe('ChartCourseReviewScreen', () => {
  beforeEach(() => jest.mocked(RN.useWindowDimensions).mockReturnValue({ width: 360, height: 780, scale: 1, fontScale: 1 }));
  afterEach(() => jest.restoreAllMocks());
  it('renders dynamic course copy, full destination, route explanation, and waypoint association', () => {
    const screen = render(<ChartCourseReviewScreen
      destination="Build a healthier life"
      waypoints={waypoints}
      oneMove="Choose specific workout days and times, then add them to your calendar."
      onOneMoveChange={jest.fn()}
      onWaypointsChange={jest.fn()}
      guidance="Focus first on building a steady workout habit."
      saving={false}
      canConfirm
      onAdjust={jest.fn()}
      onConfirm={jest.fn()}
      topInset={24}
    />);

    expect(screen.getByText("Here's the course I'd start with.")).toBeTruthy();
    expect(screen.getByText("We found 3 meaningful waypoints for this destination. Keep what fits. Change what doesn't.")).toBeTruthy();
    expect(screen.getByText('YOUR DESTINATION')).toBeTruthy();
    expect(screen.getByText('Build a healthier life')).toBeTruthy();
    expect(screen.getByText('FOR WAYPOINT 1')).toBeTruthy();
    expect(screen.getByText('Focus first on building a steady workout habit.')).toBeTruthy();
    expect(screen.getByTestId('chart-review-count').props.children.props.children).toBe('3 waypoints');
    expect(screen.getByText('Reveal my Chart')).toBeTruthy();
  });

  it.each([3, 5, 7, 12])('shows all %i waypoints and the complete long destination without a line cap', (count) => {
    const destination = 'Anchor has 10,000 paying users acquired mainly through App Store search, ranking top 10 in downloads';
    const rows = Array.from({ length: count }, (_, i) => ({ ...waypoints[0], key: `waypoint-${i}`, title: `Meaningful achievement ${i + 1}` }));
    const screen = render(<ChartCourseReviewScreen destination={destination} waypoints={rows} oneMove="Ask one current user what helped them stay" onOneMoveChange={jest.fn()} onWaypointsChange={jest.fn()} saving={false} canConfirm onAdjust={jest.fn()} onConfirm={jest.fn()} topInset={24} />);
    expect(screen.getByText(destination).props.numberOfLines).toBeUndefined();
    expect(screen.getByText(`${count} waypoints`)).toBeTruthy();
    expect(screen.getByText(`Meaningful achievement ${count}`)).toBeTruthy();
  });

  it('keeps long recommendations multiline and grows the input as content grows', () => {
    const recommendation = 'Choose specific workout days and times, then add them to your calendar. '.repeat(3);
    const screen = render(<ChartCourseReviewScreen
      destination="A healthier life"
      waypoints={waypoints}
      oneMove={recommendation}
      onOneMoveChange={jest.fn()}
      onWaypointsChange={jest.fn()}
      saving={false}
      canConfirm
      onAdjust={jest.fn()}
      onConfirm={jest.fn()}
      topInset={24}
    />);
    const input = screen.getByTestId('chart-review-one-move');

    expect(input.props.value).toBe(recommendation);
    expect(input.props.multiline).toBe(true);
    expect(input.props.scrollEnabled).toBe(false);
    expect(input.props.maxLength).toBe(120);
    fireEvent(input, 'contentSizeChange', { nativeEvent: { contentSize: { height: 112 } } });
    expect(input.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ height: 112 })]));
  });

  it('places the editable next move inside the first named waypoint and moves it when reordered', () => {
    const unnamed = { ...waypoints[0], key: 'blank', title: '' };
    const common = { destination: 'A healthier life', oneMove: 'Pick the next workout', onOneMoveChange: jest.fn(), onWaypointsChange: jest.fn(), saving: false, canConfirm: true, onAdjust: jest.fn(), onConfirm: jest.fn(), topInset: 24 };
    const screen = render(<ChartCourseReviewScreen {...common} waypoints={[unnamed, ...waypoints]} />);
    expect(within(screen.getByTestId('mock-waypoint-a')).getByTestId('chart-review-one-move')).toBeTruthy();
    expect(within(screen.getByTestId('mock-waypoint-a')).getByText('FOR WAYPOINT 2')).toBeTruthy();
    expect(within(screen.getByTestId('mock-waypoint-blank')).queryByTestId('chart-review-one-move')).toBeNull();
    expect(screen.getAllByTestId('chart-review-one-move')).toHaveLength(1);
    screen.rerender(<ChartCourseReviewScreen {...common} waypoints={[waypoints[1], unnamed, waypoints[0], waypoints[2]]} />);
    expect(within(screen.getByTestId('mock-waypoint-b')).getByTestId('chart-review-one-move')).toBeTruthy();
    expect(within(screen.getByTestId('mock-waypoint-b')).getByText('FOR WAYPOINT 1')).toBeTruthy();
    expect(within(screen.getByTestId('mock-waypoint-a')).queryByTestId('chart-review-one-move')).toBeNull();
    fireEvent.changeText(screen.getByTestId('chart-review-one-move'), 'Start today');
    expect(common.onOneMoveChange).toHaveBeenCalledWith('Start today');
  });

  it('uses an unpadded compact destination with the 19/25 serif line', () => {
    const screen = render(<ChartCourseReviewScreen destination="A healthier life" waypoints={waypoints} oneMove="Start" onOneMoveChange={jest.fn()} onWaypointsChange={jest.fn()} saving={false} canConfirm onAdjust={jest.fn()} onConfirm={jest.fn()} topInset={24} />);
    expect(RN.StyleSheet.flatten(screen.getByText('A healthier life').props.style)).toEqual(expect.objectContaining({ fontSize: 19, lineHeight: 25 }));
    const destination = RN.StyleSheet.flatten(screen.getByTestId('chart-review-destination').props.style);
    expect(destination.padding ?? 0).toBe(0);
  });

  it.each([[1, 'nowrap'], [1.29, 'nowrap'], [1.3, 'wrap']])('at font scale %s uses footer wrapping %s', (fontScale, flexWrap) => {
    jest.mocked(RN.useWindowDimensions).mockReturnValue({ width: 360, height: 780, scale: 1, fontScale: Number(fontScale) });
    const screen = render(<ChartCourseReviewScreen destination="A healthier life" waypoints={waypoints} oneMove="Start" onOneMoveChange={jest.fn()} onWaypointsChange={jest.fn()} saving={false} canConfirm onAdjust={jest.fn()} onConfirm={jest.fn()} topInset={24} />);
    const footer = screen.UNSAFE_getAllByType(RN.View).find(node => {
      const style = RN.StyleSheet.flatten(node.props.style);
      return style?.flexDirection === 'row' && Array.isArray(node.props.children) && node.props.children.some((child: React.ReactElement<{ testID?: string }>) => child?.props?.testID === 'chart-review-adjust');
    });
    expect(RN.StyleSheet.flatten(footer?.props.style)?.flexWrap).toBe(flexWrap);
    if (fontScale === 1) {
      expect(RN.StyleSheet.flatten(screen.getByTestId('chart-review-adjust').props.style).flex).toBe(0.8);
      expect(RN.StyleSheet.flatten(screen.getByTestId('chart-review-confirm').props.style).flex).toBe(1.2);
      expect(screen.getByText('Reveal my Chart').props.numberOfLines).toBe(1);
    }
  });
});
