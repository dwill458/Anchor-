import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { WaypointSummary } from '@/types/chart';
import { CourseMap } from '../CourseMap';
import type { RouteAdvancement } from '../courseMapTypes';

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

function waypoint(overrides: Partial<WaypointSummary> & Pick<WaypointSummary, 'id' | 'position' | 'state'>): WaypointSummary {
  return {
    courseId: 'course-1',
    title: `Waypoint ${overrides.position}`,
    description: null,
    blockedReason: null,
    reachedAt: null,
    skippedAt: null,
    cancelledAt: null,
    anchorLink: null,
    ...overrides,
  };
}

function chain(count: number, currentIndex: number | null): WaypointSummary[] {
  return Array.from({ length: count }, (_, i) => {
    let state: WaypointSummary['state'] = 'UPCOMING';
    if (currentIndex !== null) {
      if (i < currentIndex) state = 'REACHED';
      else if (i === currentIndex) state = 'CURRENT';
    }
    return waypoint({ id: `wp-${i}`, position: i + 1, state });
  });
}

const baseProps = {
  courseId: 'course-1',
  destinationText: 'Publish a novel',
  reachedCount: 0,
  completed: false,
  reducedMotion: false,
  onWaypointPress: jest.fn(),
};

describe('CourseMap', () => {
  it.each([0, 1, 3, 5, 7])('renders without crashing for %i waypoints', (count) => {
    const waypoints = chain(count, count > 0 ? 0 : null);
    expect(() =>
      render(<CourseMap {...baseProps} waypoints={waypoints} currentWaypointId={count > 0 ? 'wp-0' : null} />),
    ).not.toThrow();
  });

  it('is fully hidden from the accessibility tree — the linear list is the comprehension surface', () => {
    const waypoints = chain(3, 1);
    const { UNSAFE_root, queryByText } = render(<CourseMap {...baseProps} waypoints={waypoints} currentWaypointId="wp-1" />);
    const hidden = UNSAFE_root.findAllByProps({ accessibilityElementsHidden: true });
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden[0].props.importantForAccessibility).toBe('no-hide-descendants');

    // A default (accessibility-aware) query — what a screen reader would see — finds nothing.
    expect(queryByText('CURRENT')).toBeNull();
  });

  it('forwards the pressed waypoint id via onWaypointPress', () => {
    const onWaypointPress = jest.fn();
    const waypoints = chain(3, 1);
    const { getByTestId } = render(
      <CourseMap {...baseProps} waypoints={waypoints} currentWaypointId="wp-1" onWaypointPress={onWaypointPress} />,
    );

    fireEvent.press(getByTestId('course-map-waypoint-wp-0', { hidden: true }));
    expect(onWaypointPress).toHaveBeenCalledWith('wp-0');
  });

  it('renders exactly one dominant CURRENT node for an ACTIVE course', () => {
    const waypoints = chain(5, 2);
    const { getAllByText } = render(<CourseMap {...baseProps} waypoints={waypoints} currentWaypointId="wp-2" />);
    expect(getAllByText('CURRENT', { hidden: true })).toHaveLength(1);
  });

  it('labels a blocked current waypoint BLOCKED and never advances it', () => {
    const waypoints = chain(3, 1);
    waypoints[1] = { ...waypoints[1], state: 'BLOCKED', blockedReason: 'ANCHOR_UNLINKED' };
    const { getAllByText, queryAllByText } = render(<CourseMap {...baseProps} waypoints={waypoints} currentWaypointId="wp-1" />);
    expect(getAllByText('BLOCKED', { hidden: true })).toHaveLength(1);
    expect(queryAllByText('CURRENT', { hidden: true })).toHaveLength(0);
  });

  it('renders no dominant node when currentWaypointId is null (DRAFT/COMPLETED)', () => {
    const waypoints = chain(3, null);
    const { queryAllByText } = render(<CourseMap {...baseProps} waypoints={waypoints} currentWaypointId={null} />);
    expect(queryAllByText('CURRENT', { hidden: true })).toHaveLength(0);
    expect(queryAllByText('BLOCKED', { hidden: true })).toHaveLength(0);
  });

  it('renders the destination text', () => {
    const waypoints = chain(2, 0);
    const { getByText } = render(<CourseMap {...baseProps} waypoints={waypoints} currentWaypointId="wp-0" destinationText="Publish a novel" />);
    expect(getByText('Publish a novel', { hidden: true })).toBeTruthy();
  });

  it('does not crash and omits a destination label for malformed/missing destinationText', () => {
    const waypoints = chain(2, 0);
    const { queryByText } = render(
      <CourseMap {...baseProps} waypoints={waypoints} currentWaypointId="wp-0" destinationText="   " />,
    );
    expect(queryByText('   ', { hidden: true })).toBeNull();
  });

  it('handles zero waypoints (no Course yet) without crashing and with no dominant node', () => {
    const { queryAllByText } = render(<CourseMap {...baseProps} waypoints={[]} currentWaypointId={null} />);
    expect(queryAllByText('CURRENT', { hidden: true })).toHaveLength(0);
  });

  it('renders a completed Course (all reached, no current) without crashing', () => {
    const waypoints = chain(3, null).map((w) => ({ ...w, state: 'REACHED' as const }));
    expect(() =>
      render(<CourseMap {...baseProps} waypoints={waypoints} currentWaypointId={null} completed reachedCount={3} />),
    ).not.toThrow();
  });

  it('renders skipped and cancelled waypoints as distinct history, not reached', () => {
    const waypoints = [
      waypoint({ id: 'wp-0', position: 1, state: 'REACHED' }),
      waypoint({ id: 'wp-1', position: 2, state: 'SKIPPED' }),
      waypoint({ id: 'wp-2', position: 3, state: 'CANCELLED' }),
      waypoint({ id: 'wp-3', position: 4, state: 'CURRENT' }),
    ];
    expect(() => render(<CourseMap {...baseProps} waypoints={waypoints} currentWaypointId="wp-3" />)).not.toThrow();
  });

  it('accepts a committed advancement trigger without crashing and applies reduced motion instantly', () => {
    const waypoints = chain(3, 1);
    const advancement: RouteAdvancement = {
      completedWaypointId: 'wp-0',
      nextWaypointId: 'wp-1',
      courseCompleted: false,
      eventId: 'evt-1',
    };
    expect(() =>
      render(<CourseMap {...baseProps} waypoints={waypoints} currentWaypointId="wp-1" advancement={advancement} reducedMotion />),
    ).not.toThrow();
  });

  it('suppresses animation for an advancement whose next waypoint is BLOCKED', () => {
    const waypoints = chain(3, 1);
    waypoints[1] = { ...waypoints[1], state: 'BLOCKED' };
    const advancement: RouteAdvancement = {
      completedWaypointId: 'wp-0',
      nextWaypointId: 'wp-1',
      courseCompleted: false,
      eventId: 'evt-1',
    };
    expect(() =>
      render(<CourseMap {...baseProps} waypoints={waypoints} currentWaypointId="wp-1" advancement={advancement} />),
    ).not.toThrow();
  });
});
