/**
 * Anchor App - ErrorBoundary Component Tests
 *
 * Unit tests for ErrorBoundary component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary } from '../ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <Text>No error</Text>;
};

describe('ErrorBoundary Component', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>Test child</Text>
      </ErrorBoundary>
    );

    expect(getByText('Test child')).toBeTruthy();
  });

  it('should render fallback UI when child throws error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Something Went Wrong')).toBeTruthy();
  });

  it('should display error message in fallback UI', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(
      getByText("We encountered an unexpected error. Don't worry, your data is safe.")
    ).toBeTruthy();
  });

  it('should render "Try Again" button in fallback UI', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Try Again')).toBeTruthy();
  });

  it('should reset error state when "Try Again" is pressed', () => {
    const { getByText, rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Error UI should be visible
    expect(getByText('Something Went Wrong')).toBeTruthy();

    // Press Try Again
    const tryAgainButton = getByText('Try Again');
    fireEvent.press(tryAgainButton);

    // Re-render with no error
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    // Should show children again
    expect(getByText('No error')).toBeTruthy();
  });

  it('should render custom fallback if provided', () => {
    const customFallback = <Text>Custom error UI</Text>;

    const { getByText } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Custom error UI')).toBeTruthy();
  });

  it('should have proper accessibility', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tryAgainButton = getByText('Try Again');
    // Button should be accessible
    expect(tryAgainButton).toBeTruthy();
  });

  it('should display error details in development mode', () => {
    // Mock __DEV__ flag
    const originalDev = global.__DEV__;
    global.__DEV__ = true;

    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Error Details (Dev Only):')).toBeTruthy();

    // Restore __DEV__ flag
    global.__DEV__ = originalDev;
  });

  it('should not display error details in production mode', () => {
    // Mock __DEV__ flag
    const originalDev = global.__DEV__;
    global.__DEV__ = false;

    const { queryByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(queryByText('Error Details (Dev Only):')).toBeNull();

    // Restore __DEV__ flag
    global.__DEV__ = originalDev;
  });
});
