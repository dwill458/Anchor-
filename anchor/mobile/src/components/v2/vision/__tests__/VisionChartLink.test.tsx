import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { VisionChartLink } from '../VisionChartLink';

it('keeps the no-Chart action and explanation on separate lines with a visible illustration', () => {
  const onPress = jest.fn();
  const view = render(<VisionChartLink chart={null} width={360} onPress={onPress} />);
  expect(view.getByText('Create a Chart')).toBeTruthy();
  expect(view.getByText('Map the route to this Vision.')).toBeTruthy();
  expect(view.queryByTestId('vision-chart-mini-map')).toBeNull();
  const image = StyleSheet.flatten(view.getByTestId('vision-chart-illustration').props.style);
  expect(image.width).toBe(360);
  expect(image.height).toBe(120);
  expect(image.position).not.toBe('absolute');
  fireEvent.press(view.getByTestId('vision-on-your-chart'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('uses the actual waypoint and keeps illustration sizing proportional on narrow screens', () => {
  const chart = { courseId: 'actual', waypointNumber: 4, total: 6, waypointTitle: 'A longer real waypoint title that wraps',
    oneMoveTitle: null, isFinished: false, destination: 'Real destination' };
  const view = render(<VisionChartLink chart={chart} width={320} onPress={() => undefined} />);
  expect(view.getByText('Waypoint 4 of 6')).toBeTruthy();
  expect(view.getByText(chart.waypointTitle)).toBeTruthy();
  expect(view.queryByText('Create a Chart')).toBeNull();
  expect(view.getByTestId('vision-chart-waypoint-4').props.r).toBe(4.4);
  expect(StyleSheet.flatten(view.getByTestId('vision-chart-illustration').props.style).height).toBeCloseTo(320 / 3);
});
