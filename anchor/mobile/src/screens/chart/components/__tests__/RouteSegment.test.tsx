import React from 'react';
import { render } from '@testing-library/react-native';
import Svg, { Path } from 'react-native-svg';
import { RouteSegment } from '../RouteSegment';

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      View: ReactNative.View,
      createAnimatedComponent: (Component: unknown) => Component,
    },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedProps: (factory: () => unknown) => factory(),
    withTiming: (value: number) => value,
  };
});

const segment = { x1: 0, y1: 100, x2: 100, y2: 0, controlX: 50, controlY: 50 };

function renderInSvg(node: React.ReactElement) {
  const { UNSAFE_getByType } = render(<Svg>{node}</Svg>);
  return UNSAFE_getByType(Path);
}

describe('RouteSegment', () => {
  it('renders a reached segment as gold with no dash pattern', () => {
    const path = renderInSvg(<RouteSegment segment={segment} variant="reached" />);
    expect(path.props.stroke).toBe('#D4AF37');
    expect(path.props.strokeDasharray).toBeUndefined();
  });

  it('renders an upcoming segment muted and dashed', () => {
    const path = renderInSvg(<RouteSegment segment={segment} variant="upcoming" />);
    expect(path.props.stroke).not.toBe('#D4AF37');
    expect(path.props.strokeDasharray).toBeDefined();
  });

  it('renders a blocked segment in amber, distinct from reached gold and upcoming muted', () => {
    const path = renderInSvg(<RouteSegment segment={segment} variant="blocked" />);
    expect(path.props.stroke).toBe('#FFC107');
    expect(path.props.stroke).not.toBe('#D4AF37');
  });

  it('distinguishes the current segment from reached with a violet stroke', () => {
    const path = renderInSvg(<RouteSegment segment={segment} variant="current" />);
    expect(path.props.stroke).toBe('#AD99D2');
    expect(path.props.stroke).not.toBe('#D4AF37');
  });

  it('builds the same quadratic path string regardless of variant', () => {
    const path = renderInSvg(<RouteSegment segment={segment} variant="destinationUpcoming" />);
    expect(path.props.d).toBe('M 0 100 Q 50 50 100 0');
  });

  it('renders via the animated illuminating branch without crashing and keeps the same path geometry', () => {
    const path = renderInSvg(<RouteSegment segment={segment} variant="current" illuminating />);
    expect(path.props.d).toBe('M 0 100 Q 50 50 100 0');
    expect(path.props.stroke).toBe('#AD99D2');
  });
});
