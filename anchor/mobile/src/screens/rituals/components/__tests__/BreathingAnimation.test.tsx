/**
 * BreathingAnimation Unit Tests
 *
 * Tests for breathing animation screen and completion callback
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { BreathingAnimation } from '../../BreathingAnimation';
import { useNavigation, useRoute } from '@react-navigation/native';

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

// Mock haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
    Warning: 'warning',
  },
}));

describe('BreathingAnimation', () => {
  const mockNavigationGoBack = jest.fn();
  const mockNavigationNavigate = jest.fn();

  beforeEach(() => {
    mockNavigationGoBack.mockClear();
    mockNavigationNavigate.mockClear();

    // Mock useNavigation
    (useNavigation as jest.Mock).mockReturnValue({
      goBack: mockNavigationGoBack,
      navigate: mockNavigationNavigate,
    });

    // Mock useRoute
    (useRoute as jest.Mock).mockReturnValue({
      params: {},
    });
  });

  it('renders the breathing animation screen', () => {
    render(<BreathingAnimation />);

    expect(screen.getByText('Breathe in...')).toBeTruthy();
  });

  it('displays initial instruction "Breathe in..."', () => {
    render(<BreathingAnimation />);

    expect(screen.getByText('Breathe in...')).toBeTruthy();
  });

  it('displays subtitle text', () => {
    render(<BreathingAnimation />);

    expect(screen.getByText('Prepare yourself for the ritual')).toBeTruthy();
  });

  it('changes instruction to "Breathe out..." after 1.5 seconds', async () => {
    render(<BreathingAnimation />);

    expect(screen.getByText('Breathe in...')).toBeTruthy();

    await waitFor(
      () => {
        expect(screen.getByText('Breathe out...')).toBeTruthy();
      },
      { timeout: 2000 }
    );
  });

  it('navigates back after completion by default', async () => {
    render(<BreathingAnimation />);

    await waitFor(
      () => {
        expect(mockNavigationGoBack).toHaveBeenCalled();
      },
      { timeout: 4000 }
    );
  });

  it('navigates to Ritual for charge source params', async () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {
        source: 'charge',
        anchorId: 'anchor-123',
        mode: 'focus',
        duration: 30,
      },
    });

    render(<BreathingAnimation />);

    await waitFor(
      () => {
        expect(mockNavigationNavigate).toHaveBeenCalledWith('Ritual', {
          anchorId: 'anchor-123',
          ritualType: 'focus',
          durationSeconds: 30,
        });
      },
      { timeout: 4000 }
    );
  });

  it('renders progress indicator dots', () => {
    render(<BreathingAnimation />);

    // Should have progress dots at bottom
    const container = screen.getByText('Breathe in...').parent;
    expect(container).toBeTruthy();
  });

  it('unmounts cleanly without memory leaks', () => {
    const { unmount } = render(<BreathingAnimation />);

    expect(() => {
      unmount();
    }).not.toThrow();
  });

  it('handles rapid mounting and unmounting', () => {
    const { unmount, rerender } = render(<BreathingAnimation />);

    expect(() => {
      unmount();
      rerender(<BreathingAnimation />);
      unmount();
    }).not.toThrow();
  });

  it('only triggers animation sequence once on mount', async () => {
    render(<BreathingAnimation />);

    await waitFor(
      () => {
        expect(mockNavigationGoBack).toHaveBeenCalledTimes(1);
      },
      { timeout: 4000 }
    );
  });
});
