jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { __esModule: true, ...actual };
});
jest.mock('@/components/v2/anchor/CircularAnchorRenderer', () => ({ CircularAnchorRenderer: () => null }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn(), selection: jest.fn(), notification: jest.fn() } }));
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
let mockParams: Record<string, unknown> = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, canGoBack: () => true }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => true }));
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ trackChart: jest.fn(), useAnchorChart: () => ({ data: { anchor: { intentionText: 'x', category: 'creativity' } } }) }));
jest.mock('../chartScreenSupport', () => ({ useChartContext: () => ({ identity: { intention: 'x', category: 'creativity', art: null }, anchorArt: { svg: '<svg/>', imageUrl: null, category: 'creativity', expression: null } }) }));

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { V2ChartRouteUpdatedScreen } from '../V2ChartRouteUpdatedScreen';

beforeEach(() => jest.clearAllMocks());

describe('V2ChartRouteUpdatedScreen', () => {
  it('View updated Chart goes to the Chart, and Keep chatting returns to the conversation it came from', () => {
    mockParams = { anchorId: 'anchor-1', source: 'ask', change: { kind: 'MOVES_ADDED', count: 2, waypointTitle: 'Prepare' } };
    const screen = render(<V2ChartRouteUpdatedScreen />);
    expect(screen.getByTestId('route-updated-support').props.children).toBe('Added 2 moves to “Prepare”.');
    fireEvent.press(screen.getByTestId('route-updated-view'));
    expect(mockNavigate).toHaveBeenCalledWith('V2Chart', { anchorId: 'anchor-1' });
    fireEvent.press(screen.getByTestId('route-updated-chat'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('after a route revision from Adjust Route there is no conversation to keep chatting in', () => {
    mockParams = { anchorId: 'anchor-1', source: 'adjust', change: { kind: 'ROUTE_REVISED', aheadCount: 3, firstTitle: 'Strip' } };
    const screen = render(<V2ChartRouteUpdatedScreen />);
    expect(screen.queryByTestId('route-updated-chat')).toBeNull();
    expect(screen.getByTestId('route-updated-support').props.children).toBe('Your route now has 3 waypoints ahead, starting with “Strip”.');
    fireEvent.press(screen.getByTestId('route-updated-view'));
    expect(mockNavigate).toHaveBeenCalledWith('V2Chart', { anchorId: 'anchor-1' });
  });
});
