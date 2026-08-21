import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { PrimeYourAnchorScreen } from '../PrimeYourAnchorScreen';

const mockPopToTop = jest.fn();
const mockNavigateToChart = jest.fn();
const mockNavigateToSanctuary = jest.fn();
const mockStartPractice = jest.fn();
const mockCanOfferFirstAnchorReminder = jest.fn();
const mockFinishChartAnchorPracticeHandoff = jest.fn();

let mockRouteParams: Record<string, unknown>;
let mockAuthState: any;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ popToTop: mockPopToTop }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/stores/authStore', () => {
  const useAuthStore: any = (selector: (state: any) => unknown) => selector(mockAuthState);
  useAuthStore.getState = () => mockAuthState;
  return { useAuthStore };
});

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (state: any) => unknown) => selector({
    getAnchorById: (anchorId: string) => anchorId === 'anchor-a'
      ? { id: 'anchor-a', baseSigilSvg: '<svg />' }
      : undefined,
  }),
}));

jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({
    navigateToChart: mockNavigateToChart,
    navigateToSanctuary: mockNavigateToSanctuary,
  }),
}));

jest.mock('@/hooks/usePracticeEntry', () => ({
  usePracticeEntry: () => ({
    startPractice: mockStartPractice,
    isNavigationLocked: false,
  }),
}));

jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    canOfferFirstAnchorReminder: mockCanOfferFirstAnchorReminder,
  }),
}));

jest.mock('@/services/ChartAnchorHandoffService', () => ({
  finishChartAnchorPracticeHandoff: (...args: unknown[]) =>
    mockFinishChartAnchorPracticeHandoff(...args),
}));

jest.mock('@/components/anchor15', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    Anchor15Screen: ({ children }: any) => <View>{children}</View>,
    Anchor15PrimaryButton: ({ label, onPress, disabled }: any) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled}>
        <Text>{label}</Text>
      </Pressable>
    ),
    Anchor15TextButton: ({ label, onPress }: any) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/components/common', () => ({
  OptimizedImage: () => null,
  SigilSvg: () => null,
}));

jest.mock('@/components/notifications', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    DailyReminderPrompt: ({ visible, onDismiss }: any) => visible ? (
      <Pressable testID="reminder-dismiss" onPress={onDismiss}>
        <Text>Dismiss reminder</Text>
      </Pressable>
    ) : null,
  };
});

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const chartUser = (id: string, canView = true) => ({
  id,
  chartFlags: { chart_enabled: true },
  chartCapabilities: { canViewChart: canView },
});

describe('PrimeYourAnchorScreen Chart account boundary', () => {
  const originalChartBuildFlag = process.env.EXPO_PUBLIC_ENABLE_CHART;

  beforeAll(() => {
    process.env.EXPO_PUBLIC_ENABLE_CHART = 'true';
  });

  afterAll(() => {
    if (originalChartBuildFlag === undefined) {
      delete process.env.EXPO_PUBLIC_ENABLE_CHART;
    } else {
      process.env.EXPO_PUBLIC_ENABLE_CHART = originalChartBuildFlag;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = { user: chartUser('account-a') };
    mockRouteParams = {
      anchorId: 'anchor-a',
      chartOriginAccountId: 'account-a',
      chartContext: {
        courseId: 'course-a',
        waypointId: 'waypoint-a',
        courseVersion: 3,
      },
    };
    mockCanOfferFirstAnchorReminder.mockResolvedValue(true);
  });

  it('returns the owned handoff to its Waypoint after the reminder is dismissed', async () => {
    const screen = render(<PrimeYourAnchorScreen />);

    fireEvent.press(screen.getByText('Practice later'));
    await waitFor(() => expect(screen.getByTestId('reminder-dismiss')).toBeTruthy());
    fireEvent.press(screen.getByTestId('reminder-dismiss'));

    expect(mockFinishChartAnchorPracticeHandoff).toHaveBeenCalledWith(
      'course-a',
      'waypoint-a',
      'anchor-a',
    );
    expect(mockPopToTop).toHaveBeenCalledTimes(1);
    expect(mockNavigateToChart).toHaveBeenCalledWith('WaypointDetail', {
      courseId: 'course-a',
      waypointId: 'waypoint-a',
    });
    expect(mockNavigateToSanctuary).not.toHaveBeenCalled();
  });

  it('does not run account A pending reminder action after switching to account B', async () => {
    const screen = render(<PrimeYourAnchorScreen />);

    fireEvent.press(screen.getByText('Practice later'));
    await waitFor(() => expect(screen.getByTestId('reminder-dismiss')).toBeTruthy());
    mockAuthState = { user: chartUser('account-b') };
    fireEvent.press(screen.getByTestId('reminder-dismiss'));

    expect(mockFinishChartAnchorPracticeHandoff).not.toHaveBeenCalled();
    expect(mockNavigateToChart).not.toHaveBeenCalled();
    expect(mockPopToTop).not.toHaveBeenCalled();
    expect(mockNavigateToSanctuary).toHaveBeenCalledTimes(1);
  });

  it('rechecks ownership after the asynchronous reminder eligibility lookup', async () => {
    let resolveOffer: ((value: boolean) => void) | undefined;
    mockCanOfferFirstAnchorReminder.mockReturnValue(new Promise<boolean>((resolve) => {
      resolveOffer = resolve;
    }));
    const screen = render(<PrimeYourAnchorScreen />);

    fireEvent.press(screen.getByText('Begin Focus →'));
    mockAuthState = { user: chartUser('account-b') };
    await act(async () => resolveOffer?.(false));

    expect(mockStartPractice).not.toHaveBeenCalled();
    expect(mockNavigateToChart).not.toHaveBeenCalled();
    expect(mockNavigateToSanctuary).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the server-confirmed origin account is absent', () => {
    delete mockRouteParams.chartOriginAccountId;

    render(<PrimeYourAnchorScreen />);

    expect(mockNavigateToSanctuary).toHaveBeenCalledTimes(1);
    expect(mockStartPractice).not.toHaveBeenCalled();
    expect(mockNavigateToChart).not.toHaveBeenCalled();
  });
});
