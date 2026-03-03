/**
 * Anchor App - Analytics Service (PostHog)
 *
 * Wraps posthog-react-native as a singleton so the rest of the codebase
 * continues calling AnalyticsService.track / .identify / .screen without
 * knowing about the underlying provider.
 */

import PostHog from 'posthog-react-native';

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

class Analytics {
  private client: PostHog | null = null;
  private enabled: boolean = false;

  /**
   * Call once at app startup (in App.tsx useEffect).
   */
  initialize(config: { apiKey: string; host: string; enabled: boolean }): void {
    this.enabled = config.enabled && Boolean(config.apiKey);

    if (!this.enabled) {
      if (__DEV__) {
        console.log('[Analytics] Disabled — set EXPO_PUBLIC_POSTHOG_API_KEY to enable.');
      }
      return;
    }

    this.client = new PostHog(config.apiKey, {
      host: config.host,
      // Flush immediately in dev so events show up in PostHog Live Events right away.
      flushAt: __DEV__ ? 1 : 20,
      flushInterval: __DEV__ ? 0 : 10000,
    });

    if (__DEV__) {
      console.log('[Analytics] PostHog initialized', { host: config.host });
    }
  }

  /**
   * Call after the user signs in or when auth state is resolved.
   */
  identify(userId: string, properties?: UserProperties): void {
    if (!this.client) return;

    this.client.identify(userId, {
      email: properties?.email,
      name: properties?.displayName,
      subscriptionStatus: properties?.subscriptionStatus,
      totalAnchorsCreated: properties?.totalAnchorsCreated,
      currentStreak: properties?.currentStreak,
    });

    if (__DEV__) {
      console.log('[Analytics] identify', { userId, properties });
    }
  }

  /**
   * Track a named event with optional properties.
   */
  track(eventName: string, properties?: Record<string, any>): void {
    if (!this.client) return;

    this.client.capture(eventName, properties);

    if (__DEV__) {
      console.log('[Analytics] track', eventName, properties);
    }
  }

  /**
   * Track a screen view. Recorded as a '$screen' event in PostHog.
   */
  screen(screenName: string, properties?: Record<string, any>): void {
    if (!this.client) return;

    this.client.screen(screenName, properties);

    if (__DEV__) {
      console.log('[Analytics] screen', screenName, properties);
    }
  }

  /**
   * Update persistent user properties without sending an event.
   */
  setUserProperties(properties: UserProperties): void {
    if (!this.client) return;

    // PostHog persists person properties via $set on the next capture call.
    this.client.capture('$set', {
      $set: {
        subscriptionStatus: properties.subscriptionStatus,
        totalAnchorsCreated: properties.totalAnchorsCreated,
        currentStreak: properties.currentStreak,
      },
    });

    if (__DEV__) {
      console.log('[Analytics] setUserProperties', properties);
    }
  }

  /**
   * Increment a numeric user property.
   */
  incrementProperty(property: string, value: number = 1): void {
    if (!this.client) return;

    this.client.capture('$set', { $add: { [property]: value } });

    if (__DEV__) {
      console.log('[Analytics] incrementProperty', { property, value });
    }
  }

  /**
   * Call on sign-out to disassociate future events from the current user.
   */
  reset(): void {
    if (!this.client) return;

    this.client.reset();

    if (__DEV__) {
      console.log('[Analytics] reset');
    }
  }

  /**
   * Flush queued events immediately (useful before the app backgrounds).
   */
  async flush(): Promise<void> {
    if (!this.client) return;
    await this.client.flush();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.client) {
      this.client.flush();
      this.client = null;
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
} as const;
