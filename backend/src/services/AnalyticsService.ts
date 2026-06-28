import { env } from '../config/env';
import { logger } from '../utils/logger';

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

class BackendAnalytics {
  private readonly enabled = Boolean(env.POSTHOG_API_KEY);
  private readonly host = env.POSTHOG_HOST.replace(/\/$/, '');

  track(event: string, distinctId: string, properties: AnalyticsProperties = {}): void {
    if (!this.enabled || !env.POSTHOG_API_KEY) {
      return;
    }

    const payload = {
      api_key: env.POSTHOG_API_KEY,
      event,
      distinct_id: distinctId,
      properties: {
        source: 'backend',
        environment: env.NODE_ENV,
        ...properties,
      },
    };

    void fetch(`${this.host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(error => {
      logger.warn('[Analytics] Failed to send PostHog event', {
        event,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}

export const BackendAnalyticsService = new BackendAnalytics();
