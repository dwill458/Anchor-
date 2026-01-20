import React from 'react';

/**
 * Anchor App - Performance Monitoring
 *
 * Track app performance metrics and bottlenecks.
 * Ready for integration with Firebase Performance or custom backend.
 */



interface PerformanceMetric {
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

  /**
   * Initialize performance monitoring
   */
  initialize(config?: { enabled?: boolean }): void {
    this.enabled = config?.enabled ?? true;

    if (__DEV__) {
      console.log('[Performance] Initialized', { enabled: this.enabled });
    }

    // TODO: Initialize Firebase Performance
    // Example:
    // import perf from '@react-native-firebase/perf';
    // await perf().setPerformanceCollectionEnabled(this.enabled);
  }

  /**
   * Start a performance trace
   */
  startTrace(traceName: string, metadata?: Record<string, any>): PerformanceTrace {
    if (!this.enabled) {
      return new PerformanceTrace(traceName, false);
    }

    const metric: PerformanceMetric = {
      name: traceName,
      startTime: Date.now(),
      metadata,
    };

    this.traces.set(traceName, metric);

    if (__DEV__) {
      console.log('[Performance] Trace started', traceName);
    }

    // TODO: Start trace in Firebase Performance
    // Example:
    // const trace = await perf().startTrace(traceName);
    // if (metadata) {
    //   Object.entries(metadata).forEach(([key, value]) => {
    //     trace.putAttribute(key, String(value));
    //   });
    // }

    return new PerformanceTrace(traceName, this.enabled, this);
  }

  /**
   * Stop a performance trace
   */
  stopTrace(traceName: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const metric = this.traces.get(traceName);
    if (!metric) {
      console.warn(`[Performance] Trace not found: ${traceName}`);
      return;
    }

    const duration = Date.now() - metric.startTime;
    metric.duration = duration;
    metric.metadata = { ...metric.metadata, ...metadata };

    if (__DEV__) {
      console.log('[Performance] Trace stopped', {
        name: traceName,
        duration: `${duration}ms`,
        metadata: metric.metadata,
      });
    }

    // Clean up
    this.traces.delete(traceName);

    // TODO: Stop trace in Firebase Performance
    // Example:
    // await trace.stop();
  }

  /**
   * Record a screen load time
   */
  recordScreenLoad(screenName: string, duration: number): void {
    if (!this.enabled) return;

    if (__DEV__) {
      console.log('[Performance] Screen load', { screenName, duration: `${duration}ms` });
    }

    // TODO: Record in Firebase Performance or analytics
    // Example:
    // const trace = await perf().startTrace(`screen_${screenName}`);
    // await trace.stop();
  }

  /**
   * Record API call performance
   */
  recordApiCall(endpoint: string, duration: number, success: boolean): void {
    if (!this.enabled) return;

    if (__DEV__) {
      console.log('[Performance] API call', {
        endpoint,
        duration: `${duration}ms`,
        success,
      });
    }

    // TODO: Record in Firebase Performance
    // Example:
    // const trace = await perf().startTrace(`api_${endpoint.replace(/\//g, '_')}`);
    // trace.putAttribute('success', String(success));
    // await trace.stop();
  }

  /**
   * Record app startup time
   */
  recordAppStartup(duration: number): void {
    if (!this.enabled) return;

    if (__DEV__) {
      console.log('[Performance] App startup', { duration: `${duration}ms` });
    }

    // TODO: Record in Firebase Performance
  }

  /**
   * Enable/disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (__DEV__) {
      console.log('[Performance] Set enabled', enabled);
    }
  }
}

/**
 * Performance Trace helper class
 */
export class PerformanceTrace {
  private name: string;
  private enabled: boolean;
  private performance?: Performance;
  private metadata: Record<string, any> = {};

  constructor(name: string, enabled: boolean, performance?: Performance) {
    this.name = name;
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
    this.performance?.stopTrace(this.name, finalMetadata);
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
