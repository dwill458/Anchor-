import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { WaypointSummary } from '@/types/chart';
import { WaypointNode } from '../WaypointNode';

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      View: ReactNative.View,
      createAnimatedComponent: (Component: unknown) => Component,
    },
    Easing: { inOut: () => undefined, sin: undefined, cubic: undefined, out: () => undefined },
    cancelAnimation: jest.fn(),
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useAnimatedProps: (factory: () => unknown) => factory(),
    withTiming: (value: number) => value,
    withRepeat: (animation: unknown) => animation,
    withSequence: (...animations: unknown[]) => animations[animations.length - 1],
  };
});

function waypoint(overrides: Partial<WaypointSummary> & Pick<WaypointSummary, 'id' | 'state'>): WaypointSummary {
  return {
    courseId: 'course-1',
    position: 1,
    title: 'Waypoint title',
    description: null,
    blockedReason: null,
    reachedAt: null,
    skippedAt: null,
    cancelledAt: null,
    anchorLink: null,
    ...overrides,
  };
}

const baseProps = {
  emphasis: 'dominant' as const,
  isDominant: true,
  labelSide: 'right' as const,
  reducedMotion: false,
  onPress: jest.fn(),
  x: 160,
  y: 100,
  mapWidth: 320,
  mapHeight: 400,
};

describe('WaypointNode', () => {
  (['CURRENT', 'REACHED', 'BLOCKED', 'SKIPPED', 'CANCELLED', 'UPCOMING'] as const).forEach((state) => {
    it(`renders without crashing for state ${state}`, () => {
      const wp = waypoint({ id: `wp-${state}`, state, title: `${state} title` });
      const { getByTestId } = render(
        <WaypointNode {...baseProps} waypoint={wp} isDominant={state === 'CURRENT' || state === 'BLOCKED'} testID={`node-${state}`} />,
      );
      expect(getByTestId(`node-${state}`, { hidden: true })).toBeTruthy();
    });
  });

  it('invokes onPress with the waypoint id, not a full object (no mutation callback)', () => {
    const onPress = jest.fn();
    const wp = waypoint({ id: 'wp-1', state: 'CURRENT' });
    const { getByTestId } = render(<WaypointNode {...baseProps} waypoint={wp} onPress={onPress} testID="node" />);

    fireEvent.press(getByTestId('node', { hidden: true }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith('wp-1');
  });

  it('exposes at least a 44x44 hit target even when the visual node is smaller', () => {
    const wp = waypoint({ id: 'wp-1', state: 'UPCOMING' });
    const { getByTestId } = render(
      <WaypointNode {...baseProps} waypoint={wp} emphasis="subdued" isDominant={false} testID="node" />,
    );
    const node = getByTestId('node', { hidden: true });
    const flatStyle = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
    expect(flatStyle.width).toBeGreaterThanOrEqual(44);
    expect(flatStyle.height).toBeGreaterThanOrEqual(44);
  });

  it('is hidden from the accessibility tree (decorative — the linear list is the comprehension surface)', () => {
    const wp = waypoint({ id: 'wp-1', state: 'CURRENT' });
    const { getByTestId, queryByTestId } = render(<WaypointNode {...baseProps} waypoint={wp} testID="node" />);

    const node = getByTestId('node', { hidden: true });
    expect(node.props.accessibilityElementsHidden).toBe(true);
    expect(node.props.importantForAccessibility).toBe('no-hide-descendants');

    // A default (accessibility-aware) query — what a screen reader would see — finds nothing.
    expect(queryByTestId('node')).toBeNull();
  });

  it('renders a CURRENT/BLOCKED pill only for the dominant node', () => {
    const current = waypoint({ id: 'wp-1', state: 'CURRENT' });
    const { queryByText, rerender } = render(<WaypointNode {...baseProps} waypoint={current} isDominant testID="node" />);
    expect(queryByText('CURRENT', { hidden: true })).toBeTruthy();

    const upcoming = waypoint({ id: 'wp-2', state: 'UPCOMING' });
    rerender(<WaypointNode {...baseProps} waypoint={upcoming} isDominant={false} emphasis="subdued" testID="node" />);
    expect(queryByText('CURRENT', { hidden: true })).toBeNull();
  });

  it('labels a blocked current waypoint BLOCKED, not CURRENT', () => {
    const blocked = waypoint({ id: 'wp-1', state: 'BLOCKED', blockedReason: 'ANCHOR_RELEASED' });
    const { queryByText } = render(<WaypointNode {...baseProps} waypoint={blocked} isDominant testID="node" />);
    expect(queryByText('BLOCKED', { hidden: true })).toBeTruthy();
    expect(queryByText('CURRENT', { hidden: true })).toBeNull();
  });
});
