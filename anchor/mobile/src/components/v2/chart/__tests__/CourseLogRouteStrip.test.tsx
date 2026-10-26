import React from 'react';
import { render } from '@testing-library/react-native';
import { CourseLogRouteStrip } from '../CourseLogRouteStrip';

describe('CourseLogRouteStrip', () => {
  it('says where the person is now', () => {
    const screen = render(<CourseLogRouteStrip total={5} reachedCount={1} title="Complete bodywork" />);
    expect(screen.getByTestId('course-log-strip-caption').props.children).toBe('Now on 2 · Complete bodywork');
  });

  it('reads Course complete when every waypoint is reached', () => {
    const screen = render(<CourseLogRouteStrip total={4} reachedCount={4} title="Anything" />);
    expect(screen.getByTestId('course-log-strip-caption').props.children).toBe('Course complete');
  });

  it.each([3, 7])('renders for %i waypoints', (total) => {
    expect(render(<CourseLogRouteStrip total={total} reachedCount={0} title="First" />).getByTestId('course-log-strip')).toBeTruthy();
  });
});
