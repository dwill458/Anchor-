/**
 * Anchor App - Error Tracking Service
 *
 * Centralized error tracking and reporting.
 * Ready for integration with Sentry, Bugsnag, or similar services.
 */

export interface ErrorContext {
  userId?: string;
  screen?: string;
  action?: string;
  [key: string]: any;
}

export enum ErrorSeverity {
  Fatal = 'fatal',
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Debug = 'debug',
}

/**
 * Error Tracking Service
 *
 * Usage:
 * ```typescript
 * import { ErrorTrackingService } from '@/services/ErrorTrackingService';
 *
 * // Initialize (in App.tsx)
 * ErrorTrackingService.initialize();
 *
 * // Capture error
 * try {
 *   // risky code
 * } catch (error) {
 *   ErrorTrackingService.captureException(error, {
 *     screen: 'VaultScreen',
 *     action: 'loading_anchors'
 *   });
 * }
 *
 * // Log message
 * ErrorTrackingService.captureMessage('Something went wrong', ErrorSeverity.Warning);
 * ```
 */
class ErrorTracking {
  private enabled: boolean = true;
  private userId: string | null = null;
  private context: ErrorContext = {};

  /**
   * Initialize error tracking
   */
  initialize(config?: { dsn?: string; enabled?: boolean }): void {
    // Only enable in production by default
    this.enabled = config?.enabled ?? !__DEV__;

    if (this.enabled) {
      console.log('[ErrorTracking] Initialized');

      // TODO: Initialize Sentry
      // Example:
      // import * as Sentry from '@sentry/react-native';
      // Sentry.init({
      //   dsn: config?.dsn || process.env.SENTRY_DSN,
      //   enableInExpoDevelopment: false,
      //   debug: __DEV__,
      // });
    }
  }

  /**
   * Set user context
   */
  setUser(userId: string, email?: string, displayName?: string): void {
    if (!this.enabled) return;

    this.userId = userId;

    if (__DEV__) {
      console.log('[ErrorTracking] Set user', { userId, email, displayName });
    }

    // TODO: Set user in Sentry
    // Example:
    // Sentry.setUser({
    //   id: userId,
    //   email,
    //   username: displayName,
    // });
  }

  /**
   * Set additional context
   */
  setContext(key: string, value: Record<string, any>): void {
    if (!this.enabled) return;

    this.context[key] = value;

    if (__DEV__) {
      console.log('[ErrorTracking] Set context', { key, value });
    }

    // TODO: Set context in Sentry
    // Example:
    // Sentry.setContext(key, value);
  }

  /**
   * Add breadcrumb (trail of events leading to error)
   */
  addBreadcrumb(message: string, category?: string, data?: Record<string, any>): void {
    if (!this.enabled) return;

    if (__DEV__) {
      console.log('[ErrorTracking] Breadcrumb', { message, category, data });
    }

    // TODO: Add breadcrumb in Sentry
    // Example:
    // Sentry.addBreadcrumb({
    //   message,
    //   category,
    //   data,
    //   level: 'info',
    // });
  }

  /**
   * Capture an exception
   */
  captureException(error: Error, context?: ErrorContext): void {
    if (!this.enabled) {
      if (__DEV__) {
        console.error('[ErrorTracking] Exception (dev mode)', error, context);
      }
      return;
    }

    console.error('[ErrorTracking] Capturing exception', error);

    // Add context
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        this.setContext(key, { value });
      });
    }

    // TODO: Capture in Sentry
    // Example:
    // Sentry.captureException(error);
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, severity: ErrorSeverity = ErrorSeverity.Info): void {
    if (!this.enabled) {
      if (__DEV__) {
        console.log('[ErrorTracking] Message (dev mode)', { message, severity });
      }
      return;
    }

    console.log('[ErrorTracking] Capturing message', { message, severity });

    // TODO: Capture in Sentry
    // Example:
    // Sentry.captureMessage(message, severity);
  }

  /**
   * Clear user context (on logout)
   */
  clearUser(): void {
    if (!this.enabled) return;

    this.userId = null;
    this.context = {};

    if (__DEV__) {
      console.log('[ErrorTracking] Clear user');
    }

    // TODO: Clear user in Sentry
    // Example:
    // Sentry.setUser(null);
  }

  /**
   * Enable/disable error tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (__DEV__) {
      console.log('[ErrorTracking] Set enabled', enabled);
    }
  }
}

// Export singleton instance
export const ErrorTrackingService = new ErrorTracking();

/**
 * Global error handler setup
 * Call this in App.tsx after initialization
 */
export const setupGlobalErrorHandler = (): void => {
  // Capture unhandled promise rejections
  const originalHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    ErrorTrackingService.captureException(error, {
      isFatal,
      type: 'unhandled',
    });

    // Call original handler
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });

  // Log that we set up the handler
  if (__DEV__) {
    console.log('[ErrorTracking] Global error handler installed');
  }
};
