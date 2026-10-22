import React from 'react';
import { render } from '@testing-library/react-native';
import { VisionChartRoute } from '../VisionChartRoute';

const chart = { courseId: 'real-chart', waypointNumber: 3, total: 5, waypointTitle: 'Actual next milestone',
  oneMoveTitle: null, isFinished: false, destination: 'Actual destination' };

it('highlights the actual current waypoint and fades the future route', () => {
  const view = render(<VisionChartRoute chart={chart} />);
  expect(view.getByTestId('vision-chart-waypoint-3').props.r).toBe(4.4);
  expect(view.getByTestId('vision-chart-waypoint-2').props.opacity).toBe(1);
  expect(view.getByTestId('vision-chart-waypoint-4').props.opacity).toBe(0.3);
});

it('keeps the actual waypoint visible on long routes', () => {
  const view = render(<VisionChartRoute chart={{ ...chart, total: 20, waypointNumber: 18 }} />);
  expect(view.getByTestId('vision-chart-waypoint-18').props.r).toBe(4.4);
  expect(view.getByTestId('vision-chart-waypoint-20')).toBeTruthy();
  expect(view.queryByTestId('vision-chart-waypoint-1')).toBeNull();
});

it('shows a finished route without an active waypoint', () => {
  const view = render(<VisionChartRoute chart={{ ...chart, waypointNumber: 5, isFinished: true }} />);
  expect(view.getByTestId('vision-chart-waypoint-5').props.r).toBe(3.3);
  expect(view.getByTestId('vision-chart-waypoint-5').props.opacity).toBe(1);
});
