import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

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
  it('renders only the active tab indicator and applies the requested bar chrome', () => {
    const { getByTestId, queryByTestId } = render(
      <CustomTabBar activeIndex={0} onTabPress={jest.fn()} />
    );

    expect(getByTestId('tab-indicator-sanctuary')).toBeTruthy();
    expect(queryByTestId('tab-indicator-practice')).toBeNull();

    const flattenedStyle = StyleSheet.flatten(getByTestId('custom-tab-bar').props.style);
    expect(flattenedStyle).toMatchObject({
      backgroundColor: '#080C10',
      borderTopColor: 'rgba(212,175,55,0.08)',
      borderTopWidth: 1,
      justifyContent: 'space-evenly',
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 0,
      height: 82,
    });

    const indicatorStyle = StyleSheet.flatten(getByTestId('tab-indicator-sanctuary').props.style);
    expect(indicatorStyle).toMatchObject({
      width: 28,
      height: 2,
      backgroundColor: '#D4AF37',
      shadowColor: '#D4AF37',
      shadowOpacity: 1,
      shadowRadius: 6,
      elevation: 4,
    });
  });

  it('uses the requested icon size, stroke width, and active/inactive colors', () => {
    const { getByTestId } = render(<CustomTabBar activeIndex={0} onTabPress={jest.fn()} />);

    expect(parseIconProps(getByTestId('tab-icon-sanctuary'))).toMatchObject({
      color: '#D4AF37',
      size: 22,
      strokeWidth: 1.8,
      fill: 'none',
    });

    expect(parseIconProps(getByTestId('tab-icon-practice'))).toMatchObject({
      color: 'rgba(192,192,192,0.3)',
      size: 22,
      strokeWidth: 1.8,
      fill: 'none',
    });
  });
});
