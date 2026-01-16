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
class Analytics {
  private enabled: boolean = true;
  private userId: string | null = null;
  private userProperties: UserProperties = {};

  /**
   * Initialize analytics
   */
  initialize(config?: { enabled?: boolean }): void {
    this.enabled = config?.enabled ?? true;

    if (__DEV__) {
      console.log('[Analytics] Initialized', { enabled: this.enabled });
    }

    // TODO: Initialize your analytics provider here
    // Example: Mixpanel.init('YOUR_TOKEN');
    // Example: amplitude.getInstance().init('YOUR_API_KEY');
  }

  /**
   * Identify the current user
   */
  identify(userId: string, properties?: UserProperties): void {
    if (!this.enabled) return;

    this.userId = userId;
    this.userProperties = { ...this.userProperties, ...properties };

    if (__DEV__) {
      console.log('[Analytics] Identify', { userId, properties });
    }

    // TODO: Identify user in your analytics provider
    // Example: Mixpanel.identify(userId);
    // Example: Mixpanel.getPeople().set(properties);
  }

  /**
   * Track an event
   */
  track(eventName: string, properties?: Record<string, any>): void {
    if (!this.enabled) return;

    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        ...properties,
        userId: this.userId,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    if (__DEV__) {
      console.log('[Analytics] Track', event);
    }

    // TODO: Track event in your analytics provider
    // Example: Mixpanel.track(eventName, properties);
    // Example: amplitude.getInstance().logEvent(eventName, properties);
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

    if (__DEV__) {
      console.log('[Analytics] Set user properties', properties);
    }

    // TODO: Set user properties in your analytics provider
    // Example: Mixpanel.getPeople().set(properties);
  }

  /**
   * Increment a user property
   */
  incrementProperty(property: string, value: number = 1): void {
    if (!this.enabled) return;

    if (__DEV__) {
      console.log('[Analytics] Increment', { property, value });
    }

    // TODO: Increment property in your analytics provider
    // Example: Mixpanel.getPeople().increment(property, value);
  }

  /**
   * Reset analytics (on logout)
   */
  reset(): void {
    if (!this.enabled) return;

    this.userId = null;
    this.userProperties = {};

    if (__DEV__) {
      console.log('[Analytics] Reset');
    }

    // TODO: Reset in your analytics provider
    // Example: Mixpanel.reset();
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
  ANCHOR_CHARGED: 'anchor_charged',
  ANCHOR_ACTIVATED: 'anchor_activated',
  ANCHOR_DELETED: 'anchor_deleted',
  ANCHOR_BURNED: 'anchor_burned',

  // Rituals
  QUICK_CHARGE_STARTED: 'quick_charge_started',
  QUICK_CHARGE_COMPLETED: 'quick_charge_completed',
  DEEP_CHARGE_STARTED: 'deep_charge_started',
  DEEP_CHARGE_COMPLETED: 'deep_charge_completed',
  ACTIVATION_RITUAL_STARTED: 'activation_ritual_started',
  ACTIVATION_RITUAL_COMPLETED: 'activation_ritual_completed',

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
