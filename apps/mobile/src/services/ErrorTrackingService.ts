/**
 * Anchor App - Error Tracking Service
 *
 * Centralized error tracking and reporting using Sentry.
 */

import * as Sentry from '@sentry/react-native';
import { MobileEnv } from '@/config/env';

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
  private initialized: boolean = false;

  /**
   * Initialize error tracking
   */
  initialize(config?: { dsn?: string; enabled?: boolean }): void {
    // Only enable in production by default
    this.enabled = config?.enabled ?? !__DEV__;

    if (this.enabled && !this.initialized) {
      const dsn = config?.dsn || MobileEnv.SENTRY_DSN;
      if (!dsn) {
        console.warn('[ErrorTracking] Sentry DSN missing; error tracking disabled.');
        this.enabled = false;
        return;
      }

      Sentry.init({
        dsn,
        environment: MobileEnv.SENTRY_ENVIRONMENT,
        enableInExpoDevelopment: false,
        debug: __DEV__,
      });

      this.initialized = true;
      console.log('[ErrorTracking] Initialized');
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

    Sentry.setUser({
      id: userId,
      email,
      username: displayName,
    });
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

    Sentry.setContext(key, value);
  }

  /**
   * Add breadcrumb (trail of events leading to error)
   */
  addBreadcrumb(message: string, category?: string, data?: Record<string, any>): void {
    if (!this.enabled) return;

    if (__DEV__) {
      console.log('[ErrorTracking] Breadcrumb', { message, category, data });
    }

    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
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

    Sentry.captureException(error);
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

    const levelMap: Record<ErrorSeverity, Sentry.SeverityLevel> = {
      [ErrorSeverity.Fatal]: 'fatal',
      [ErrorSeverity.Error]: 'error',
      [ErrorSeverity.Warning]: 'warning',
      [ErrorSeverity.Info]: 'info',
      [ErrorSeverity.Debug]: 'debug',
    };

    Sentry.captureMessage(message, levelMap[severity]);
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

    Sentry.setUser(null);
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
