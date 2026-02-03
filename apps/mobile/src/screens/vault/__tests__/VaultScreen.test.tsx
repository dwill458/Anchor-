import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import VaultScreen from '../VaultScreen';
import { createMockAnchors, createMockUser } from '@/__tests__/utils/testUtils';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { PerformanceMonitoring } from '@/services/PerformanceMonitoring';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockToast = { error: jest.fn() };

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/components/ToastProvider', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/components/cards/AnchorCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    AnchorCard: ({ anchor, onPress }: any) => (
      <Text onPress={() => onPress(anchor)}>{anchor.intentionText}</Text>
    ),
  };
});

jest.mock('@/components/skeletons/AnchorCardSkeleton', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    AnchorGridSkeleton: ({ count }: any) => <Text>{`Skeleton-${count}`}</Text>,
  };
});

jest.mock('@/services/AnalyticsService');
jest.mock('@/services/ErrorTrackingService');
jest.mock('@/services/PerformanceMonitoring');

jest.useFakeTimers();

describe('VaultScreen', () => {
  const mockUser = createMockUser({ displayName: 'Avery' });
  const { useAnchorStore } = require('@/stores/anchorStore');
  const { useAuthStore } = require('@/stores/authStore');

  beforeEach(() => {
    jest.clearAllMocks();

    (useAuthStore as jest.Mock).mockReturnValue({
      user: mockUser,
    });

    (useAuthStore as jest.Mock).getState = jest.fn();
    (useAuthStore as jest.Mock).getState.mockReturnValue({
      shouldRedirectToCreation: false,
      setShouldRedirectToCreation: jest.fn(),
    });

    (useAnchorStore as jest.Mock).mockReturnValue({
      anchors: [],
      isLoading: false,
      error: null,
      setLoading: jest.fn(),
      setError: jest.fn(),
    });

    (PerformanceMonitoring.startTrace as jest.Mock).mockReturnValue({
      putAttribute: jest.fn(),
      stop: jest.fn(),
    });
  });

  it('shows skeletons while loading with no anchors', () => {
    (useAnchorStore as jest.Mock).mockReturnValue({
      anchors: [],
      isLoading: true,
      error: null,
      setLoading: jest.fn(),
      setError: jest.fn(),
    });

    const { getByText } = render(<VaultScreen />);

    expect(getByText('Skeleton-6')).toBeTruthy();
  });

  it('renders the empty state when no anchors exist', () => {
    const { getByText } = render(<VaultScreen />);

    expect(getByText('Sanctuary Awaits')).toBeTruthy();
    expect(getByText('Forge First Anchor')).toBeTruthy();
  });

  it('navigates to creation from empty state button', () => {
    const { getByLabelText } = render(<VaultScreen />);

    fireEvent.press(getByLabelText('Forge your first anchor'));

    expect(AnalyticsService.track).toHaveBeenCalledWith(
      AnalyticsEvents.ANCHOR_CREATION_STARTED,
      expect.objectContaining({ source: 'vault' })
    );
    expect(ErrorTrackingService.addBreadcrumb).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('CreateAnchor');
  });

  it('renders anchor count and FAB when anchors exist', () => {
    const anchors = createMockAnchors(2);
    (useAnchorStore as jest.Mock).mockReturnValue({
      anchors,
      isLoading: false,
      error: null,
      setLoading: jest.fn(),
      setError: jest.fn(),
    });

    const { getByText, getByLabelText } = render(<VaultScreen />);

    expect(getByLabelText('List of 2 anchors')).toBeTruthy();
    expect(getByText('Test intention 0')).toBeTruthy();
    expect(getByText('Forge Anchor')).toBeTruthy();
  });

  it('navigates to creation from the FAB', () => {
    const anchors = createMockAnchors(1);
    (useAnchorStore as jest.Mock).mockReturnValue({
      anchors,
      isLoading: false,
      error: null,
      setLoading: jest.fn(),
      setError: jest.fn(),
    });

    const { getByLabelText } = render(<VaultScreen />);

    fireEvent.press(getByLabelText('Forge new anchor'));

    expect(mockNavigate).toHaveBeenCalledWith('CreateAnchor');
  });

  it('navigates to anchor detail when a card is pressed', () => {
    const anchors = createMockAnchors(1);
    (useAnchorStore as jest.Mock).mockReturnValue({
      anchors,
      isLoading: false,
      error: null,
      setLoading: jest.fn(),
      setError: jest.fn(),
    });

    const { getByText } = render(<VaultScreen />);

    fireEvent.press(getByText('Test intention 0'));

    expect(AnalyticsService.track).toHaveBeenCalledWith(
      AnalyticsEvents.ANCHOR_VIEWED,
      expect.objectContaining({ anchor_id: 'anchor-0' })
    );
    expect(mockNavigate).toHaveBeenCalledWith('AnchorDetail', { anchorId: 'anchor-0' });
  });

  it('redirects to creation when onboarding flag is set', () => {
    const setShouldRedirectToCreation = jest.fn();
    (useAuthStore as jest.Mock).getState.mockReturnValue({
      shouldRedirectToCreation: true,
      setShouldRedirectToCreation,
    });

    render(<VaultScreen />);

    expect(setShouldRedirectToCreation).toHaveBeenCalledWith(false);
    expect(mockNavigate).toHaveBeenCalledWith('CreateAnchor');
  });

  it('refresh control triggers a new fetch', async () => {
    const setLoading = jest.fn();
    (useAnchorStore as jest.Mock).mockReturnValue({
      anchors: [],
      isLoading: false,
      error: null,
      setLoading,
      setError: jest.fn(),
    });

    const { getByLabelText } = render(<VaultScreen />);

    const list = getByLabelText('List of 0 anchors');
    act(() => {
      list.props.refreshControl.props.onRefresh();
    });

    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(setLoading).toHaveBeenCalled();
    });
  });

  it('handles analytics errors when fetching anchors', async () => {
    const setError = jest.fn();
    (useAnchorStore as jest.Mock).mockReturnValue({
      anchors: [],
      isLoading: false,
      error: null,
      setLoading: jest.fn(),
      setError,
    });

    (AnalyticsService.track as jest.Mock).mockImplementation(() => {
      throw new Error('Analytics failed');
    });

    render(<VaultScreen />);

    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(setError).toHaveBeenCalled();
    });

    expect(mockToast.error).toHaveBeenCalled();
    expect(ErrorTrackingService.captureException).toHaveBeenCalled();
  });
});
