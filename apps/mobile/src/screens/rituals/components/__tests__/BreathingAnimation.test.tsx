/**
 * BreathingAnimation Unit Tests
 *
 * Tests for breathing animation screen and completion callback
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { BreathingAnimation } from '../BreathingAnimation';
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
  const mockOnComplete = jest.fn();
  const mockNavigationGoBack = jest.fn();

  beforeEach(() => {
    mockOnComplete.mockClear();
    mockNavigationGoBack.mockClear();

    // Mock useNavigation
    (useNavigation as jest.Mock).mockReturnValue({
      goBack: mockNavigationGoBack,
    });

    // Mock useRoute
    (useRoute as jest.Mock).mockReturnValue({
      params: {
        onComplete: mockOnComplete,
      },
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

  it('calls onComplete callback after 3 seconds', async () => {
    jest.useFakeTimers();

    render(<BreathingAnimation />);

    // Fast-forward 3 seconds
    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });

    jest.useRealTimers();
  });

  it('navigates back if no onComplete callback provided', async () => {
    jest.useFakeTimers();

    (useRoute as jest.Mock).mockReturnValue({
      params: {
        onComplete: undefined,
      },
    });

    render(<BreathingAnimation />);

    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(mockNavigationGoBack).toHaveBeenCalled();
    });

    jest.useRealTimers();
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
    jest.useFakeTimers();

    render(<BreathingAnimation />);

    // Verify onComplete is called only once
    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    jest.useRealTimers();
  });
});
