/**
 * Anchor App - Analytics Service
 *
 * Centralized analytics tracking for user behavior and feature usage.
 * Supports Mixpanel and Amplitude (or both) with runtime configuration.
 */

import { Mixpanel } from 'mixpanel-react-native';
import { createInstance, Identify } from '@amplitude/analytics-react-native';
import { MobileEnv, type AnalyticsProvider } from '@/config/env';

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
class Analytics {
  private enabled: boolean = true;
  private userId: string | null = null;
  private userProperties: UserProperties = {};
  private provider: AnalyticsProvider = 'mixpanel';
  private mixpanel?: Mixpanel;
  private amplitude = createInstance();
  private initialized = false;

  private ensureInitialized(): boolean {
    if (!this.initialized) {
      this.initialize();
    }
    return this.enabled;
  }

  private sanitizeProperties(properties?: Record<string, any>): Record<string, any> {
    if (!properties) return {};
    return Object.entries(properties).reduce<Record<string, any>>((acc, [key, value]) => {
      if (value === undefined) return acc;
      if (value instanceof Date) {
        acc[key] = value.toISOString();
        return acc;
      }
      acc[key] = value;
      return acc;
    }, {});
  }

  private shouldUseMixpanel(): boolean {
    return this.provider === 'mixpanel' || this.provider === 'both';
  }

  private shouldUseAmplitude(): boolean {
    return this.provider === 'amplitude' || this.provider === 'both';
  }

  /**
   * Initialize analytics
   */
  initialize(config?: {
    enabled?: boolean;
    provider?: AnalyticsProvider;
    mixpanelToken?: string;
    amplitudeApiKey?: string;
  }): void {
    this.enabled = config?.enabled ?? MobileEnv.ANALYTICS_ENABLED;
    this.provider = config?.provider ?? MobileEnv.ANALYTICS_PROVIDER;

    if (__DEV__) {
      console.log('[Analytics] Initialized', { enabled: this.enabled, provider: this.provider });
    }

    if (!this.enabled) {
      return;
    }

    const mixpanelToken = config?.mixpanelToken ?? MobileEnv.MIXPANEL_TOKEN;
    const amplitudeApiKey = config?.amplitudeApiKey ?? MobileEnv.AMPLITUDE_API_KEY;

    if (this.shouldUseMixpanel()) {
      if (!mixpanelToken) {
        console.warn('[Analytics] Mixpanel token missing; Mixpanel disabled.');
      } else {
        this.mixpanel = new Mixpanel(mixpanelToken, true);
        void this.mixpanel.init();
      }
    }

    if (this.shouldUseAmplitude()) {
      if (!amplitudeApiKey) {
        console.warn('[Analytics] Amplitude API key missing; Amplitude disabled.');
      } else {
        this.amplitude.init(amplitudeApiKey, this.userId ?? undefined);
      }
    }

    this.initialized = true;
  }

  /**
   * Identify the current user
   */
  identify(userId: string, properties?: UserProperties): void {
    if (!this.enabled) return;
    if (!this.ensureInitialized()) return;

    this.userId = userId;
    this.userProperties = { ...this.userProperties, ...properties };

    if (__DEV__) {
      console.log('[Analytics] Identify', { userId, properties });
    }

    const sanitized = this.sanitizeProperties(properties);

    if (this.shouldUseMixpanel() && this.mixpanel) {
      this.mixpanel.identify(userId);
      if (Object.keys(sanitized).length > 0) {
        this.mixpanel.getPeople().set(sanitized);
      }
    }

    if (this.shouldUseAmplitude()) {
      this.amplitude.setUserId(userId);
      if (Object.keys(sanitized).length > 0) {
        const identify = new Identify();
        Object.entries(sanitized).forEach(([key, value]) => {
          identify.set(key, value);
        });
        this.amplitude.identify(identify);
      }
    }
  }

  /**
   * Track an event
   */
  track(eventName: string, properties?: Record<string, any>): void {
    if (!this.enabled) return;
    if (!this.ensureInitialized()) return;

    const sanitizedProperties = this.sanitizeProperties(properties);
    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        ...sanitizedProperties,
        userId: this.userId,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    if (__DEV__) {
      console.log('[Analytics] Track', event);
    }

    if (this.shouldUseMixpanel() && this.mixpanel) {
      this.mixpanel.track(eventName, event.properties);
    }

    if (this.shouldUseAmplitude()) {
      this.amplitude.track(eventName, event.properties);
    }
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
    if (!this.ensureInitialized()) return;

    this.userProperties = { ...this.userProperties, ...properties };

    if (__DEV__) {
      console.log('[Analytics] Set user properties', properties);
    }

    const sanitized = this.sanitizeProperties(properties);

    if (this.shouldUseMixpanel() && this.mixpanel) {
      this.mixpanel.getPeople().set(sanitized);
    }

    if (this.shouldUseAmplitude()) {
      const identify = new Identify();
      Object.entries(sanitized).forEach(([key, value]) => {
        identify.set(key, value);
      });
      this.amplitude.identify(identify);
    }
  }

  /**
   * Increment a user property
   */
  incrementProperty(property: string, value: number = 1): void {
    if (!this.enabled) return;
    if (!this.ensureInitialized()) return;

    if (__DEV__) {
      console.log('[Analytics] Increment', { property, value });
    }

    if (this.shouldUseMixpanel() && this.mixpanel) {
      this.mixpanel.getPeople().increment(property, value);
    }

    if (this.shouldUseAmplitude()) {
      const identify = new Identify();
      identify.add(property, value);
      this.amplitude.identify(identify);
    }
  }

  /**
   * Reset analytics (on logout)
   */
  reset(): void {
    if (!this.enabled) return;
    if (!this.ensureInitialized()) return;

    this.userId = null;
    this.userProperties = {};

    if (__DEV__) {
      console.log('[Analytics] Reset');
    }

    if (this.shouldUseMixpanel() && this.mixpanel) {
      this.mixpanel.reset();
    }

    if (this.shouldUseAmplitude()) {
      this.amplitude.reset();
    }
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (__DEV__) {
      console.log('[Analytics] Set enabled', enabled);
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

  // Features
  MANUAL_FORGE_OPENED: 'manual_forge_opened',
  MANUAL_FORGE_COMPLETED: 'manual_forge_completed',
  MANTRA_AUDIO_PLAYED: 'mantra_audio_played',

  // Navigation
  VAULT_VIEWED: 'vault_viewed',
  DISCOVER_VIEWED: 'discover_viewed',
  SHOP_VIEWED: 'shop_viewed',
  PROFILE_VIEWED: 'profile_viewed',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',
} as const;
