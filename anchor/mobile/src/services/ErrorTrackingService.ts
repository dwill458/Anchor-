import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { monitoringConfig } from '@/config/monitoring';
import { logger } from '@/utils/logger';

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

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error('Unknown error');
};

export const routingInstrumentation = Sentry.reactNavigationIntegration();

class ErrorTracking {
  private enabled = monitoringConfig.sentryEnabled;
  private initialized = false;
  private globalHandlerInstalled = false;

  initialize(config?: {
    dsn?: string;
    enabled?: boolean;
    environment?: string;
    release?: string;
    traceSampleRate?: number;
    profileSampleRate?: number;
  }): void {
    if (this.initialized) {
      return;
    }

    const dsn = config?.dsn ?? monitoringConfig.sentryDsn;
    this.enabled = config?.enabled ?? monitoringConfig.sentryEnabled;

    if (!dsn) {
      logger.warn('[ErrorTracking] Sentry DSN missing; remote crash tracking disabled');
      this.initialized = true;
      return;
    }

    Sentry.init({
      dsn,
      enabled: this.enabled,
      release: config?.release ?? monitoringConfig.release,
      environment: config?.environment ?? monitoringConfig.environment,
      tracesSampleRate: config?.traceSampleRate ?? monitoringConfig.traceSampleRate,
      profilesSampleRate: config?.profileSampleRate ?? monitoringConfig.profileSampleRate,
      enableAutoSessionTracking: true,
      attachStacktrace: true,
      debug: __DEV__,
      integrations: [
        routingInstrumentation,
        Sentry.reactNativeTracingIntegration(),
      ],
    });

    Sentry.setTag('platform', Platform.OS);
    Sentry.setTag('expo_runtime_version', String(process.env.EXPO_PUBLIC_APP_RELEASE ?? 'unknown'));

    this.initialized = true;
    logger.info('[ErrorTracking] Initialized', {
      enabled: this.enabled,
      environment: monitoringConfig.environment,
      release: monitoringConfig.release,
    });
  }

  registerNavigationContainer(navigationContainerRef: unknown): void {
    try {
      routingInstrumentation.registerNavigationContainer(navigationContainerRef as any);
    } catch (error) {
      logger.warn('[ErrorTracking] Failed to register navigation container', error);
    }
  }

  setUser(userId: string, email?: string, displayName?: string): void {
    Sentry.setUser({
      id: userId,
      email,
      username: displayName,
    });
  }

  clearUser(): void {
    Sentry.setUser(null);
  }

  setTag(key: string, value: string): void {
    Sentry.setTag(key, value);
  }

  setContext(key: string, value: Record<string, any>): void {
    Sentry.setContext(key, value);
  }

  addBreadcrumb(message: string, category?: string, data?: Record<string, any>): void {
    Sentry.addBreadcrumb({
      message,
      category: category ?? 'app',
      data,
      level: 'info',
      timestamp: Date.now() / 1000,
    });
  }

  trackNavigation(fromRoute: string | undefined, toRoute: string): void {
    this.addBreadcrumb('Navigation', 'navigation', {
      from: fromRoute ?? 'unknown',
      to: toRoute,
    });
    Sentry.setTag('current_route', toRoute);
  }

  captureException(error: unknown, context?: ErrorContext): void {
    const normalized = normalizeError(error);

    if (context) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          if (value != null && (typeof value === 'object' || Array.isArray(value))) {
            scope.setContext(key, { value });
          } else {
            scope.setExtra(key, value as any);
          }
        });
        Sentry.captureException(normalized);
      });
      return;
    }

    Sentry.captureException(normalized);
  }

  captureMessage(message: string, severity: ErrorSeverity = ErrorSeverity.Info): void {
    const levelMap: Record<ErrorSeverity, Sentry.SeverityLevel> = {
      [ErrorSeverity.Fatal]: 'fatal',
      [ErrorSeverity.Error]: 'error',
      [ErrorSeverity.Warning]: 'warning',
      [ErrorSeverity.Info]: 'info',
      [ErrorSeverity.Debug]: 'debug',
    };

    Sentry.captureMessage(message, levelMap[severity]);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  installGlobalHandlers(): void {
    if (this.globalHandlerInstalled) {
      return;
    }

    const originalGlobalHandler = ErrorUtils.getGlobalHandler?.();

    ErrorUtils.setGlobalHandler?.((error, isFatal) => {
      this.captureException(error, {
        isFatal,
        type: 'unhandled_js_exception',
      });

      if (originalGlobalHandler) {
        originalGlobalHandler(error, isFatal);
      }
    });

    try {
      // RN does not surface unhandled promise rejections consistently in production.
      // This installs explicit rejection tracking for better crash forensics.
      const rejectionTracking = require('promise/setimmediate/rejection-tracking');
      rejectionTracking.enable({
        allRejections: true,
        onUnhandled: (_id: number, error: unknown) => {
          this.captureException(error, { type: 'unhandled_promise_rejection' });
        },
        onHandled: () => undefined,
      });
    } catch (error) {
      logger.warn('[ErrorTracking] Promise rejection tracking unavailable', error);
    }

    this.globalHandlerInstalled = true;
  }
}

export const ErrorTrackingService = new ErrorTracking();

export const setupGlobalErrorHandler = (): void => {
  ErrorTrackingService.installGlobalHandlers();
};
