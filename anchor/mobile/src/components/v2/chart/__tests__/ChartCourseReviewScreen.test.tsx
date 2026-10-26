import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChartCourseReviewScreen } from '../ChartCourseReviewScreen';
import type { DraftWaypoint } from '../ChartRouteEditor';

jest.mock('../ChartKeyboardFrame', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { ChartKeyboardFrame: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) => <View>{children}{footer}</View> };
});

jest.mock('../ChartRouteEditor', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    ChartRouteEditor: ({ waypoints, testID }: { waypoints: DraftWaypoint[]; testID: string }) => (
      <View testID={testID}>{waypoints.map((waypoint) => <Text key={waypoint.key}>{waypoint.title}</Text>)}</View>
    ),
  };
});

const waypoints: DraftWaypoint[] = [
  { key: 'a', title: 'Build a steady workout routine', rationale: 'Start with a regular habit.', kind: 'MILESTONE', metricLabel: null, metricTarget: null, metricBaseline: null },
  { key: 'b', title: 'Increase workout volume gradually', rationale: null, kind: 'MILESTONE', metricLabel: null, metricTarget: null, metricBaseline: null },
  { key: 'c', title: 'Celebrate measurable strength gains', rationale: null, kind: 'MILESTONE', metricLabel: null, metricTarget: null, metricBaseline: null },
];

describe('ChartCourseReviewScreen', () => {
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
});
