import React from 'react';
import { monitoringConfig } from '@/config/monitoring';
import { ErrorSeverity, ErrorTrackingService } from './ErrorTrackingService';
import { logger } from '@/utils/logger';

/**
 * Anchor App - Performance Monitoring
 *
 * Track app performance metrics and bottlenecks.
 * Ready for integration with Firebase Performance or custom backend.
 */


interface PerformanceMetric {
  id: string;
  name: string;
  startTime: number;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Performance Monitoring Service
 *
 * Usage:
 * ```typescript
 * import { PerformanceMonitoring } from '@/services/PerformanceMonitoring';
 *
 * // Track a custom metric
 * const trace = PerformanceMonitoring.startTrace('anchor_creation');
 * // ... do work ...
 * trace.stop();
 *
 * // Track API call
 * const apiTrace = PerformanceMonitoring.startTrace('api_fetch_anchors');
 * try {
 *   await fetchAnchors();
 *   apiTrace.stop();
 * } catch (error) {
 *   apiTrace.stop({ error: true });
 * }
 * ```
 */
class Performance {
  private enabled: boolean = true;
  private traces: Map<string, PerformanceMetric> = new Map();
  private slowThresholdMs: number = monitoringConfig.slowRequestThresholdMs;

  /**
   * Initialize performance monitoring
   */
  initialize(config?: { enabled?: boolean }): void {
    this.enabled = config?.enabled ?? true;

    logger.info('[Performance] Initialized', {
      enabled: this.enabled,
      slowThresholdMs: this.slowThresholdMs,
    });
  }

  /**
   * Start a performance trace
   */
  startTrace(traceName: string, metadata?: Record<string, any>): PerformanceTrace {
    if (!this.enabled) {
      return new PerformanceTrace(traceName, '', false);
    }

    const traceId = `${traceName}_${Date.now()}_${Math.round(Math.random() * 100000)}`;
    const metric: PerformanceMetric = {
      id: traceId,
      name: traceName,
      startTime: Date.now(),
      metadata,
    };

    this.traces.set(traceId, metric);
    logger.debug('[Performance] Trace started', { traceName, traceId, metadata });
    return new PerformanceTrace(traceName, traceId, this.enabled, this);
  }

  /**
   * Stop a performance trace
   */
  stopTrace(traceId: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const metric = this.traces.get(traceId);
    if (!metric) {
      logger.warn('[Performance] Trace not found', { traceId });
      return;
    }

    const duration = Date.now() - metric.startTime;
    metric.duration = duration;
    metric.metadata = { ...metric.metadata, ...metadata };

    logger.info('[Performance] Trace stopped', {
      traceId,
      name: metric.name,
      durationMs: duration,
      metadata: metric.metadata,
    });

    if (duration >= this.slowThresholdMs) {
      ErrorTrackingService.captureMessage(`Slow operation: ${metric.name}`, ErrorSeverity.Warning);
      ErrorTrackingService.addBreadcrumb('Slow operation detected', 'performance', {
        trace_id: traceId,
        name: metric.name,
        duration_ms: duration,
      });
    }

    // Clean up
    this.traces.delete(traceId);
  }

  /**
   * Record a screen load time
   */
  recordScreenLoad(screenName: string, duration: number): void {
    if (!this.enabled) return;

    logger.info('[Performance] Screen load', { screenName, durationMs: duration });
    ErrorTrackingService.addBreadcrumb('Screen load', 'performance.screen', {
      screen_name: screenName,
      duration_ms: duration,
    });
  }

  /**
   * Record API call performance
   */
  recordApiCall(endpoint: string, duration: number, success: boolean): void {
    if (!this.enabled) return;

    logger.info('[Performance] API call', {
      endpoint,
      durationMs: duration,
      success,
    });
    ErrorTrackingService.addBreadcrumb('API call', 'performance.api', {
      endpoint,
      duration_ms: duration,
      success,
    });
  }

  /**
   * Record app startup time
   */
  recordAppStartup(duration: number): void {
    if (!this.enabled) return;

    logger.info('[Performance] App startup', { durationMs: duration });
  }

  /**
   * Enable/disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info('[Performance] Set enabled', { enabled });
  }
}

/**
 * Performance Trace helper class
 */
export class PerformanceTrace {
  private name: string;
  private id: string;
  private enabled: boolean;
  private performance?: Performance;
  private metadata: Record<string, any> = {};

  constructor(name: string, id: string, enabled: boolean, performance?: Performance) {
    this.name = name;
    this.id = id;
    this.enabled = enabled;
    this.performance = performance;
  }

  /**
   * Add custom attributes
   */
  putAttribute(key: string, value: string | number | boolean): void {
    if (!this.enabled) return;
    this.metadata[key] = value;
  }

  /**
   * Stop the trace
   */
  stop(metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const finalMetadata = { ...this.metadata, ...metadata };
    this.performance?.stopTrace(this.id, finalMetadata);
  }
}

// Export singleton instance
export const PerformanceMonitoring = new Performance();

/**
 * React Navigation performance tracking
 */
export const trackScreenPerformance = (screenName: string) => {
  const startTime = Date.now();

  return () => {
    const duration = Date.now() - startTime;
    PerformanceMonitoring.recordScreenLoad(screenName, duration);
  };
};

/**
 * HOC to track component render performance
 * 
 * NOTE: This function is commented out because .ts files cannot contain JSX.
 * If you need this HOC, move it to a separate .tsx file.
 */
/*
export const withPerformanceTracking = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.FC<P> => {
  return (props: P) => {
    React.useEffect(() => {
      const trace = PerformanceMonitoring.startTrace(`component_${componentName}_mount`);
      return () => trace.stop();
    }, []);

    return <Component { ...props } />;
  };
};
*/
