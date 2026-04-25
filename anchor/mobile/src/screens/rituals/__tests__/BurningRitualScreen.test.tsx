import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { BurningRitualScreen } from '../BurningRitualScreen';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { post } from '@/services/ApiClient';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { AuthService } from '@/services/AuthService';

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({
    params: {
      anchorId: 'test-anchor-id',
      intention: 'I am calm',
      sigilSvg: '<svg></svg>',
      enhancedImageUrl: undefined,
    },
  })),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
}));

jest.mock('@/stores/anchorStore');
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));
jest.mock('@/services/ApiClient');
jest.mock('@/services/AnalyticsService');
jest.mock('@/services/ErrorTrackingService');
jest.mock('@/services/AuthService', () => ({
  AuthService: {
    getIdToken: jest.fn(),
  },
}));
jest.mock('@/components/ToastProvider', () => ({
  useToast: () => ({
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('../components/BurnAnimationOverlay', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');

  return {
    BurnAnimationOverlay: ({ onCommitBurn, onReturnToSanctuary, onReturnToAnchor, enhancedImageUrl, sigilSvg }: any) => {
      const [status, setStatus] = React.useState('idle');

      return (
        <View>
          <Text>Burn Overlay Mock</Text>
          <Text testID="commit-status">{status}</Text>
          <Text testID="overlay-image">{enhancedImageUrl ?? 'none'}</Text>
          <Text testID="overlay-sigil">{sigilSvg}</Text>

          <TouchableOpacity
            onPress={async () => {
              try {
                await onCommitBurn();
                setStatus('success');
              } catch {
                setStatus('error');
              }
            }}
          >
            <Text>Run Commit</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onReturnToSanctuary}>
            <Text>Return to Sanctuary</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onReturnToAnchor}>
            <Text>Return to Anchor</Text>
          </TouchableOpacity>
        </View>
      );
    },
  };
});

describe('BurningRitualScreen', () => {
  let mockNavigate: jest.Mock;
  let mockGoBack: jest.Mock;
  let mockRemoveAnchor: jest.Mock;
  let mockAuthState = { isAuthenticated: true };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate = jest.fn();
    mockGoBack = jest.fn();
    mockRemoveAnchor = jest.fn();
    mockAuthState = { isAuthenticated: true };
    (AuthService.getIdToken as jest.Mock).mockResolvedValue('token');

    const navigation = require('@react-navigation/native');
    navigation.useNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });

    (useAnchorStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        removeAnchor: mockRemoveAnchor,
        getAnchorById: jest.fn(() => ({
          id: 'test-anchor-id',
          baseSigilSvg: '<svg>store</svg>',
          reinforcedSigilSvg: '<svg>reinforced</svg>',
          enhancedImageUrl: 'https://example.com/burn-hero.png',
        })),
      })
    );

    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector
        ? selector(mockAuthState)
        : mockAuthState
    );
  });

  it('renders the burn animation overlay', () => {
    const { getByText } = render(<BurningRitualScreen />);
    expect(getByText('Burn Overlay Mock')).toBeTruthy();
  });

  it('commits burn successfully and updates local state', async () => {
    (post as jest.Mock).mockResolvedValue({ success: true });
    const { getByText, getByTestId } = render(<BurningRitualScreen />);

    fireEvent.press(getByText('Run Commit'));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/api/anchors/test-anchor-id/burn', {});
    });

    await waitFor(() => {
      expect(mockRemoveAnchor).toHaveBeenCalledWith('test-anchor-id');
      expect(AnalyticsService.track).toHaveBeenCalledWith(AnalyticsEvents.BURN_COMPLETED, {
        anchor_id: 'test-anchor-id',
      });
      expect(getByTestId('commit-status').props.children).toBe('success');
    });
  });

  it('tracks burn failure and keeps anchor in store on API error', async () => {
    (post as jest.Mock).mockRejectedValue(new Error('Network error'));
    const { getByText, getByTestId } = render(<BurningRitualScreen />);

    fireEvent.press(getByText('Run Commit'));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/api/anchors/test-anchor-id/burn', {});
    });

    await waitFor(() => {
      expect(mockRemoveAnchor).not.toHaveBeenCalled();
      expect(AnalyticsService.track).toHaveBeenCalledWith(AnalyticsEvents.BURN_FAILED, {
        anchor_id: 'test-anchor-id',
      });
      expect(ErrorTrackingService.captureException).toHaveBeenCalled();
      expect(getByTestId('commit-status').props.children).toBe('error');
    });
  });

  it('navigates back to Vault when return-to-sanctuary is pressed', () => {
    const { getByText } = render(<BurningRitualScreen />);
    fireEvent.press(getByText('Return to Sanctuary'));

    expect(mockNavigate).toHaveBeenCalledWith('Vault');
  });

  it('returns to previous screen when return-to-anchor is pressed', () => {
    const { getByText } = render(<BurningRitualScreen />);
    fireEvent.press(getByText('Return to Anchor'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('prefers enhanced artwork from the store when route params are stale', () => {
    const { getByTestId } = render(<BurningRitualScreen />);

    expect(getByTestId('overlay-image').props.children).toBe('https://example.com/burn-hero.png');
    expect(getByTestId('overlay-sigil').props.children).toBe('<svg></svg>');
  });

  it('falls back to legacy sigilUri artwork when enhancedImageUrl is missing', () => {
    (useAnchorStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        removeAnchor: mockRemoveAnchor,
        getAnchorById: jest.fn(() => ({
          id: 'test-anchor-id',
          baseSigilSvg: '<svg>store</svg>',
          reinforcedSigilSvg: '<svg>reinforced</svg>',
          enhancedImageUrl: undefined,
          sigilUri: 'https://example.com/legacy-burn-hero.png',
        })),
      })
    );

    const { getByTestId } = render(<BurningRitualScreen />);

    expect(getByTestId('overlay-image').props.children).toBe('https://example.com/legacy-burn-hero.png');
  });

  it('blocks burn commit when auth state is stale and there is no token', async () => {
    mockAuthState = { isAuthenticated: true };
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector
        ? selector(mockAuthState)
        : mockAuthState
    );
    (AuthService.getIdToken as jest.Mock).mockResolvedValue(null);

    const { getByText, getByTestId } = render(<BurningRitualScreen />);
    fireEvent.press(getByText('Run Commit'));

    await waitFor(() => {
      expect(post).not.toHaveBeenCalled();
      expect(getByTestId('commit-status').props.children).toBe('error');
    });
  });
});
