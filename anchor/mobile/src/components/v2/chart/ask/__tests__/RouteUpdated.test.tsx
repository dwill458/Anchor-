jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { __esModule: true, ...actual };
});
jest.mock('@/components/v2/anchor/CircularAnchorRenderer', () => {
  const { View } = require('react-native');
  return { CircularAnchorRenderer: (props: { svg: string; category?: string }) => <View testID="route-updated-anchor" accessibilityLabel={`avatar:${props.svg}:${props.category}`} /> };
});
const mockNotify = jest.fn();
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn(), selection: jest.fn(), notification: (...args: unknown[]) => mockNotify(...args) } }));

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChartRouteUpdated, ROUTE_UPDATED_TIMING } from '../ChartRouteUpdated';
import { ROUTE_UPDATED, routeUpdatedSupport } from '../routeUpdatedCopy';

const art = { svg: '<svg id="mine"/>', imageUrl: null, category: 'health', expression: null };

describe('routeUpdatedSupport', () => {
  it('describes only what was actually saved', () => {
    expect(routeUpdatedSupport({ kind: 'MOVES_ADDED', count: 1, waypointTitle: 'Prepare the exterior' })).toBe('Added a move to “Prepare the exterior”.');
    expect(routeUpdatedSupport({ kind: 'MOVES_ADDED', count: 3, waypointTitle: 'Prepare the exterior' })).toBe('Added 3 moves to “Prepare the exterior”.');
    expect(routeUpdatedSupport({ kind: 'MOVES_ADDED', count: 2, waypointTitle: null })).toBe('Added 2 moves to your Chart.');
    expect(routeUpdatedSupport({ kind: 'ROUTE_REVISED', aheadCount: 4, firstTitle: 'Strip paint' })).toBe('Your route now has 4 waypoints ahead, starting with “Strip paint”.');
    expect(routeUpdatedSupport({ kind: 'ROUTE_REVISED', aheadCount: 1, firstTitle: null })).toBe('Your route now has one waypoint ahead.');
  });
});

describe('timing', () => {
  it('resolves in about a second, in order, and never delays the controls past the sequence', () => {
    const T = ROUTE_UPDATED_TIMING;
    expect(T.ringDelay + T.ringDraw).toBeLessThanOrEqual(T.checkAt);
    expect(T.checkAt).toBeLessThan(T.headingAt + 40);
    expect(T.headingAt).toBeLessThan(T.supportAt);
    expect(T.supportAt).toBeLessThan(T.actionsAt);
    expect(T.actionsAt + 220).toBeLessThanOrEqual(1100);
    expect(T.actionsAt + 220).toBeGreaterThanOrEqual(700);
  });
});

describe('ChartRouteUpdated', () => {
  const change = { kind: 'MOVES_ADDED', count: 2, waypointTitle: 'Prepare the exterior' } as const;
  const base = { anchorArt: art, category: 'health', change, reducedMotion: true, onViewChart: jest.fn(), onKeepChatting: jest.fn() };
  beforeEach(() => jest.clearAllMocks());

  it('shows the heading, what changed, and the person’s own Anchor in their category', () => {
    const screen = render(<ChartRouteUpdated {...base} />);
    expect(screen.getByText('Route updated.')).toBeTruthy();
    expect(screen.getByTestId('route-updated-support').props.children).toBe('Added 2 moves to “Prepare the exterior”.');
    expect(screen.getByLabelText('avatar:<svg id="mine"/>:health')).toBeTruthy();
    expect(screen.getByTestId('route-updated-check')).toBeTruthy();
  });

  it('falls back to a quiet disc rather than a stock icon when there is no Anchor art', () => {
    const screen = render(<ChartRouteUpdated {...base} anchorArt={null} />);
    expect(screen.queryByTestId('route-updated-anchor')).toBeNull();
    expect(screen.getByText('Route updated.')).toBeTruthy();
  });

  it('both actions work from the first frame, even with the full motion sequence enabled', () => {
    const onViewChart = jest.fn();
    const onKeepChatting = jest.fn();
    const screen = render(<ChartRouteUpdated {...base} reducedMotion={false} onViewChart={onViewChart} onKeepChatting={onKeepChatting} />);
    fireEvent.press(screen.getByTestId('route-updated-view'));
    fireEvent.press(screen.getByTestId('route-updated-chat'));
    expect(onViewChart).toHaveBeenCalledTimes(1);
    expect(onKeepChatting).toHaveBeenCalledTimes(1);
    expect(screen.getByText(ROUTE_UPDATED.primary)).toBeTruthy();
    expect(screen.getByText(ROUTE_UPDATED.secondary)).toBeTruthy();
  });

  it('offers Keep chatting only when there is a conversation to return to', () => {
    const screen = render(<ChartRouteUpdated {...base} onKeepChatting={null} />);
    expect(screen.queryByTestId('route-updated-chat')).toBeNull();
    expect(screen.getByTestId('route-updated-view')).toBeTruthy();
  });

  it('plays one light success haptic, and only in its resting state under reduced motion', () => {
    render(<ChartRouteUpdated {...base} reducedMotion />);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    mockNotify.mockClear();
    // With motion it fires once, when the check lands (the test animation mock completes instantly).
    render(<ChartRouteUpdated {...base} reducedMotion={false} />);
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  it('is announced as one image with its meaning, and the heading is a header', () => {
    const screen = render(<ChartRouteUpdated {...base} />);
    expect(screen.getByLabelText('Your Anchor, with a check: route updated')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Route updated.' })).toBeTruthy();
  });
});
