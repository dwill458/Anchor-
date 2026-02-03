/**
 * Anchor App - ToastProvider Tests
 *
 * Tests for global toast notification management
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ToastProvider, useToast } from '../ToastProvider';

jest.mock('../Toast', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Toast: jest.fn(({ message, type }) =>
      React.createElement(Text, { testID: `toast-${type}` }, message)
    ),
  };
});

// Enable fake timers
jest.useFakeTimers();

// Test component that uses the toast context
const TestComponent = ({ onToastReady }: { onToastReady?: (toast: any) => void }) => {
  const toast = useToast();

  React.useEffect(() => {
    if (onToastReady) {
      onToastReady(toast);
    }
  }, [toast, onToastReady]);

  return <Text>Test Component</Text>;
};

describe('ToastProvider', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Context Availability', () => {
    it('should throw error when useToast is used outside ToastProvider', () => {
      // Suppress console.error for this test
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useToast must be used within ToastProvider');

      spy.mockRestore();
    });

    it('should provide toast context to children', () => {
      let toastContext: any;

      render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      expect(toastContext).toBeDefined();
      expect(toastContext.showToast).toBeDefined();
      expect(toastContext.success).toBeDefined();
      expect(toastContext.error).toBeDefined();
      expect(toastContext.info).toBeDefined();
      expect(toastContext.warning).toBeDefined();
    });
  });

  describe('Toast Display', () => {
    it('should display toast with showToast', () => {
      let toastContext: any;

      const { getByText } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.showToast('Test message', 'info');
      });

      expect(getByText('Test message')).toBeTruthy();
    });

    it('should display success toast', () => {
      let toastContext: any;

      const { getByText, getByTestId } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.success('Success message');
      });

      expect(getByText('Success message')).toBeTruthy();
      expect(getByTestId('toast-success')).toBeTruthy();
    });

    it('should display error toast', () => {
      let toastContext: any;

      const { getByText, getByTestId } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.error('Error message');
      });

      expect(getByText('Error message')).toBeTruthy();
      expect(getByTestId('toast-error')).toBeTruthy();
    });

    it('should display info toast', () => {
      let toastContext: any;

      const { getByText, getByTestId } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.info('Info message');
      });

      expect(getByText('Info message')).toBeTruthy();
      expect(getByTestId('toast-info')).toBeTruthy();
    });

    it('should display warning toast', () => {
      let toastContext: any;

      const { getByText, getByTestId } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.warning('Warning message');
      });

      expect(getByText('Warning message')).toBeTruthy();
      expect(getByTestId('toast-warning')).toBeTruthy();
    });
  });

  describe('Toast Queue Management', () => {
    it('should display multiple toasts at once', () => {
      let toastContext: any;

      const { getByText } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.success('First toast');
        toastContext.error('Second toast');
        toastContext.info('Third toast');
      });

      expect(getByText('First toast')).toBeTruthy();
      expect(getByText('Second toast')).toBeTruthy();
      expect(getByText('Third toast')).toBeTruthy();
    });

    it('should stack toasts vertically', () => {
      let toastContext: any;

      const { getAllByText } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.info('Toast 1');
        toastContext.info('Toast 2');
        toastContext.info('Toast 3');
      });

      // All toasts should be rendered
      const toasts = getAllByText(/Toast/);
      expect(toasts.length).toBe(3);
    });
  });

  describe('Auto-dismiss', () => {
    it('should auto-dismiss toast after default duration', async () => {
      let toastContext: any;

      const { getByText, queryByText } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.showToast('Temporary message', 'info');
      });

      expect(getByText('Temporary message')).toBeTruthy();

      // Advance timers by 3500ms (duration + animation time)
      act(() => {
        jest.advanceTimersByTime(3500);
      });

      await waitFor(() => {
        expect(queryByText('Temporary message')).toBeNull();
      });
    });

    it('should auto-dismiss toast after custom duration', async () => {
      let toastContext: any;

      const { getByText, queryByText } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.showToast('Custom duration', 'info', 1000);
      });

      expect(getByText('Custom duration')).toBeTruthy();

      // Advance timers by 1500ms (custom duration + animation time)
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(queryByText('Custom duration')).toBeNull();
      });
    });

    it('should use custom duration for success toast', async () => {
      let toastContext: any;

      const { getByText, queryByText } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.success('Quick success', 500);
      });

      expect(getByText('Quick success')).toBeTruthy();

      // Advance timers by 1000ms (500ms + 500ms animation)
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(queryByText('Quick success')).toBeNull();
      });
    });

    it('should dismiss multiple toasts independently', async () => {
      let toastContext: any;

      const { getByText, queryByText } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.showToast('First', 'info', 1000);
        toastContext.showToast('Second', 'info', 2000);
      });

      expect(getByText('First')).toBeTruthy();
      expect(getByText('Second')).toBeTruthy();

      // After 1500ms, first toast should be gone
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(queryByText('First')).toBeNull();
        expect(getByText('Second')).toBeTruthy();
      });

      // After another 1000ms, second toast should be gone
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(queryByText('Second')).toBeNull();
      });
    });
  });

  describe('Toast Types', () => {
    it('should default to info type when type is not specified', () => {
      let toastContext: any;

      const { getByTestId } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.showToast('Default type message');
      });

      expect(getByTestId('toast-info')).toBeTruthy();
    });

    it('should default to 3000ms duration when not specified', async () => {
      let toastContext: any;

      const { getByText, queryByText } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.success('Default duration');
      });

      expect(getByText('Default duration')).toBeTruthy();

      // Should still be visible after 2000ms
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(getByText('Default duration')).toBeTruthy();

      // Should be gone after 3500ms total (3000ms + 500ms animation)
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(queryByText('Default duration')).toBeNull();
      });
    });
  });

  describe('Toast Rendering', () => {
    it('should render children components', () => {
      const { getByText } = render(
        <ToastProvider>
          <Text>Child Component</Text>
        </ToastProvider>
      );

      expect(getByText('Child Component')).toBeTruthy();
    });

    it('should render toasts above children', () => {
      let toastContext: any;

      const { getByText } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
          <Text>Background Content</Text>
        </ToastProvider>
      );

      expect(getByText('Background Content')).toBeTruthy();

      act(() => {
        toastContext.info('Foreground Toast');
      });

      expect(getByText('Foreground Toast')).toBeTruthy();
      expect(getByText('Background Content')).toBeTruthy();
    });
  });

  describe('Helper Methods', () => {
    it('should call showToast with success type', () => {
      let toastContext: any;

      const { getByTestId } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.success('Success!');
      });

      expect(getByTestId('toast-success')).toBeTruthy();
    });

    it('should call showToast with error type', () => {
      let toastContext: any;

      const { getByTestId } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.error('Error!');
      });

      expect(getByTestId('toast-error')).toBeTruthy();
    });

    it('should call showToast with info type', () => {
      let toastContext: any;

      const { getByTestId } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.info('Info!');
      });

      expect(getByTestId('toast-info')).toBeTruthy();
    });

    it('should call showToast with warning type', () => {
      let toastContext: any;

      const { getByTestId } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.warning('Warning!');
      });

      expect(getByTestId('toast-warning')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message', () => {
      let toastContext: any;

      const { getByText } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.info('');
      });

      expect(getByText('')).toBeTruthy();
    });

    it('should handle very long messages', () => {
      let toastContext: any;

      const { getByText } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      const longMessage = 'A'.repeat(200);

      act(() => {
        toastContext.info(longMessage);
      });

      expect(getByText(longMessage)).toBeTruthy();
    });

    it('should handle rapid toast creation', () => {
      let toastContext: any;

      const { getAllByText } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        for (let i = 0; i < 10; i++) {
          toastContext.info(`Toast ${i}`);
        }
      });

      // All toasts should be rendered
      const toasts = getAllByText(/Toast/);
      expect(toasts.length).toBe(10);
    });

    it('should handle mixed toast types', () => {
      let toastContext: any;

      const { getByTestId } = render(
        <ToastProvider>
          <TestComponent onToastReady={(toast) => (toastContext = toast)} />
        </ToastProvider>
      );

      act(() => {
        toastContext.success('Success');
        toastContext.error('Error');
        toastContext.warning('Warning');
        toastContext.info('Info');
      });

      expect(getByTestId('toast-success')).toBeTruthy();
      expect(getByTestId('toast-error')).toBeTruthy();
      expect(getByTestId('toast-warning')).toBeTruthy();
      expect(getByTestId('toast-info')).toBeTruthy();
    });
  });
});
