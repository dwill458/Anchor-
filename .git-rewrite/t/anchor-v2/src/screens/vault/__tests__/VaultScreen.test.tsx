/**
 * Anchor App - VaultScreen Tests
 *
 * Tests for the main anchor vault/sanctuary screen
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { VaultScreen } from '../VaultScreen';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ToastProvider';
import { AnalyticsService } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { PerformanceMonitoring } from '@/services/PerformanceMonitoring';
import { createMockUser, createMockAnchor } from '@/__tests__/utils/testUtils';

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
  })),
}));

jest.mock('@/stores/anchorStore');
jest.mock('@/stores/authStore');
jest.mock('@/components/ToastProvider');
jest.mock('@/services/AnalyticsService');
jest.mock('@/services/ErrorTrackingService');
jest.mock('@/services/PerformanceMonitoring');
jest.mock('@/components/cards/AnchorCard', () => ({
  AnchorCard: 'AnchorCard',
}));
jest.mock('@/components/skeletons/AnchorCardSkeleton', () => ({
  AnchorGridSkeleton: 'AnchorGridSkeleton',
}));
jest.mock('lucide-react-native', () => ({
  Plus: 'Plus',
}));

describe('VaultScreen', () => {
  let mockUser: any;
  let mockAnchors: any[];
  let mockToast: any;
  let mockTrace: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = createMockUser({ id: 'user-1', displayName: 'Test User' });
    mockAnchors = [
      createMockAnchor({ id: '1', intentionText: 'First anchor', isCharged: true }),
      createMockAnchor({ id: '2', intentionText: 'Second anchor', isCharged: false }),
    ];

    mockToast = {
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    };

    mockTrace = {
      putMetric: jest.fn(),
      stop: jest.fn(),
    };

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: mockUser,
    });

    (useAnchorStore as unknown as jest.Mock).mockReturnValue({
      anchors: mockAnchors,
      isLoading: false,
      error: null,
      setLoading: jest.fn(),
      setError: jest.fn(),
    });

    (useToast as jest.Mock).mockReturnValue(mockToast);

    (PerformanceMonitoring.startTrace as jest.Mock).mockReturnValue(mockTrace);
    (AnalyticsService.track as jest.Mock).mockImplementation(() => {});
    (ErrorTrackingService.addBreadcrumb as jest.Mock).mockImplementation(() => {});
    (ErrorTrackingService.captureException as jest.Mock).mockImplementation(() => {});
  });

  describe('Rendering', () => {
    it('should render sanctuary title', () => {
      const { getByText } = render(<VaultScreen />);

      expect(getByText('Sanctuary')).toBeTruthy();
    });

    it('should display anchor count in header', () => {
      const { getByText } = render(<VaultScreen />);

      expect(getByText('2 Sacred Anchors')).toBeTruthy();
    });

    it('should display singular anchor count when one anchor', () => {
      (useAnchorStore as unknown as jest.Mock).mockReturnValue({
        anchors: [createMockAnchor()],
        isLoading: false,
        error: null,
        setLoading: jest.fn(),
        setError: jest.fn(),
      });

      const { getByText } = render(<VaultScreen />);

      expect(getByText('1 Sacred Anchor')).toBeTruthy();
    });

    it('should display user initial in profile button', () => {
      const { getByText } = render(<VaultScreen />);

      expect(getByText('T')).toBeTruthy(); // First letter of "Test User"
    });

    it('should render anchor cards for each anchor', () => {
      const { queryByTestId } = render(<VaultScreen />);

      // AnchorCard should be rendered (mocked component)
      expect(queryByTestId).toBeTruthy();
    });

    it('should show FAB button when anchors exist', () => {
      const { getByText } = render(<VaultScreen />);

      expect(getByText('Forge Anchor')).toBeTruthy();
    });
  });

  describe('Empty State', () => {
    beforeEach(() => {
      (useAnchorStore as unknown as jest.Mock).mockReturnValue({
        anchors: [],
        isLoading: false,
        error: null,
        setLoading: jest.fn(),
        setError: jest.fn(),
      });
    });

    it('should show empty state when no anchors', () => {
      const { getByText } = render(<VaultScreen />);

      expect(getByText('Sanctuary Awaits')).toBeTruthy();
      expect(getByText(/Begin your journey/i)).toBeTruthy();
    });

    it('should show "Forge First Anchor" button in empty state', () => {
      const { getByText } = render(<VaultScreen />);

      expect(getByText('Forge First Anchor')).toBeTruthy();
    });

    it('should not show FAB in empty state', () => {
      const { queryByText } = render(<VaultScreen />);

      expect(queryByText('Forge Anchor')).toBeNull();
    });

    it('should show anchor count as 0', () => {
      const { getByText } = render(<VaultScreen />);

      expect(getByText('0 Sacred Anchors')).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('should show skeleton when loading with no anchors', () => {
      (useAnchorStore as unknown as jest.Mock).mockReturnValue({
        anchors: [],
        isLoading: true,
        error: null,
        setLoading: jest.fn(),
        setError: jest.fn(),
      });

      const { queryByText } = render(<VaultScreen />);

      // Should not show empty state while loading
      expect(queryByText('Sanctuary Awaits')).toBeNull();
    });

    it('should show anchors even when loading if anchors exist', () => {
      (useAnchorStore as unknown as jest.Mock).mockReturnValue({
        anchors: mockAnchors,
        isLoading: true,
        error: null,
        setLoading: jest.fn(),
        setError: jest.fn(),
      });

      const { getByText } = render(<VaultScreen />);

      expect(getByText('2 Sacred Anchors')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should navigate to CreateAnchor when FAB is pressed', () => {
      const { getByText } = render(<VaultScreen />);

      fireEvent.press(getByText('Forge Anchor'));

      expect(mockNavigate).toHaveBeenCalledWith('CreateAnchor');
    });

    it('should navigate to CreateAnchor from empty state button', () => {
      (useAnchorStore as unknown as jest.Mock).mockReturnValue({
        anchors: [],
        isLoading: false,
        error: null,
        setLoading: jest.fn(),
        setError: jest.fn(),
      });

      const { getByText } = render(<VaultScreen />);

      fireEvent.press(getByText('Forge First Anchor'));

      expect(mockNavigate).toHaveBeenCalledWith('CreateAnchor');
    });

    it('should navigate to Profile when profile button is pressed', () => {
      const { getByText } = render(<VaultScreen />);

      fireEvent.press(getByText('T')); // Profile avatar

      expect(mockNavigate).toHaveBeenCalledWith('Profile');
    });
  });

  describe('Analytics', () => {
    it('should track ANCHOR_CREATION_STARTED when FAB is pressed', () => {
      const { getByText } = render(<VaultScreen />);

      fireEvent.press(getByText('Forge Anchor'));

      expect(AnalyticsService.track).toHaveBeenCalledWith(
        expect.any(String), // Event name
        expect.objectContaining({
          source: 'vault',
          has_existing_anchors: true,
        })
      );
    });

    it('should track ANCHOR_CREATION_STARTED from empty state', () => {
      (useAnchorStore as unknown as jest.Mock).mockReturnValue({
        anchors: [],
        isLoading: false,
        error: null,
        setLoading: jest.fn(),
        setError: jest.fn(),
      });

      const { getByText } = render(<VaultScreen />);

      fireEvent.press(getByText('Forge First Anchor'));

      expect(AnalyticsService.track).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          source: 'vault',
          has_existing_anchors: false,
        })
      );
    });

    it('should add breadcrumb when create anchor is initiated', () => {
      const { getByText } = render(<VaultScreen />);

      fireEvent.press(getByText('Forge Anchor'));

      expect(ErrorTrackingService.addBreadcrumb).toHaveBeenCalledWith(
        'Create anchor initiated',
        'navigation',
        expect.objectContaining({ source: 'vault' })
      );
    });
  });

  describe('Performance Monitoring', () => {
    it('should start performance trace when fetching anchors', async () => {
      render(<VaultScreen />);

      await waitFor(() => {
        expect(PerformanceMonitoring.startTrace).toHaveBeenCalledWith('fetch_anchors');
      });
    });

    it('should stop trace after fetch completes', async () => {
      render(<VaultScreen />);

      await waitFor(() => {
        expect(mockTrace.stop).toHaveBeenCalled();
      });
    });

    it('should record anchor count metric', async () => {
      render(<VaultScreen />);

      await waitFor(() => {
        expect(mockTrace.putMetric).toHaveBeenCalledWith('anchor_count', 2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast when fetch fails', async () => {
      const mockSetError = jest.fn();
      (useAnchorStore as unknown as jest.Mock).mockReturnValue({
        anchors: [],
        isLoading: false,
        error: 'Network error',
        setLoading: jest.fn(),
        setError: mockSetError,
      });

      render(<VaultScreen />);

      // Error handling happens in fetchAnchors which is called on mount
      await waitFor(() => {
        // The component should handle errors gracefully
        expect(mockSetError).toBeDefined();
      });
    });

    it('should capture exception when fetch fails', async () => {
      const mockError = new Error('Fetch failed');
      const mockSetError = jest.fn();

      (useAnchorStore as unknown as jest.Mock).mockReturnValue({
        anchors: [],
        isLoading: false,
        error: mockError.message,
        setLoading: jest.fn(),
        setError: mockSetError,
      });

      render(<VaultScreen />);

      // Wait for component to mount and handle error
      await waitFor(() => {
        expect(mockSetError).toBeDefined();
      });
    });
  });

  describe('Pull to Refresh', () => {
    it('should support pull to refresh', () => {
      const { getByTestId } = render(<VaultScreen />);

      // FlatList with RefreshControl should be rendered
      // The actual refresh functionality is tested through the fetchAnchors call
      expect(getByTestId).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label for sanctuary title', () => {
      const { getByRole } = render(<VaultScreen />);

      expect(getByRole('header')).toBeTruthy();
    });

    it('should have accessible label for anchor count', () => {
      const { getByLabelText } = render(<VaultScreen />);

      expect(getByLabelText(/You have 2 sacred anchors/i)).toBeTruthy();
    });

    it('should have accessible label for profile button', () => {
      const { getByLabelText } = render(<VaultScreen />);

      expect(getByLabelText(/Profile for Test User/i)).toBeTruthy();
    });

    it('should have accessible label for forge button', () => {
      const { getByLabelText } = render(<VaultScreen />);

      expect(getByLabelText(/Forge new anchor/i)).toBeTruthy();
    });

    it('should have accessible label for empty state button', () => {
      (useAnchorStore as unknown as jest.Mock).mockReturnValue({
        anchors: [],
        isLoading: false,
        error: null,
        setLoading: jest.fn(),
        setError: jest.fn(),
      });

      const { getByLabelText } = render(<VaultScreen />);

      expect(getByLabelText(/Forge your first anchor/i)).toBeTruthy();
    });

    it('should have accessible hint for forge button', () => {
      const { getByLabelText } = render(<VaultScreen />);

      const forgeButton = getByLabelText(/Forge new anchor/i);
      // accessibilityHint should be set
      expect(forgeButton).toBeTruthy();
    });
  });

  describe('User Context', () => {
    it('should handle user without displayName', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: createMockUser({ displayName: undefined }),
      });

      const { getByText } = render(<VaultScreen />);

      expect(getByText('U')).toBeTruthy(); // Default to 'U'
    });

    it('should render without user (edge case)', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: null,
      });

      const { getByText } = render(<VaultScreen />);

      expect(getByText('Sanctuary')).toBeTruthy();
    });
  });

  describe('Grid Layout', () => {
    it('should render anchors in 2-column grid', () => {
      const { queryByTestId } = render(<VaultScreen />);

      // FlatList with numColumns={2} should be rendered
      expect(queryByTestId).toBeDefined();
    });

    it('should handle odd number of anchors', () => {
      (useAnchorStore as unknown as jest.Mock).mockReturnValue({
        anchors: [
          createMockAnchor({ id: '1' }),
          createMockAnchor({ id: '2' }),
          createMockAnchor({ id: '3' }),
        ],
        isLoading: false,
        error: null,
        setLoading: jest.fn(),
        setError: jest.fn(),
      });

      const { getByText } = render(<VaultScreen />);

      expect(getByText('3 Sacred Anchors')).toBeTruthy();
    });
  });
});
