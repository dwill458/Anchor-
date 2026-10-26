const mockEntranceDelays: number[] = [];
jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  type MockEntranceBuilder = {
    duration: (duration: number) => MockEntranceBuilder;
    delay: (delay: number) => MockEntranceBuilder;
    reduceMotion: (mode: unknown) => MockEntranceBuilder;
    easing: (curve: unknown) => MockEntranceBuilder;
  };
  const builder: MockEntranceBuilder = {
    duration: jest.fn(() => builder),
    delay: jest.fn((delay: number) => { mockEntranceDelays.push(delay); return builder; }),
    reduceMotion: jest.fn(() => builder),
    easing: jest.fn(() => builder),
  };
  return { __esModule: true, ...actual, FadeInDown: builder };
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ChartRouteEditor, CHART_ROUTE_ROW_HEIGHT, routeDropIndexFromOffset, type DraftWaypoint } from '../ChartRouteEditor';
import { spacing } from '@/theme/v2';

const waypoints: DraftWaypoint[] = ['a', 'b', 'c'].map(key => ({ key, title: `Waypoint ${key}`, rationale: null, kind: 'MILESTONE', metricLabel: null, metricTarget: null, metricBaseline: null }));

describe('Chart route expanded-row geometry and arrival', () => {
  beforeEach(() => { jest.useFakeTimers(); mockEntranceDelays.length = 0; });
  afterEach(() => jest.useRealTimers());

  it('resolves drag targets with a 240 point first row containing the next move', () => {
    const heights = [240, 58, 58];
    expect(routeDropIndexFromOffset(0, 148, heights)).toBe(0);
    expect(routeDropIndexFromOffset(0, 149, heights)).toBe(1);
    expect(routeDropIndexFromOffset(0, 207, heights)).toBe(2);
    expect(routeDropIndexFromOffset(2, -208, heights)).toBe(0);
  });

  it('keeps rail endpoints at title-line centers after an expanded row is measured', () => {
    const screen = render(<ChartRouteEditor waypoints={waypoints} onChange={jest.fn()} showRail renderRowExtra={(_, index) => index === 0 ? <Text testID="row-extra">Your next move</Text> : null} reducedMotion />);
    let first = screen.getByText('Waypoint a').parent;
    while (first && !first.props.onLayout) first = first.parent;
    expect(first).toBeTruthy();
    fireEvent(first!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 240 } } });
    const rails = screen.UNSAFE_getAllByType(View).filter(node => node.props.pointerEvents === 'none' && StyleSheet.flatten(node.props.style)?.left === 13.5);
    expect(StyleSheet.flatten(rails[0].props.style).top).toBe(CHART_ROUTE_ROW_HEIGHT / 2);
    expect(StyleSheet.flatten(rails[rails.length - 1].props.style).bottom).toBe(CHART_ROUTE_ROW_HEIGHT / 2);
    let extraIndent = screen.getByTestId('row-extra').parent;
    while (extraIndent && StyleSheet.flatten(extraIndent.props.style)?.marginLeft === undefined) extraIndent = extraIndent.parent;
    expect(StyleSheet.flatten(extraIndent?.props.style)?.marginLeft).toBe(28 + spacing[3]);
  });

  it('plays a delayed row arrival once per waypoint key and preserves it through edits and reorder', () => {
    const screen = render(<ChartRouteEditor waypoints={waypoints} onChange={jest.fn()} reducedMotion={false} entranceDelayMs={600} />);
    expect(mockEntranceDelays).toEqual([600, 670, 740]);
    screen.rerender(<ChartRouteEditor waypoints={[waypoints[1], { ...waypoints[0], title: 'Renamed waypoint' }, waypoints[2]]} onChange={jest.fn()} reducedMotion={false} entranceDelayMs={600} />);
    expect(mockEntranceDelays).toEqual([600, 670, 740]);
  });

  it('ends the rail at the title of an expanded last row', () => {
    const screen = render(<ChartRouteEditor waypoints={waypoints} onChange={jest.fn()} showRail reducedMotion renderRowExtra={(_, index) => index === 2 ? <Text>Last row extra</Text> : null} />);
    let last = screen.getByText('Waypoint c').parent;
    while (last && !last.props.onLayout) last = last.parent;
    fireEvent(last!, 'layout', { nativeEvent: { layout: { height: 240, width: 360, x: 0, y: 0 } } });
    const rails = screen.UNSAFE_getAllByType(View).filter(node => node.props.pointerEvents === 'none' && StyleSheet.flatten(node.props.style)?.left === 13.5);
    expect(StyleSheet.flatten(rails[2].props.style).bottom).toBe(240 - CHART_ROUTE_ROW_HEIGHT / 2);
  });

  it('caps the entrance stagger after eight rows', () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({ ...waypoints[0], key: `arrival-${index}` }));
    render(<ChartRouteEditor waypoints={rows} onChange={jest.fn()} reducedMotion={false} entranceDelayMs={600} />);
    expect(mockEntranceDelays).toEqual([600, 670, 740, 810, 880, 950, 1020, 1090, 1090, 1090]);
  });

  it('skips every row entrance under reduced motion', () => {
    render(<ChartRouteEditor waypoints={waypoints} onChange={jest.fn()} reducedMotion entranceDelayMs={600} />);
    expect(mockEntranceDelays).toEqual([]);
  });
});
