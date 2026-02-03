import perf, { FirebasePerformanceTypes } from '@react-native-firebase/perf';
import { MobileEnv } from '@/config/env';

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
  private firebaseTraces: Map<string, Promise<FirebasePerformanceTypes.Trace> | FirebasePerformanceTypes.Trace> = new Map();

  private normalizeTraceName(name: string): string {
    const normalized = name.replace(/[^a-zA-Z0-9_]/g, '_');
    const withPrefix = /^[A-Za-z]/.test(normalized) ? normalized : `trace_${normalized}`;
    return withPrefix.slice(0, 100);
  }

  private normalizeAttributeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
  }

  private recordFirebaseTrace(
    traceName: string,
    attributes?: Record<string, any>,
    metrics?: Record<string, number>
  ): void {
    const normalizedName = this.normalizeTraceName(traceName);
    try {
      const tracePromise = perf().startTrace(normalizedName);
      this.firebaseTraces.set(normalizedName, tracePromise);

      void tracePromise
        .then((trace) => {
          if (attributes) {
            Object.entries(attributes).forEach(([key, value]) => {
              trace.putAttribute(this.normalizeAttributeKey(key), String(value));
            });
          }
          if (metrics) {
            Object.entries(metrics).forEach(([key, value]) => {
              trace.putMetric(this.normalizeAttributeKey(key), Math.round(value));
            });
          }
          this.firebaseTraces.set(normalizedName, trace);
          return trace.stop();
        })
        .catch((error) => {
          console.warn('[Performance] Firebase trace failed', error);
          this.firebaseTraces.delete(normalizedName);
        });
    } catch (error) {
      console.warn('[Performance] Firebase trace start failed', error);
      this.firebaseTraces.delete(normalizedName);
    }
  }

  /**
   * Initialize performance monitoring
   */
  initialize(config?: { enabled?: boolean }): void {
    this.enabled = config?.enabled ?? MobileEnv.FIREBASE_PERF_ENABLED;

    if (__DEV__) {
      console.log('[Performance] Initialized', { enabled: this.enabled });
    }

    try {
      void perf().setPerformanceCollectionEnabled(this.enabled);
    } catch (error) {
      console.warn('[Performance] Failed to configure Firebase Performance', error);
    }
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

    const normalizedName = this.normalizeTraceName(traceName);
    try {
      const tracePromise = perf().startTrace(normalizedName);
      this.firebaseTraces.set(normalizedName, tracePromise);

      void tracePromise
        .then((trace) => {
          if (metadata) {
            Object.entries(metadata).forEach(([key, value]) => {
              trace.putAttribute(this.normalizeAttributeKey(key), String(value));
            });
          }
          this.firebaseTraces.set(normalizedName, trace);
        })
        .catch((error) => {
          console.warn('[Performance] Firebase trace start failed', error);
          this.firebaseTraces.delete(normalizedName);
        });
    } catch (error) {
      console.warn('[Performance] Firebase trace start failed', error);
    }

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

    const normalizedName = this.normalizeTraceName(traceName);
    const traceEntry = this.firebaseTraces.get(normalizedName);
    if (traceEntry) {
      const finalizeTrace = (trace: FirebasePerformanceTypes.Trace) => {
        if (metric.metadata) {
          Object.entries(metric.metadata).forEach(([key, value]) => {
            trace.putAttribute(this.normalizeAttributeKey(key), String(value));
          });
        }
        trace.putMetric('duration_ms', Math.round(duration));
        return trace.stop();
      };

      if (traceEntry instanceof Promise) {
        void traceEntry
          .then((trace) => finalizeTrace(trace))
          .catch((error) => {
            console.warn('[Performance] Firebase trace stop failed', error);
          });
      } else {
        void finalizeTrace(traceEntry);
      }
      this.firebaseTraces.delete(normalizedName);
    }
  }

  /**
   * Record a screen load time
   */
  recordScreenLoad(screenName: string, duration: number): void {
    if (!this.enabled) return;

    if (__DEV__) {
      console.log('[Performance] Screen load', { screenName, duration: `${duration}ms` });
    }

    this.recordFirebaseTrace(`screen_${screenName}`, { screen: screenName }, { duration_ms: duration });
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

    this.recordFirebaseTrace(
      `api_${endpoint.replace(/\//g, '_')}`,
      { endpoint, success },
      { duration_ms: duration }
    );
  }

  /**
   * Record app startup time
   */
  recordAppStartup(duration: number): void {
    if (!this.enabled) return;

    if (__DEV__) {
      console.log('[Performance] App startup', { duration: `${duration}ms` });
    }

    this.recordFirebaseTrace('app_startup', { phase: 'startup' }, { duration_ms: duration });
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
