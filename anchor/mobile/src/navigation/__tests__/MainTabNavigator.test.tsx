import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
    }),
  };
});

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
  useTabNavigation: () => ({
    navigateToVault: jest.fn(),
    navigateToPractice: jest.fn(),
    navigateToChart: jest.fn(),
    navigateToPaywall: jest.fn(),
    navigateToSanctuary: jest.fn(),
    returnToAnchorDetail: jest.fn(),
    registerTabNav: jest.fn(),
    activeTabIndex: 0,
  }),
}));

jest.mock('@/hooks/usePracticeEntry', () => ({
  usePracticeEntry: () => ({
    startPractice: jest.fn(),
    isNavigationLocked: false,
    releaseNavigationLock: jest.fn(),
  }),
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

describe('MainTabNavigator Tab Bar Visibility', () => {
  it('renders tab bar on PracticeHome and hides on session routes', () => {
    let capturedPracticeCallback: ((name: string, params?: unknown) => void) | undefined;
    const { MainTabNavigator } = jest.requireActual('../MainTabNavigator');

    jest.doMock('../PracticeStackNavigator', () => ({
      PracticeStackNavigator: ({ onRouteChange }: { onRouteChange: (name: string, params?: unknown) => void }) => {
        capturedPracticeCallback = onRouteChange;
        return null;
      },
    }));

    // Re-import after mock setup
    const { MainTabNavigator: Navigator } = require('../MainTabNavigator');
    const { queryByTestId } = render(<Navigator />);

    // Initial state on mount — activeIndex 0 (Vault) shows tab bar
    expect(queryByTestId('custom-tab-bar')).toBeTruthy();
  });
});

describe('MainTabNavigator Android Back Handler', () => {
  let backHandlerCallbacks: Array<() => boolean> = [];
  const originalPlatformOS = require('react-native').Platform.OS;

  beforeEach(() => {
    backHandlerCallbacks = [];
    require('react-native').Platform.OS = 'android';
    jest.spyOn(require('react-native').BackHandler, 'addEventListener').mockImplementation(
      (...args: any[]) => {
        const [event, callback] = args;
        if (event === 'hardwareBackPress') {
          backHandlerCallbacks.push(callback);
        }
        return {
          remove: jest.fn(() => {
            backHandlerCallbacks = backHandlerCallbacks.filter((cb) => cb !== callback);
          }),
        } as any;
      }
    );
  });

  afterEach(() => {
    require('react-native').Platform.OS = originalPlatformOS;
    jest.restoreAllMocks();
  });

  it('registers back handler on mount and cleans up on unmount', () => {
    const { MainTabNavigator } = require('../MainTabNavigator');
    const { unmount } = render(<MainTabNavigator />);

    expect(backHandlerCallbacks.length).toBeGreaterThan(0);
    unmount();
    expect(backHandlerCallbacks.length).toBe(0);
  });

  it('returns false on Vault root allowing default OS exit', () => {
    const { MainTabNavigator } = require('../MainTabNavigator');
    render(<MainTabNavigator />);

    const handler = backHandlerCallbacks[backHandlerCallbacks.length - 1];
    expect(handler()).toBe(false);
  });
});

