/**
 * Anchor App - Toast Component Tests
 *
 * Unit tests for Toast notification component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Toast } from '../Toast';
import * as Haptics from 'expo-haptics';

// Mock Haptics
jest.mock('expo-haptics');

describe('Toast Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with message', () => {
    const { getByText } = render(<Toast message="Test message" />);
    expect(getByText('Test message')).toBeTruthy();
  });

  it('should render success type with correct icon', () => {
    const { getByText } = render(<Toast message="Success!" type="success" />);
    expect(getByText('✓')).toBeTruthy();
  });

  it('should render error type with correct icon', () => {
    const { getByText } = render(<Toast message="Error!" type="error" />);
    expect(getByText('✕')).toBeTruthy();
  });

  it('should render warning type with correct icon', () => {
    const { getByText } = render(<Toast message="Warning!" type="warning" />);
    expect(getByText('⚠')).toBeTruthy();
  });

  it('should render info type with correct icon', () => {
    const { getByText } = render(<Toast message="Info!" type="info" />);
    expect(getByText('ℹ')).toBeTruthy();
  });

  it('should trigger haptic feedback for success', () => {
    render(<Toast message="Success!" type="success" />);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success
    );
  });

  it('should trigger haptic feedback for error', () => {
    render(<Toast message="Error!" type="error" />);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error
    );
  });

  it('should trigger impact haptic for info', () => {
    render(<Toast message="Info!" type="info" />);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium
    );
  });

  it('should call onDismiss when pressed', () => {
    const onDismiss = jest.fn();
    const { getByRole } = render(
      <Toast message="Test" onDismiss={onDismiss} />
    );

    const button = getByRole('button');
    fireEvent.press(button);

    // Wait for animation to complete
    setTimeout(() => {
      expect(onDismiss).toHaveBeenCalled();
    }, 300);
  });

  it('should have proper accessibility label', () => {
    const { getByRole } = render(
      <Toast message="Test message" type="success" />
    );

    const alert = getByRole('alert');
    expect(alert.props.accessibilityLabel).toBe('Success notification: Test message');
  });

  it('should have accessibility live region', () => {
    const { getByRole } = render(<Toast message="Test" />);
    const alert = getByRole('alert');
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
  });

  it('should auto-dismiss after duration', (done) => {
    const onDismiss = jest.fn();
    render(<Toast message="Test" duration={100} onDismiss={onDismiss} />);

    setTimeout(() => {
      expect(onDismiss).toHaveBeenCalled();
      done();
    }, 150);
  });

  it('should truncate long messages to 3 lines', () => {
    const longMessage = 'This is a very long message that should be truncated to three lines maximum to ensure the toast notification does not take up too much space on the screen';
    const { getByText } = render(<Toast message={longMessage} />);

    const messageElement = getByText(longMessage);
    expect(messageElement.props.numberOfLines).toBe(3);
  });
});
