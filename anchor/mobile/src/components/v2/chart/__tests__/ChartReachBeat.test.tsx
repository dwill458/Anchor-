import React from 'react';
import { render } from '@testing-library/react-native';
import { ChartReachBeat } from '../ChartReachBeat';

describe('ChartReachBeat', () => {
  it('names the reached waypoint while the reach sequence runs', () => {
    const { getByText, getByLabelText } = render(
      <ChartReachBeat visible number={2} title="Reach 1,000 active users" category="career" reducedMotion />
    );
    expect(getByText('REACHED')).toBeTruthy();
    expect(getByText('Reach 1,000 active users')).toBeTruthy();
    expect(getByLabelText('Waypoint 2 reached: Reach 1,000 active users')).toBeTruthy();
  });

  it('renders nothing once the flag has moved on', () => {
    const { queryByText } = render(
      <ChartReachBeat visible={false} number={2} title="Reach 1,000 active users" category="career" reducedMotion />
    );
    expect(queryByText('REACHED')).toBeNull();
  });
});
