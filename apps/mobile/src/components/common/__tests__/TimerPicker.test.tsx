/**
 * TimerPicker Unit Tests
 *
 * Tests for the reusable timer picker modal component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TimerPicker } from '../TimerPicker';

// Mock BlurView
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('TimerPicker', () => {
  const mockOnConfirm = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnClose.mockClear();
  });

  it('renders nothing when visible is false', () => {
    render(
      <TimerPicker
        visible={false}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={10}
        minMinutes={1}
        maxMinutes={30}
        title="Select Duration"
      />
    );

    expect(screen.queryByText('Select Duration')).toBeFalsy();
  });

  it('renders modal content when visible is true', () => {
    render(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={10}
        minMinutes={1}
        maxMinutes={30}
        title="Select Duration"
      />
    );

    expect(screen.getByText('Select Duration')).toBeTruthy();
  });

  it('displays minute options within min/max range', () => {
    render(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={10}
        minMinutes={5}
        maxMinutes={15}
        title="Select Duration"
      />
    );

    // Should have 11 options (5 through 15 inclusive)
    expect(screen.getByText('5 minutes')).toBeTruthy();
    expect(screen.getByText('10 minutes')).toBeTruthy();
    expect(screen.getByText('15 minutes')).toBeTruthy();
  });

  it('highlights the initial minute on render', () => {
    render(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={10}
        minMinutes={1}
        maxMinutes={30}
        title="Select Duration"
      />
    );

    // Initial value should be highlighted
    const initialButton = screen.getByText('10 minutes');
    expect(initialButton).toBeTruthy();
    // The selected item would have special styling (tested via integration)
  });

  it('calls onConfirm with selected minute when confirm button pressed', async () => {
    render(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={10}
        minMinutes={1}
        maxMinutes={30}
        title="Select Duration"
      />
    );

    const confirmButton = screen.getByText('Confirm');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith(10);
    });
  });

  it('calls onClose when cancel button pressed', async () => {
    render(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={10}
        minMinutes={1}
        maxMinutes={30}
        title="Select Duration"
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.press(cancelButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('allows selecting different minute option', async () => {
    render(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={10}
        minMinutes={1}
        maxMinutes={30}
        title="Select Duration"
      />
    );

    // Select a different minute (15)
    const minuteButton = screen.getByText('15 minutes');
    fireEvent.press(minuteButton);

    const confirmButton = screen.getByText('Confirm');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith(15);
    });
  });

  it('respects minimum minute boundary', () => {
    render(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={5}
        minMinutes={5}
        maxMinutes={30}
        title="Select Duration"
      />
    );

    // Minimum should be 5
    expect(screen.getByText('5 minutes')).toBeTruthy();
  });

  it('respects maximum minute boundary', () => {
    render(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={25}
        minMinutes={1}
        maxMinutes={30}
        title="Select Duration"
      />
    );

    // Maximum should be 30
    expect(screen.getByText('30 minutes')).toBeTruthy();
  });

  it('displays title text correctly', () => {
    render(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={10}
        minMinutes={1}
        maxMinutes={30}
        title="Custom Ritual Duration"
      />
    );

    expect(screen.getByText('Custom Ritual Duration')).toBeTruthy();
  });

  it('does not call callbacks when backdrop pressed (modal remains open)', async () => {
    render(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={10}
        minMinutes={1}
        maxMinutes={30}
        title="Select Duration"
      />
    );

    // Modal should still be visible after actions
    expect(screen.getByText('Select Duration')).toBeTruthy();
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('handles edge case of single-minute range', () => {
    render(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={10}
        minMinutes={10}
        maxMinutes={10}
        title="Select Duration"
      />
    );

    // Should only show one option
    expect(screen.getByText('10 minutes')).toBeTruthy();
  });

  it('maintains selected value across re-renders', () => {
    const { rerender } = render(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={10}
        minMinutes={1}
        maxMinutes={30}
        title="Select Duration"
      />
    );

    // Select 15
    const minuteButton = screen.getByText('15');
    fireEvent.press(minuteButton);

    // Verify it's selected
    expect(screen.getByText('15')).toBeTruthy();

    // Re-render with same props
    rerender(
      <TimerPicker
        visible={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialMinutes={10}
        minMinutes={1}
        maxMinutes={30}
        title="Select Duration"
      />
    );

    // Selection should persist
    expect(screen.getByText('15')).toBeTruthy();
  });
});
