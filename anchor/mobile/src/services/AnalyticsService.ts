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
  // Trial / conversion funnel (no-card trial is tracked here since RevenueCat
  // only sees store entitlements, not the account-bound trial).
  trial_started_at?: string;
  trial_expired?: boolean;
  trial_days_remaining?: number;
  is_comped?: boolean;
  converted?: boolean;
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
  'destination',
  'destinationtext',
  'destination_text',
  'waypointtitle',
  'waypoint_title',
  'waypointdescription',
  'waypoint_description',
  'reflection',
  'reflectiontext',
  'reflection_text',
  'whathelped',
  'what_helped',
  'whatlearned',
  'what_learned',
  'anchortext',
  'anchor_text',
  'anchorsnapshot',
  'anchor_snapshot',
  'scene',
  'scene_text',
  'scenesnapshot',
  'scene_snapshot',
  'nextaction',
  'next_action',
  'text',
  'text_content',
  'content_text',
  'mantra',
  'prompt',
  'ai_prompt',
  'generated_prompt',
  'providerprompt',
  'provider_prompt',
  'rawoutput',
  'raw_output',
  'modeloutput',
  'model_output',
  'notes',
  'message',
  'navigationparams',
  'navigation_params',
  'params',
  'error',
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

  try {
    return sanitizeAnalyticsValue(properties) as Record<string, any>;
  } catch {
    // Analytics is optional; an unexpected value must not become a privacy
    // bypass. Sending no properties is safer than attempting recovery.
    return {};
  }
};

class Analytics {
  private enabled: boolean = true;
  private userId: string | null = null;
  private userProperties: UserProperties = {};
  private posthog: any = null;
  private initialized = false;
  private posthogApiKey = '';
  private posthogHost = DEFAULT_POSTHOG_HOST;

  private canSendToPostHog(): boolean {
    return this.enabled && this.posthog != null;
  }

  private readConfig(config?: AnalyticsConfig): void {
    this.posthogApiKey =
      config?.posthogApiKey ?? readPublicEnv(process.env.EXPO_PUBLIC_POSTHOG_API_KEY);
    const posthogHost =
      config?.posthogHost ?? readPublicEnv(process.env.EXPO_PUBLIC_POSTHOG_HOST);
    this.posthogHost = posthogHost || DEFAULT_POSTHOG_HOST;
  }

  private ensurePostHogClient(): boolean {
    if (this.posthog) {
      return true;
    }

    if (!this.posthogApiKey) {
      return false;
    }

    this.posthog = new PostHog(this.posthogApiKey, {
      host: this.posthogHost,
      disabled: !this.enabled,
      disableGeoip: true,
      enableSessionReplay: false,
      captureAppLifecycleEvents: true,
    });

    return true;
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
    this.readConfig(config);

    logger.info('[Analytics] Initialized', { enabled: this.enabled });

    if (this.initialized) {
      if (this.enabled && !this.ensurePostHogClient()) {
        logger.warn('[Analytics] PostHog missing API key');
        return;
      }

      try {
        this.posthog?.[this.enabled ? 'optIn' : 'optOut']?.();
      } catch (error) {
        logger.warn('[Analytics] PostHog opt state update failed', error);
      }
      return;
    }

    this.initialized = true;

    if (!this.enabled) {
      logger.warn('[Analytics] PostHog disabled');
      return;
    }

    if (!this.ensurePostHogClient()) {
      logger.warn('[Analytics] PostHog missing API key');
      return;
    }
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
   * Track lifecycle telemetry without attaching the identified user field.
   * Splash/startup events must remain free of personal information.
   */
  trackAnonymous(eventName: string, properties?: Record<string, any>): void {
    if (!this.enabled) return;

    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        app_version: appVersion,
        platform: Platform.OS,
        ...sanitizeAnalyticsProperties(properties),
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    logger.info('[Analytics] Track anonymous', event);

    this.safelyCallPostHog('capture anonymous', () => {
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

    if (enabled && !this.initialized) {
      this.initialize({ enabled });
      return;
    }

    if (enabled && !this.ensurePostHogClient()) {
      logger.warn('[Analytics] PostHog missing API key');
      return;
    }

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
  // Chart funnel. Properties must be the safe enums/counts documented in the
  // Chart contract; never attach user-authored Course or reflection text.
  CHART_TAB_VIEWED: 'chart_tab_viewed',
  COURSE_SETUP_STARTED: 'course_setup_started',
  MANUAL_COURSE_CREATED: 'manual_course_created',
  COURSE_VIEWED: 'course_viewed',
  WAYPOINT_VIEWED: 'waypoint_viewed',
  WAYPOINT_ANCHOR_ACTION_SELECTED: 'waypoint_anchor_action_selected',
  CHART_PRACTICE_STARTED: 'chart_practice_started',
  CHART_PRACTICE_COMPLETED: 'chart_practice_completed',
  POST_PRACTICE_REFLECTION_OPENED: 'post_practice_reflection_opened',
  REFLECTION_SAVED: 'reflection_saved',
  COURSE_LOG_VIEWED: 'course_log_viewed',
  WAYPOINT_COMPLETION_STARTED: 'waypoint_completion_started',
  WAYPOINT_COMPLETED: 'waypoint_completed',
  COURSE_COMPLETED: 'course_completed',
  CHART_PLANNER_GENERATION_REQUESTED: 'chart_planner_generation_requested',
  CHART_PLANNER_GENERATION_SUCCEEDED: 'chart_planner_generation_succeeded',
  CHART_PLANNER_FALLBACK_USED: 'chart_planner_fallback_used',
  CHART_PLANNER_GENERATION_DENIED: 'chart_planner_generation_denied',
  CHART_PLANNER_PROPOSAL_VIEWED: 'chart_planner_proposal_viewed',
  CHART_PLANNER_PROPOSAL_ACCEPTED: 'chart_planner_proposal_accepted',
  CHART_PLANNER_PROPOSAL_DISMISSED: 'chart_planner_proposal_dismissed',
  CHART_PLANNER_QUOTA_REACHED: 'chart_planner_quota_reached',
  CHART_UNAVAILABLE_VIEWED: 'chart_unavailable_viewed',
  // App lifecycle
  APP_OPENED: 'app_opened',
  APP_BACKGROUNDED: 'app_backgrounded',
  SPLASH_STARTED: 'splash_started',
  SPLASH_COMPLETED: 'splash_completed',
  SPLASH_SKIPPED_REDUCE_MOTION: 'splash_skipped_reduce_motion',
  SPLASH_STARTUP_WAITED: 'splash_startup_waited',

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

  // Trial lifecycle (no-card trial — funnel measured here, not via RevenueCat)
  TRIAL_STARTED: 'trial_started',
  TRIAL_EXPIRED: 'trial_expired',
  TRIAL_CONVERTED: 'trial_converted',
  TRIAL_BANNER_VIEWED: 'trial_banner_viewed',
  TRIAL_BANNER_TAPPED: 'trial_banner_tapped',

  // Features
  MANUAL_FORGE_OPENED: 'manual_forge_opened',
  MANUAL_FORGE_COMPLETED: 'manual_forge_completed',
  MANTRA_AUDIO_PLAYED: 'mantra_audio_played',
  SESSION_AUDIO_DEFAULT_CHANGED: 'session_audio_default_changed',
  SESSION_AUDIO_OVERRIDE_OPENED: 'session_audio_override_opened',
  SESSION_AUDIO_OVERRIDE_APPLIED: 'session_audio_override_applied',
  VOICE_PREVIEW_STARTED: 'voice_preview_started',
  VOICE_PREVIEW_COMPLETED: 'voice_preview_completed',
  VOICE_PREVIEW_FAILED: 'voice_preview_failed',
  SESSION_STARTED: 'session_started',
  GUIDED_AUDIO_LOAD_FAILED: 'guided_audio_load_failed',
  AMBIENT_AUDIO_LOAD_FAILED: 'ambient_audio_load_failed',
  SESSION_AUDIO_FALLBACK_USED: 'session_audio_fallback_used',
  VISUALIZE_CARD_VIEWED: 'visualize_card_viewed',
  VISUALIZE_SELECTED: 'visualize_selected',
  VISUALIZE_PRO_LOCK_VIEWED: 'visualize_pro_lock_viewed',
  VISUALIZE_TRIAL_CTA_SELECTED: 'visualize_trial_cta_selected',
  VISUALIZE_PREPARATION_VIEWED: 'visualize_preparation_viewed',
  VISUALIZE_SCENE_GENERATION_REQUESTED: 'visualize_scene_generation_requested',
  VISUALIZE_SCENE_GENERATED: 'visualize_scene_generated',
  VISUALIZE_SCENE_GENERATION_FAILED: 'visualize_scene_generation_failed',
  VISUALIZE_SCENE_FALLBACK_USED: 'visualize_scene_fallback_used',
  VISUALIZE_SCENE_BATCH_CACHED: 'visualize_scene_batch_cached',
  VISUALIZE_SCENE_ROTATED: 'visualize_scene_rotated',
  VISUALIZE_SCENE_RESTORED: 'visualize_scene_restored',
  VISUALIZE_SCENE_EDITED: 'visualize_scene_edited',
  VISUALIZE_SUGGESTION_REQUESTED: 'visualize_suggestion_requested',
  VISUALIZE_ORIGINAL_RESTORED: 'visualize_original_restored',
  PRACTICE_TEMPORARY_SETTINGS_CHANGED: 'practice_temporary_settings_changed',
  PRACTICE_SESSION_STARTED: 'practice_session_started',
  PRACTICE_SESSION_PAUSED: 'practice_session_paused',
  PRACTICE_SESSION_RESUMED: 'practice_session_resumed',
  PRACTICE_SESSION_ENDED_EARLY: 'practice_session_ended_early',
  PRACTICE_PHASE_REACHED: 'practice_phase_reached',
  PRACTICE_SESSION_COMPLETED: 'practice_session_completed',
  PRACTICE_MODE_SELECTED: 'practice_mode_selected',
  PRACTICE_CURRENT_ANCHOR_CHANGED: 'practice_current_anchor_changed',
  THREAD_STRENGTH_OPENED: 'thread_strength_opened',
  PRACTICE_DATA_MIGRATION_COMPLETED: 'practice_data_migration_completed',
  PRACTICE_DATA_MIGRATION_FAILED: 'practice_data_migration_failed',
  PRACTICE_SYNC_FAILED: 'practice_sync_failed',
  PRACTICE_DUPLICATE_PREVENTED: 'practice_duplicate_prevented',
  VISUALIZE_NEXT_ACTION_SAVED: 'visualize_next_action_saved',
  VISUALIZE_PRACTICE_AGAIN_SELECTED: 'visualize_practice_again_selected',
  VISUALIZE_RETURN_TO_SANCTUARY_SELECTED: 'visualize_return_to_sanctuary_selected',

  // Navigation
  VAULT_VIEWED: 'vault_viewed',
  DISCOVER_VIEWED: 'discover_viewed',
  SHOP_VIEWED: 'shop_viewed',
  PROFILE_VIEWED: 'profile_viewed',

  // Notifications
  NOTIFICATION_PERMISSION_PROMPT_SHOWN: 'notification_permission_prompt_shown',
  NOTIFICATION_PERMISSION_GRANTED: 'notification_permission_granted',
  NOTIFICATION_PERMISSION_DENIED: 'notification_permission_denied',
  NOTIFICATION_SCHEDULED: 'notification_scheduled',
  NOTIFICATION_SENT: 'notification_sent',
  NOTIFICATION_OPENED: 'notification_opened',
  NOTIFICATION_ACTION_COMPLETED: 'notification_action_completed',

  // Daily Prime reminder prompt (post first-anchor / fallback moment)
  NOTIFICATION_PROMPT_CARD_VIEWED: 'notification_prompt_card_viewed',
  NOTIFICATION_SET_DAILY_REMINDER_TAPPED: 'notification_set_daily_reminder_tapped',
  NOTIFICATION_NOT_NOW_TAPPED: 'notification_not_now_tapped',
  DAILY_PRIME_REMINDER_SCHEDULED: 'daily_prime_reminder_scheduled',
  DAILY_PRIME_REMINDER_DISABLED: 'daily_prime_reminder_disabled',
  DAILY_PRIME_REMINDER_TIME_CHANGED: 'daily_prime_reminder_time_changed',

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
