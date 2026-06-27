/**
 * Anchor App - Analytics Service
 *
 * Centralized analytics tracking for user behavior and feature usage.
 * Ready for integration with Mixpanel, Amplitude, or Firebase Analytics.
 */

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: Date;
}

export interface UserProperties {
  userId?: string;
  email?: string;
  displayName?: string;
  subscriptionStatus?: string;
  totalAnchorsCreated?: number;
  currentStreak?: number;
}

/**
 * Analytics Service
 *
 * Usage:
 * ```typescript
 * import { AnalyticsService } from '@/services/AnalyticsService';
 *
 * // Track event
 * AnalyticsService.track('anchor_created', { category: 'career' });
 *
 * // Identify user
 * AnalyticsService.identify('user-123', { email: 'user@example.com' });
 *
 * // Track screen view
 * AnalyticsService.screen('VaultScreen');
 * ```
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';
import { logger } from '@/utils/logger';

interface AnalyticsConfig {
  enabled?: boolean;
  posthogApiKey?: string;
  posthogHost?: string;
}

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';
const SENSITIVE_PROPERTY_KEYS = new Set([
  'email',
  'displayname',
  'display_name',
  'intention',
  'intentiontext',
  'intention_text',
  'mantra',
  'prompt',
  'ai_prompt',
  'generated_prompt',
  'message',
  'error_message',
  'image',
  'image_url',
  'artwork',
  'svg',
  'base64',
  'uri',
]);

const readPublicEnv = (value: string | undefined): string => value?.trim() ?? '';

const appVersion = Constants.expoConfig?.version ?? 'unknown';

const sanitizeAnalyticsValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeAnalyticsValue);
  }

  if (!value || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
    (sanitized, [key, nestedValue]) => {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!SENSITIVE_PROPERTY_KEYS.has(normalizedKey)) {
        sanitized[key] = sanitizeAnalyticsValue(nestedValue);
      }
      return sanitized;
    },
    {}
  );
};

export const sanitizeAnalyticsProperties = (
  properties?: Record<string, any>
): Record<string, any> | undefined => {
  if (!properties) {
    return undefined;
  }

  return sanitizeAnalyticsValue(properties) as Record<string, any>;
};

class Analytics {
  private enabled: boolean = true;
  private userId: string | null = null;
  private userProperties: UserProperties = {};
  private posthog: any = null;
  private initialized = false;

  private canSendToPostHog(): boolean {
    return this.enabled && this.posthog != null;
  }

  private safelyCallPostHog(action: string, callback: () => void): void {
    if (!this.canSendToPostHog()) {
      return;
    }

    try {
      callback();
    } catch (error) {
      logger.warn(`[Analytics] PostHog ${action} failed`, error);
    }
  }

  /**
   * Initialize analytics
   */
  initialize(config?: AnalyticsConfig): void {
    const envEnabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false';
    this.enabled = config?.enabled ?? envEnabled;

    logger.info('[Analytics] Initialized', { enabled: this.enabled });

    if (this.initialized) {
      try {
        this.posthog?.[this.enabled ? 'optIn' : 'optOut']?.();
      } catch (error) {
        logger.warn('[Analytics] PostHog opt state update failed', error);
      }
      return;
    }

    const posthogApiKey =
      config?.posthogApiKey ?? readPublicEnv(process.env.EXPO_PUBLIC_POSTHOG_API_KEY);
    const posthogHost =
      config?.posthogHost ??
      readPublicEnv(process.env.EXPO_PUBLIC_POSTHOG_HOST) ??
      DEFAULT_POSTHOG_HOST;

    if (!this.enabled || !posthogApiKey) {
      this.initialized = true;
      logger.warn('[Analytics] PostHog disabled or missing API key');
      return;
    }

    this.posthog = new PostHog(posthogApiKey, {
      host: posthogHost || DEFAULT_POSTHOG_HOST,
      disabled: !this.enabled,
      disableGeoip: true,
      enableSessionReplay: false,
      captureAppLifecycleEvents: true,
    });

    this.initialized = true;
  }

  /**
   * Identify the current user
   */
  identify(userId: string, properties?: UserProperties): void {
    if (!this.enabled) return;

    this.userId = userId;
    this.userProperties = { ...this.userProperties, ...properties };

    const safeProperties = sanitizeAnalyticsProperties(properties);

    logger.info('[Analytics] Identify', { userId, properties: safeProperties });

    this.safelyCallPostHog('identify', () => {
      this.posthog.identify(userId, safeProperties);
    });
  }

  /**
   * Track an event
   */
  track(eventName: string, properties?: Record<string, any>): void {
    if (!this.enabled) return;

    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        app_version: appVersion,
        platform: Platform.OS,
        ...sanitizeAnalyticsProperties(properties),
        userId: this.userId,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    logger.info('[Analytics] Track', event);

    this.safelyCallPostHog('capture', () => {
      this.posthog.capture(eventName, event.properties);
    });
  }

  /**
   * Track screen view
   */
  screen(screenName: string, properties?: Record<string, any>): void {
    this.track('screen_view', {
      screen_name: screenName,
      ...properties,
    });
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: UserProperties): void {
    if (!this.enabled) return;

    this.userProperties = { ...this.userProperties, ...properties };
    const safeProperties = sanitizeAnalyticsProperties(properties);

    logger.info('[Analytics] Set user properties', safeProperties);

    if (this.userId) {
      this.safelyCallPostHog('set user properties', () => {
        this.posthog.identify(this.userId, safeProperties);
      });
    }
  }

  /**
   * Increment a user property
   */
  incrementProperty(property: string, value: number = 1): void {
    if (!this.enabled) return;

    logger.info('[Analytics] Increment', { property, value });
  }

  /**
   * Reset analytics (on logout)
   */
  reset(): void {
    if (!this.enabled) return;

    this.userId = null;
    this.userProperties = {};

    logger.info('[Analytics] Reset');

    this.safelyCallPostHog('reset', () => {
      this.posthog.reset();
    });
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    logger.info('[Analytics] Set enabled', enabled);

    try {
      this.posthog?.[enabled ? 'optIn' : 'optOut']?.();
    } catch (error) {
      logger.warn(`[Analytics] PostHog ${enabled ? 'opt in' : 'opt out'} failed`, error);
    }
  }
}

// Export singleton instance
export const AnalyticsService = new Analytics();

// Export event names for consistency
export const AnalyticsEvents = {
  // App lifecycle
  APP_OPENED: 'app_opened',
  APP_BACKGROUNDED: 'app_backgrounded',

  // Authentication
  SIGN_UP_STARTED: 'sign_up_started',
  SIGN_UP_COMPLETED: 'sign_up_completed',
  SIGN_IN_STARTED: 'sign_in_started',
  SIGN_IN_COMPLETED: 'sign_in_completed',
  SIGN_OUT: 'sign_out',

  // Anchor creation
  ANCHOR_CREATION_STARTED: 'anchor_creation_started',
  ANCHOR_CREATION_COMPLETED: 'anchor_creation_completed',
  ANCHOR_CREATION_ABANDONED: 'anchor_creation_abandoned',
  INTENTION_ENTERED: 'intention_entered',
  SIGIL_SELECTED: 'sigil_selected',
  ENHANCEMENT_CHOSEN: 'enhancement_chosen',
  AI_GENERATION_STARTED: 'ai_generation_started',
  AI_GENERATION_COMPLETED: 'ai_generation_completed',
  AI_VARIATION_SELECTED: 'ai_variation_selected',
  MANTRA_CREATED: 'mantra_created',

  // Anchor usage
  ANCHOR_VIEWED: 'anchor_viewed',
  ANCHOR_DETAIL_VIEWED: 'anchor_detail_viewed',
  ANCHOR_CHARGED: 'anchor_charged',
  ANCHOR_ACTIVATED: 'anchor_activated',
  ANCHOR_DELETED: 'anchor_deleted',
  ANCHOR_BURNED: 'anchor_burned',

  // Rituals
  CHARGE_STARTED: 'charge_started',
  QUICK_CHARGE_STARTED: 'quick_charge_started',
  QUICK_CHARGE_COMPLETED: 'quick_charge_completed',
  DEEP_CHARGE_STARTED: 'deep_charge_started',
  DEEP_CHARGE_COMPLETED: 'deep_charge_completed',
  ACTIVATION_STARTED: 'activation_started',
  ACTIVATION_ATTEMPTED_UNCHARGED: 'activation_attempted_uncharged',
  ACTIVATION_RITUAL_STARTED: 'activation_ritual_started',
  ACTIVATION_RITUAL_COMPLETED: 'activation_ritual_completed',
  BURN_INITIATED: 'burn_initiated',
  BURN_COMPLETED: 'burn_completed',
  BURN_FAILED: 'burn_failed',

  // Subscription & Limits
  ANCHOR_LIMIT_REACHED: 'anchor_limit_reached',
  UPGRADE_INITIATED: 'upgrade_initiated',
  BURN_TO_MAKE_ROOM_INITIATED: 'burn_to_make_room_initiated',

  // Features
  MANUAL_FORGE_OPENED: 'manual_forge_opened',
  MANUAL_FORGE_COMPLETED: 'manual_forge_completed',
  MANTRA_AUDIO_PLAYED: 'mantra_audio_played',

  // Navigation
  VAULT_VIEWED: 'vault_viewed',
  DISCOVER_VIEWED: 'discover_viewed',
  SHOP_VIEWED: 'shop_viewed',
  PROFILE_VIEWED: 'profile_viewed',

  // Merch / Physical Anchors
  MERCH_INITIATED_FROM_ANCHOR_DETAILS: 'merch_initiated_from_anchor_details',
  MERCH_PRODUCT_SELECTED: 'merch_product_selected',
  MERCH_PRODUCT_VIEWED: 'merch_product_viewed',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',

  // Friction tracking
  FLOW_STARTED: 'flow_started',
  FLOW_STEP_VIEWED: 'flow_step_viewed',
  FLOW_STEP_COMPLETED: 'flow_step_completed',
  FLOW_STEP_ABANDONED: 'flow_step_abandoned',
  FLOW_BLOCKED: 'flow_blocked',
  FLOW_RETRY: 'flow_retry',
  FLOW_ERROR: 'flow_error',
  FLOW_COMPLETED: 'flow_completed',
} as const;
