import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
  useRoute: () => ({ params: {}, name: 'V2AnchorLibrary', key: 'k' }),
}));
jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => false, useCreationReduceMotion: () => false }));
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { ...actual, __esModule: true, withDelay: jest.fn(actual.withDelay), withSpring: jest.fn(actual.withSpring) };
});

import { useAnchorStore } from '@/stores/anchorStore';
import { V2AnchorLibraryScreen } from '../V2AnchorLibraryScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

const withDelay = Reanimated.withDelay as jest.Mock;
const withSpring = Reanimated.withSpring as jest.Mock;

beforeEach(() => {
  mockNavigate.mockClear();
  withDelay.mockClear();
  withSpring.mockClear();
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
});

describe('V2AnchorLibraryScreen motion', () => {
  it('stages its arrival and still renders every one of 40 Anchors', () => {
    useAnchorStore.setState({
      anchors: Array.from({ length: 40 }, (_, i) => makeAnchor({ id: `x${i}`, intentionText: `Intention ${i}` })),
    });
    render(<V2AnchorLibraryScreen />);
    expect(withDelay).toHaveBeenCalled();
    expect(screen.getByText('Intention 0')).toBeTruthy();
    expect(screen.getByText('Intention 39')).toBeTruthy();
    // No delay is ever longer than the stagger cap allows (cap 6 × 60ms, plus the two header slots).
    const longest = Math.max(...withDelay.mock.calls.map(([delay]) => delay as number));
    expect(longest).toBeLessThanOrEqual(6 * 60);
  });

  it('does not replay the arrival when the screen re-renders or the filter changes', () => {
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a', intentionText: 'Active one' }), makeAnchor({ id: 'r', intentionText: 'Released one', isReleased: true, releasedAt: new Date() })],
      currentAnchorId: 'a',
    });
    const view = render(<V2AnchorLibraryScreen />);
    const afterMount = withDelay.mock.calls.length;
    expect(afterMount).toBeGreaterThan(0);
    view.rerender(<V2AnchorLibraryScreen />);
    expect(withDelay.mock.calls.length).toBe(afterMount);
    fireEvent.press(screen.getByLabelText('Released'));
    expect(screen.getByText('Released one')).toBeTruthy();
    expect(screen.queryByText('Active one')).toBeNull();
    expect(withDelay.mock.calls.length).toBe(afterMount);
  });

  it('tracks the touch on a gallery item and still opens its details', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', intentionText: 'Focus deeply' })] });
    const view = render(<V2AnchorLibraryScreen />);
    const tracked = view.UNSAFE_root.findAll(
      (node: { props?: Record<string, unknown> }) =>
        typeof node.props?.accessibilityLabel === 'string' &&
        (node.props.accessibilityLabel as string).includes('Focus deeply') &&
        typeof node.props.onPressIn === 'function',
    );
    expect(tracked.length).toBeGreaterThan(0);
    fireEvent.press(screen.getByLabelText(/Focus deeply/));
    expect(mockNavigate).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a' });
  });

  it('keeps the filter control mounted when the screen re-renders, so the first change slides the pill', () => {
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a', intentionText: 'Active one' }), makeAnchor({ id: 'r', intentionText: 'Released one', isReleased: true, releasedAt: new Date() })],
      currentAnchorId: 'a',
    });
    render(<V2AnchorLibraryScreen />);
    fireEvent(screen.getByLabelText('Filter Anchors'), 'layout', { nativeEvent: { layout: { width: 300, height: 50, x: 0, y: 0 } } });
    withSpring.mockClear();
    fireEvent.press(screen.getByLabelText('Active'));
    expect(withSpring).toHaveBeenCalledTimes(1);
  });
});
