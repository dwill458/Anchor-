import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { Text } = require('react-native');

  const createIcon = () => ({ testID, ...props }: any) => (
    <Text testID={testID}>{JSON.stringify(props)}</Text>
  );

  return {
    Home: createIcon(),
    Compass: createIcon(),
    Zap: createIcon(),
  };
});

jest.mock('../VaultStackNavigator', () => ({
  VaultStackNavigator: () => null,
}));

jest.mock('../PracticeStackNavigator', () => ({
  PracticeStackNavigator: () => null,
}));

jest.mock('../ChartStackNavigator', () => ({
  ChartStackNavigator: () => null,
}));

jest.mock('../../screens/discover', () => ({
  DiscoverScreen: () => null,
}));

jest.mock('../../components/transitions/SwipeableTabContainer', () => ({
  SwipeableTabContainer: ({ children }: any) => children,
}));

jest.mock('../../contexts/TabNavigationContext', () => ({
  TabNavigationProvider: ({ children }: any) => children,
}));

jest.mock('@/theme', () => ({
  colors: {
    background: {
      primary: '#000000',
    },
  },
  typography: {
    fontFamily: {
      ritual: 'Cinzel-Regular',
      sans: 'Inter-Regular',
    },
  },
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: jest.fn(() => false),
}));

jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: jest.fn(() => false),
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: jest.fn(() => []),
}));

jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    impact: jest.fn(),
  },
}));

jest.mock('@/stores/teachingStore', () => ({
  useTeachingStore: {
    getState: () => ({
      dequeueMilestone: jest.fn(() => null),
    }),
  },
}));

jest.mock('@/components/ToastProvider', () => ({
  useToast: () => ({
    success: jest.fn(),
  }),
}));

jest.mock('@/constants/teaching', () => ({
  TEACHINGS: {},
}));

import { CustomTabBar } from '../MainTabNavigator';

function parseIconProps(node: { props: { children: string } }) {
  return JSON.parse(node.props.children);
}

describe('CustomTabBar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('maps the Sanctuary and Practice buttons to their matching tab indices', () => {
    const onTabPress = jest.fn();
    const { getByText } = render(<CustomTabBar activeIndex={0} onTabPress={onTabPress} />);

    fireEvent.press(getByText('PRACTICE'));
    jest.advanceTimersByTime(500);
    expect(onTabPress).toHaveBeenNthCalledWith(1, 1);

    fireEvent.press(getByText('SANCTUARY'));
    jest.advanceTimersByTime(500);
    expect(onTabPress).toHaveBeenNthCalledWith(2, 0);
  });

  it('always exposes Chart as the third tab', () => {
    const onTabPress = jest.fn();
    const screen = render(<CustomTabBar activeIndex={2} onTabPress={onTabPress} />);
    fireEvent.press(screen.getByText('CHART'));
    jest.advanceTimersByTime(500);

    expect(onTabPress).toHaveBeenCalledWith(2);
    expect(screen.getByLabelText('Chart')).toBeTruthy();
    expect(screen.getByTestId('tab-indicator-chart')).toBeTruthy();
  });

  it('renders only the active tab indicator and applies the requested bar chrome', () => {
    const { getByTestId, queryByTestId } = render(
      <CustomTabBar activeIndex={0} onTabPress={jest.fn()} />
    );

    expect(getByTestId('tab-indicator-sanctuary')).toBeTruthy();
    expect(queryByTestId('tab-indicator-practice')).toBeNull();

    const flattenedStyle = StyleSheet.flatten(getByTestId('custom-tab-bar').props.style);
    expect(flattenedStyle).toMatchObject({
      backgroundColor: 'rgba(16, 21, 27, 0.5)',
      height: 64,
      borderRadius: 32,
      position: 'absolute',
      left: 20,
      right: 20,
    });
  });

  it('uses the requested icon size, stroke width, and active/inactive colors', () => {
    const { getByTestId } = render(<CustomTabBar activeIndex={0} onTabPress={jest.fn()} />);

    expect(parseIconProps(getByTestId('tab-icon-sanctuary'))).toMatchObject({
      color: '#E8E8E8',
      size: 22,
      strokeWidth: 1.5,
      fill: 'none',
    });

    expect(parseIconProps(getByTestId('tab-icon-practice'))).toMatchObject({
      color: 'rgba(192, 192, 192, 0.45)',
      size: 22,
      strokeWidth: 1.5,
      fill: 'none',
    });
  });
});
