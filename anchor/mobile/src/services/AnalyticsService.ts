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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';
import { logger } from '@/utils/logger';

interface AnalyticsConfig {
  enabled?: boolean;
  posthogApiKey?: string;
  posthogHost?: string;
}

export type AnalyticsExperienceVersion = '1.5' | '2.0';
export type AnalyticsEnvironment = 'development' | 'staging' | 'production';
export type AnalyticsSubscriptionTier = 'free' | 'trial' | 'pro';
export type AnalyticsAccountState = 'anonymous' | 'guest_with_anchor' | 'authenticated';

export interface SharedAnalyticsContext {
  experience_version?: AnalyticsExperienceVersion;
  environment?: AnalyticsEnvironment;
  subscription_tier?: AnalyticsSubscriptionTier;
  account_state?: AnalyticsAccountState;
}

type QueuedAnalyticsCall =
  | { type: 'identify'; userId: string; properties?: Record<string, any> }
  | { type: 'capture'; eventName: string; properties: Record<string, any>; anonymous?: boolean }
  | { type: 'setUserProperties'; properties?: Record<string, any> }
  | { type: 'reset'; forceReset?: boolean };

const MAX_PENDING_QUEUE_SIZE = 100;
const PERSISTED_IDENTIFIED_USER_ID_KEY = '@anchor_analytics_identified_user_id';
const PERSISTED_FIRST_ANCHOR_CREATED_KEY = '@anchor_analytics_first_anchor_created';
const PERSISTED_FIRST_ANCHOR_ACCOUNTS_KEY = '@anchor_analytics_first_anchor_accounts';

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';
const SENSITIVE_PROPERTY_KEYS = new Set([
  'email',
  'displayname',
  'display_name',
  'name',
  'phone',
  'intention',
  'intentiontext',
  'intention_text',
  'distilledletters',
  'distilled_letters',
  'scene',
  'scene_text',
  'scenesnapshot',
  'scene_snapshot',
  'nextaction',
  'next_action',
  'text',
  'text_content',
  'content_text',
  'user_text',
  'goal_text',
  'custom_goal',
  'vision_text',
  'caption',
  'description',
  'notes',
  'transcript',
  'chat_message',
  'message_text',
  'journal_entry',
  'reflection_text',
  'mantra',
  'mantratext',
  'mantra_text',
  'prompt',
  'visualprompt',
  'visual_prompt',
  'reinforcement_prompt',
  'ai_prompt',
  'generated_prompt',
  'message',
  'error_message',
  'image',
  'image_url',
  'image_base64',
  'enhancedimageurl',
  'enhanced_image_url',
  'photo',
  'photo_uri',
  'artwork',
  'svg',
  'svgdata',
  'svg_data',
  'basesigilsvg',
  'base_sigil_svg',
  'base64',
  'uri',
  'token',
  'idtoken',
  'id_token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'password',
]);

const readPublicEnv = (value: string | undefined): string => value?.trim() ?? '';

const appVersion = Constants.expoConfig?.version ?? '2.0.0';

const resolveDefaultEnvironment = (): AnalyticsEnvironment => {
  const envName = readPublicEnv(
    process.env.EXPO_PUBLIC_APP_ENV ?? process.env.EXPO_PUBLIC_ENV ?? process.env.NODE_ENV
  ).toLowerCase();
  if (envName === 'production' || envName === 'prod') return 'production';
  if (envName === 'staging' || envName === 'preview') return 'staging';
  return 'development';
};

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

const CANONICAL_EVENT_ALIASES: Record<
  string,
  | string
  | ((properties: Record<string, any>) => {
      eventName: string;
      properties?: Record<string, any>;
    } | null)
> = {
  auth_guest_chosen: 'account_save_skipped',
  auth_succeeded: (props) =>
    props?.mode === 'create'
      ? {
          eventName: 'account_created',
          properties: {
            ...props,
            from_guest_skip: props.context === 'save_progress' || Boolean(props.from_guest_skip),
          },
        }
      : null,
  v2_creation_ai_started: 'anchor_generation_started',
  v2_creation_ai_completed: (props) => ({
    eventName: 'anchor_generation_completed',
    properties: {
      ...props,
      received_two_variations:
        typeof props?.variation_count === 'number' ? props.variation_count >= 2 : true,
    },
  }),
  v2_creation_ai_failed: 'anchor_generation_failed',
  v2_creation_variation_selected: 'anchor_selected',
  practice_session_started: (props) => ({
    eventName: 'practice_started',
    properties: {
      ...props,
      practice_mode: props?.practice_mode ?? props?.mode,
      planned_duration_ms:
        props?.planned_duration_ms ??
        (typeof props?.duration_seconds === 'number' ? props.duration_seconds * 1000 : undefined),
    },
  }),
  practice_session_completed: (props) => ({
    eventName: 'practice_completed',
    properties: {
      ...props,
      practice_mode: props?.practice_mode ?? props?.mode,
      planned_duration_ms:
        props?.planned_duration_ms ??
        (typeof props?.planned_duration_seconds === 'number'
          ? props.planned_duration_seconds * 1000
          : typeof props?.duration_seconds === 'number'
            ? props.duration_seconds * 1000
            : undefined),
      actual_duration_ms:
        props?.actual_duration_ms ??
        (typeof props?.duration_seconds === 'number' ? props.duration_seconds * 1000 : undefined),
      completion_status: props?.completion_status ?? 'completed',
    },
  }),
  practice_session_ended_early: (props) => ({
    eventName: 'practice_abandoned',
    properties: {
      ...props,
      practice_mode: props?.practice_mode ?? props?.mode,
      planned_duration_ms:
        props?.planned_duration_ms ??
        (typeof props?.planned_duration_seconds === 'number'
          ? props.planned_duration_seconds * 1000
          : undefined),
      actual_duration_ms:
        props?.actual_duration_ms ??
        (typeof props?.elapsed_seconds === 'number'
          ? props.elapsed_seconds * 1000
          : typeof props?.duration_seconds === 'number'
            ? props.duration_seconds * 1000
            : undefined),
      completion_status: 'abandoned',
      exit_reason: props?.exit_reason ?? props?.reason ?? 'user_exit',
    },
  }),
  vision_image_generation_started: 'vision_generation_started',
  vision_image_generation_completed: 'vision_generation_completed',
  vision_image_generation_failed: 'vision_generation_failed',
  chart_ask_plan_requested: 'chart_planning_started',
  chart_generation_succeeded: 'chart_generated',
  chart_created: 'chart_approved',
  chart_route_adjusted: 'chart_adjustment_requested',
  chart_move_completed: 'one_move_completed',
  chart_waypoint_completed: 'waypoint_reached',
  paywall_step2_viewed: (props) => ({
    eventName: 'paywall_page_viewed',
    properties: { ...props, paywall_page: 2, entry_point: props?.context ?? props?.source },
  }),
  paywall_restore_tapped: (props) => ({
    eventName: 'restore_attempted',
    properties: { ...props, outcome: props?.outcome ?? 'started' },
  }),
  teaching_beat_shown: (props) => ({
    eventName: 'teaching_shown',
    properties: { ...props, teaching_id: props?.teaching_id ?? props?.beat },
  }),
  teaching_beat_dismissed: (props) => ({
    eventName: 'teaching_dismissed',
    properties: { ...props, teaching_id: props?.teaching_id ?? props?.beat },
  }),
  teaching_beat_advanced: (props) => ({
    eventName: 'teaching_action_taken',
    properties: {
      ...props,
      teaching_id: props?.teaching_id ?? props?.beat,
      action: props?.reason ?? 'advance',
    },
  }),
  personal_reminder_enabled: (props) => ({
    eventName: 'reminder_enabled',
    properties: { ...props, reminder_type: 'personal_daily' },
  }),
  notification_permission_granted: (props) => ({
    eventName: 'notification_permission_result',
    properties: { ...props, result: 'granted' },
  }),
  notification_permission_denied: (props) => ({
    eventName: 'notification_permission_result',
    properties: { ...props, result: 'denied' },
  }),
  anchor_export_saved: (props) => ({
    eventName: 'share_exported',
    properties: { ...props, export_action: 'save' },
  }),
  anchor_export_shared: (props) => ({
    eventName: 'share_exported',
    properties: { ...props, export_action: 'share' },
  }),
};

class Analytics {
  private enabled: boolean = true;
  private userId: string | null = null;
  private persistedIdentifiedUserId: string | null = null;
  private userProperties: UserProperties = {};
  private posthog: any = null;
  private initialized = false;
  private posthogApiKey = '';
  private posthogHost = DEFAULT_POSTHOG_HOST;
  private pendingQueue: QueuedAnalyticsCall[] = [];
  private contextProvider: (() => SharedAnalyticsContext) | null = null;
  private distinctIdListeners = new Set<(distinctId: string | null) => void>();
  private firstAnchorCreatedRecorded = false;
  private firstAnchorRecordedAccounts = new Set<string>();
  private recentCanonicalSignatures = new Map<string, number>();

  constructor() {
    this.hydratePersistedMarkers();
  }

  private hydratePersistedMarkers(): void {
    try {
      void AsyncStorage.getItem(PERSISTED_IDENTIFIED_USER_ID_KEY)
        .then((storedUserId) => {
          if (storedUserId && !this.persistedIdentifiedUserId) {
            this.persistedIdentifiedUserId = storedUserId;
          }
        })
        .catch(() => undefined);
      void AsyncStorage.getItem(PERSISTED_FIRST_ANCHOR_CREATED_KEY)
        .then((storedFlag) => {
          if (storedFlag === '1') {
            this.firstAnchorCreatedRecorded = true;
          }
        })
        .catch(() => undefined);
      void AsyncStorage.getItem(PERSISTED_FIRST_ANCHOR_ACCOUNTS_KEY)
        .then((storedAccountsJson) => {
          if (!storedAccountsJson) return;
          const parsed = JSON.parse(storedAccountsJson);
          if (Array.isArray(parsed)) {
            for (const id of parsed) {
              if (typeof id === 'string' && id.trim().length > 0) {
                this.firstAnchorRecordedAccounts.add(id.trim());
              }
            }
          }
        })
        .catch(() => undefined);
    } catch {
      // Non-blocking storage read
    }
  }

  private persistIdentifiedUserId(userId: string | null): void {
    this.persistedIdentifiedUserId = userId;
    try {
      if (userId) {
        void AsyncStorage.setItem(PERSISTED_IDENTIFIED_USER_ID_KEY, userId).catch(() => undefined);
      } else {
        void AsyncStorage.removeItem(PERSISTED_IDENTIFIED_USER_ID_KEY).catch(() => undefined);
      }
    } catch {
      // Non-blocking storage write
    }
  }

  private persistFirstAnchorRecorded(recorded: boolean, accountId?: string | null): void {
    this.firstAnchorCreatedRecorded = recorded;
    const targetAccount = accountId ?? this.userId ?? this.persistedIdentifiedUserId;
    if (recorded && targetAccount) {
      this.firstAnchorRecordedAccounts.add(targetAccount);
    }
    try {
      if (recorded) {
        void AsyncStorage.setItem(PERSISTED_FIRST_ANCHOR_CREATED_KEY, '1').catch(() => undefined);
      } else {
        void AsyncStorage.removeItem(PERSISTED_FIRST_ANCHOR_CREATED_KEY).catch(() => undefined);
      }
      if (this.firstAnchorRecordedAccounts.size > 0) {
        void AsyncStorage.setItem(
          PERSISTED_FIRST_ANCHOR_ACCOUNTS_KEY,
          JSON.stringify(Array.from(this.firstAnchorRecordedAccounts))
        ).catch(() => undefined);
      }
    } catch {
      // Non-blocking storage write
    }
  }

  private hasAccountRecordedFirstAnchor(accountId?: string | null): boolean {
    const targetAccount = accountId ?? this.userId ?? this.persistedIdentifiedUserId;
    if (targetAccount && this.firstAnchorRecordedAccounts.has(targetAccount)) {
      return true;
    }
    return this.firstAnchorCreatedRecorded;
  }

  /**
   * Subscribe to PostHog distinctId / identity changes so RevenueCat ($posthogUserId)
   * stays synchronized across cold start, anonymous browsing, sign-in, and logout.
   */
  onDistinctIdChange(listener: (distinctId: string | null) => void): () => void {
    this.distinctIdListeners.add(listener);
    return () => {
      this.distinctIdListeners.delete(listener);
    };
  }

  private notifyDistinctIdListeners(): void {
    const distinctId = this.getDistinctId();
    for (const listener of this.distinctIdListeners) {
      try {
        listener(distinctId);
      } catch {
        // Never block analytics on listener errors
      }
    }
  }

  private canSendToPostHog(): boolean {
    return this.enabled && this.initialized && this.posthog != null;
  }

  /**
   * Register a dynamic provider for shared Anchor 2.0 event context
   * (experience_version, subscription_tier, account_state, environment).
   */
  setContextProvider(provider: (() => SharedAnalyticsContext) | null): void {
    this.contextProvider = provider;
  }

  private getSharedContext(): Required<Pick<SharedAnalyticsContext, 'experience_version' | 'environment'>> &
    SharedAnalyticsContext & { is_sandbox: boolean } {
    let dynamicContext: SharedAnalyticsContext = {};
    if (this.contextProvider) {
      try {
        dynamicContext = this.contextProvider() ?? {};
      } catch {
        dynamicContext = {};
      }
    }

    const environment = dynamicContext.environment ?? resolveDefaultEnvironment();
    return {
      experience_version: dynamicContext.experience_version ?? '2.0',
      environment,
      is_sandbox: typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : environment !== 'production',
      ...(dynamicContext.subscription_tier
        ? { subscription_tier: dynamicContext.subscription_tier }
        : {}),
      account_state:
        dynamicContext.account_state ?? (this.userId ? 'authenticated' : 'anonymous'),
    };
  }

  private enqueue(call: QueuedAnalyticsCall): void {
    if (!this.enabled || this.initialized) return;
    if (this.pendingQueue.length >= MAX_PENDING_QUEUE_SIZE) {
      this.pendingQueue.shift();
    }
    this.pendingQueue.push(call);
  }

  private flushPendingQueue(): void {
    if (!this.canSendToPostHog() || this.pendingQueue.length === 0) {
      return;
    }

    const queued = this.pendingQueue.splice(0, this.pendingQueue.length);
    for (const item of queued) {
      if (item.type === 'reset') {
        this.safelyCallPostHog('reset (queued)', () => {
          this.posthog.reset();
        });
        this.notifyDistinctIdListeners();
      } else if (item.type === 'identify') {
        this.safelyCallPostHog('identify (queued)', () => {
          this.posthog.identify(item.userId, item.properties);
        });
        this.notifyDistinctIdListeners();
      } else if (item.type === 'setUserProperties' && this.userId) {
        this.safelyCallPostHog('set user properties (queued)', () => {
          this.posthog.identify(this.userId, item.properties);
        });
      } else if (item.type === 'capture') {
        if (item.anonymous) {
          this.safelyCallPostHog('capture anonymous (queued)', () => {
            this.posthog.capture(item.eventName, item.properties);
          });
        } else {
          const enrichedProps =
            this.userId && item.properties.userId == null
              ? {
                  ...item.properties,
                  userId: this.userId,
                  account_state:
                    item.properties.account_state === 'anonymous'
                      ? 'authenticated'
                      : item.properties.account_state,
                }
              : item.properties;
          this.captureWithCanonicalAliases(item.eventName, enrichedProps);
        }
      }
    }
  }

  private shouldEmitCanonicalEvent(eventName: string): boolean {
    const now = Date.now();
    const lastTimestamp = this.recentCanonicalSignatures.get(eventName);
    if (lastTimestamp !== undefined && now - lastTimestamp < 25) {
      return false;
    }
    this.recentCanonicalSignatures.set(eventName, now);
    if (this.recentCanonicalSignatures.size > 50) {
      const oldestKey = this.recentCanonicalSignatures.keys().next().value;
      if (oldestKey) this.recentCanonicalSignatures.delete(oldestKey);
    }
    return true;
  }

  private captureWithCanonicalAliases(
    eventName: string,
    eventProperties: Record<string, any>
  ): void {
    if (CANONICAL_DEDUPED_EVENTS.has(eventName)) {
      if (!this.shouldEmitCanonicalEvent(eventName)) {
        return;
      }
    }

    this.safelyCallPostHog('capture', () => {
      this.posthog.capture(eventName, eventProperties);
    });

    const aliasRule = CANONICAL_EVENT_ALIASES[eventName];
    if (!aliasRule) return;

    const resolved =
      typeof aliasRule === 'string'
        ? { eventName: aliasRule, properties: eventProperties }
        : aliasRule(eventProperties);

    if (!resolved || !this.shouldEmitCanonicalEvent(resolved.eventName)) {
      return;
    }

    const canonicalProps = sanitizeAnalyticsProperties(resolved.properties) ?? eventProperties;
    const mergedCanonicalProps = {
      ...eventProperties,
      ...canonicalProps,
    };
    this.safelyCallPostHog('capture canonical', () => {
      this.posthog.capture(resolved.eventName, mergedCanonicalProps);
    });

    // Mode-specific Visualize canonical aliases when a visualize session starts/completes/ends early
    if (mergedCanonicalProps.practice_mode === 'visualize') {
      const visualizeCanonical =
        resolved.eventName === 'practice_started'
          ? 'visualize_started'
          : resolved.eventName === 'practice_completed'
            ? 'visualize_completed'
            : resolved.eventName === 'practice_abandoned'
              ? 'visualize_abandoned'
              : null;
      if (visualizeCanonical && this.shouldEmitCanonicalEvent(visualizeCanonical)) {
        this.safelyCallPostHog('capture visualize canonical', () => {
          this.posthog.capture(visualizeCanonical, mergedCanonicalProps);
        });
      }
    }
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
      defaultOptIn: this.enabled,
      disableGeoip: true,
      enableSessionReplay: false,
      captureAppLifecycleEvents: this.enabled,
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

    if (!this.enabled) {
      this.pendingQueue = [];
      this.userProperties = {};
    }

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
      if (this.enabled) {
        this.flushPendingQueue();
        this.notifyDistinctIdListeners();
      }
      return;
    }

    this.initialized = true;

    if (!this.enabled) {
      try {
        this.posthog?.optOut?.();
      } catch (error) {
        logger.warn('[Analytics] PostHog optOut failed', error);
      }
      logger.warn('[Analytics] PostHog disabled');
      return;
    }

    if (!this.ensurePostHogClient()) {
      logger.warn('[Analytics] PostHog missing API key');
      return;
    }

    this.flushPendingQueue();
    this.notifyDistinctIdListeners();
  }

  /**
   * Identify the current user
   */
  identify(userId: string, properties?: UserProperties): void {
    if (!this.enabled) return;

    const previousIdentifiedUserId = this.userId ?? this.persistedIdentifiedUserId;
    const isSwitchingAuthenticatedAccounts = Boolean(
      previousIdentifiedUserId && previousIdentifiedUserId !== userId
    );

    if (isSwitchingAuthenticatedAccounts) {
      this.userProperties = {};
      this.persistFirstAnchorRecorded(false, null);
      this.recentCanonicalSignatures.clear();
      if (!this.canSendToPostHog()) {
        this.enqueue({ type: 'reset', forceReset: true });
      } else {
        this.safelyCallPostHog('reset before account switch', () => {
          this.posthog.reset();
        });
      }
    } else if (!previousIdentifiedUserId && this.firstAnchorCreatedRecorded) {
      // Guest who already created their first Anchor is now registering / signing in:
      // bind the recorded first Anchor marker to this newly authenticated userId.
      this.firstAnchorRecordedAccounts.add(userId);
      this.persistFirstAnchorRecorded(true, userId);
    }

    if (
      (typeof properties?.totalAnchorsCreated === 'number' && properties.totalAnchorsCreated >= 1) ||
      this.firstAnchorRecordedAccounts.has(userId)
    ) {
      this.firstAnchorRecordedAccounts.add(userId);
      this.firstAnchorCreatedRecorded = true;
    }

    this.userId = userId;
    this.persistIdentifiedUserId(userId);
    this.userProperties = { ...this.userProperties, ...properties };

    const safeProperties = sanitizeAnalyticsProperties(properties);

    logger.info('[Analytics] Identify', { userId, properties: safeProperties });

    if (!this.canSendToPostHog()) {
      this.enqueue({ type: 'identify', userId, properties: safeProperties });
      return;
    }

    this.safelyCallPostHog('identify', () => {
      this.posthog.identify(userId, safeProperties);
    });
    this.notifyDistinctIdListeners();
  }

  /**
   * Track an event
   */
  track(eventName: string, properties?: Record<string, any>): void {
    if (!this.enabled) return;

    const sharedContext = this.getSharedContext();
    const sanitizedProps = sanitizeAnalyticsProperties(properties);

    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        app_version: appVersion,
        platform: Platform.OS,
        ...sharedContext,
        ...sanitizedProps,
        userId: this.userId,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    logger.info('[Analytics] Track', event);

    if (!this.canSendToPostHog()) {
      this.enqueue({
        type: 'capture',
        eventName,
        properties: event.properties!,
      });
      return;
    }

    this.captureWithCanonicalAliases(eventName, event.properties!);
  }

  /**
   * Track lifecycle telemetry without attaching the identified user field.
   * Splash/startup events must remain free of personal information.
   */
  trackAnonymous(eventName: string, properties?: Record<string, any>): void {
    if (!this.enabled) return;

    const sharedContext = this.getSharedContext();
    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        app_version: appVersion,
        experience_version: sharedContext.experience_version,
        environment: sharedContext.environment,
        is_sandbox: sharedContext.is_sandbox,
        platform: Platform.OS,
        ...sanitizeAnalyticsProperties(properties),
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    logger.info('[Analytics] Track anonymous', event);

    if (!this.canSendToPostHog()) {
      this.enqueue({
        type: 'capture',
        eventName,
        properties: event.properties!,
        anonymous: true,
      });
      return;
    }

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

    if (!this.canSendToPostHog()) {
      this.enqueue({ type: 'setUserProperties', properties: safeProperties });
      return;
    }

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
   * Record and deduplicate `first_anchor_created` across guest creation, subsequent account registration,
   * synchronization retries, app restarts, and multiple authenticated accounts on the same device.
   * Returns true if the event was emitted, false if already recorded for this session/account.
   */
  trackFirstAnchorCreatedOnce(properties?: Record<string, any>): boolean {
    const explicitAccountId =
      typeof properties?.account_id === 'string' && properties.account_id.trim().length > 0
        ? properties.account_id.trim()
        : null;
    if (this.hasAccountRecordedFirstAnchor(explicitAccountId)) {
      return false;
    }
    this.persistFirstAnchorRecorded(true, explicitAccountId);
    this.track(AnalyticsEvents.FIRST_ANCHOR_CREATED, properties);
    return true;
  }

  /**
   * Mark that the current user/guest already has a confirmed first Anchor (e.g., before syncing guest anchors on sign-up)
   * so syncing to a newly created account does not double-count `first_anchor_created`.
   */
  markFirstAnchorAlreadyCreated(accountId?: string | null): void {
    this.persistFirstAnchorRecorded(true, accountId);
  }

  /**
   * Return whether analytics tracking is currently enabled and consented to.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Return the current PostHog distinct ID or identified user ID when available.
   * Returns null when analytics tracking is disabled so external integrations (e.g., RevenueCat)
   * respect user privacy preferences.
   */
  getDistinctId(): string | null {
    if (!this.enabled) {
      return null;
    }
    try {
      const distinctId = this.posthog?.getDistinctId?.();
      if (typeof distinctId === 'string' && distinctId.trim().length > 0) {
        return distinctId.trim();
      }
    } catch {
      // Ignore SDK read errors
    }
    return this.userId ?? this.persistedIdentifiedUserId;
  }

  /**
   * Non-blocking flush of queued PostHog events (e.g. when app moves to background).
   */
  flush(): void {
    this.safelyCallPostHog('flush', () => {
      void this.posthog?.flush?.();
    });
  }

  /**
   * Reset analytics (on logout or account switch).
   * Checks both in-memory userId and persisted identified user state so resets after cold-start
   * session expiration are honored without wiping anonymous guest identities.
   * Never calls posthog.reset() when analytics is disabled so opt-out state is never cleared.
   */
  reset(options?: {
    forceReset?: boolean;
    reason?: 'logout' | 'account_switch' | 'rehydrate' | 'privacy_opt_out' | 'test';
  }): void {
    const wasIdentified = this.userId !== null || this.persistedIdentifiedUserId !== null;
    const shouldResetPostHog = Boolean(
      wasIdentified ||
      options?.forceReset ||
      options?.reason === 'logout' ||
      options?.reason === 'account_switch' ||
      options?.reason === 'privacy_opt_out'
    );

    this.userId = null;
    this.persistIdentifiedUserId(null);
    this.userProperties = {};
    this.persistFirstAnchorRecorded(false, null);
    if (options?.forceReset || options?.reason === 'test') {
      this.firstAnchorRecordedAccounts.clear();
      try {
        void AsyncStorage.removeItem(PERSISTED_FIRST_ANCHOR_ACCOUNTS_KEY).catch(() => undefined);
      } catch {
        // Non-blocking storage remove
      }
    }
    this.recentCanonicalSignatures.clear();

    if (!this.enabled) {
      // Ensure pendingQueue stays empty and never invoke posthog.reset() when opted out,
      // because posthog-react-native's reset() clears the persisted opt-out flag.
      this.pendingQueue = [];
      return;
    }

    logger.info('[Analytics] Reset', {
      wasIdentified,
      forceReset: Boolean(options?.forceReset),
      reason: options?.reason,
    });

    if (shouldResetPostHog) {
      if (!this.canSendToPostHog()) {
        this.enqueue({ type: 'reset', forceReset: true });
        return;
      }
      this.safelyCallPostHog('reset', () => {
        this.posthog.reset();
      });
      this.notifyDistinctIdListeners();
    }
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    logger.info('[Analytics] Set enabled', enabled);

    if (!enabled) {
      this.pendingQueue = [];
      this.userProperties = {};
      try {
        this.posthog?.optOut?.();
      } catch (error) {
        logger.warn('[Analytics] PostHog opt out failed', error);
      }
      this.notifyDistinctIdListeners();
      return;
    }

    if (!this.initialized) {
      this.initialize({ enabled });
      return;
    }

    if (!this.ensurePostHogClient()) {
      logger.warn('[Analytics] PostHog missing API key');
      return;
    }

    try {
      this.posthog?.optIn?.();
    } catch (error) {
      logger.warn('[Analytics] PostHog opt in failed', error);
    }

    this.flushPendingQueue();
    this.notifyDistinctIdListeners();
  }
}

const CANONICAL_DEDUPED_EVENTS = new Set<string>([
  'onboarding_abandoned',
  'account_save_skipped',
  'account_created',
  'anchor_generation_started',
  'anchor_generation_completed',
  'anchor_generation_failed',
  'anchor_selected',
  'practice_started',
  'practice_completed',
  'practice_abandoned',
  'vision_generation_started',
  'vision_generation_completed',
  'vision_generation_failed',
  'vision_board_saved',
  'visualize_started',
  'visualize_completed',
  'visualize_abandoned',
  'chart_planning_started',
  'chart_generated',
  'chart_approved',
  'chart_adjustment_requested',
  'one_move_completed',
  'waypoint_reached',
  'paywall_page_viewed',
  'restore_attempted',
  'teaching_shown',
  'teaching_dismissed',
  'teaching_action_taken',
  'reminder_enabled',
  'notification_permission_result',
  'share_exported',
]);

// Export singleton instance
export const AnalyticsService = new Analytics();

// Export event names for consistency
export const AnalyticsEvents = {
  // App lifecycle
  APP_OPENED: 'app_opened',
  APP_BACKGROUNDED: 'app_backgrounded',
  SPLASH_STARTED: 'splash_started',
  SPLASH_COMPLETED: 'splash_completed',
  SPLASH_SKIPPED_REDUCE_MOTION: 'splash_skipped_reduce_motion',
  SPLASH_STARTUP_WAITED: 'splash_startup_waited',

  // Phase 3A — Onboarding & First Anchor Creation (Canonical Anchor 2.0)
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_VIEWED: 'onboarding_step_viewed',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_ABANDONED: 'onboarding_abandoned',
  INTENTION_SUBMITTED: 'intention_submitted',
  ANCHOR_GENERATION_STARTED: 'anchor_generation_started',
  ANCHOR_GENERATION_COMPLETED: 'anchor_generation_completed',
  ANCHOR_GENERATION_FAILED: 'anchor_generation_failed',
  ANCHOR_VARIATIONS_PRESENTED: 'anchor_variations_presented',
  ANCHOR_SELECTED: 'anchor_selected',
  ACCOUNT_SAVE_PROMPT_VIEWED: 'account_save_prompt_viewed',
  ACCOUNT_SAVE_SKIPPED: 'account_save_skipped',
  ACCOUNT_CREATED: 'account_created',
  FIRST_ANCHOR_CREATED: 'first_anchor_created',

  // Authentication
  SIGN_UP_STARTED: 'sign_up_started',
  SIGN_UP_COMPLETED: 'sign_up_completed',
  SIGN_IN_STARTED: 'sign_in_started',
  SIGN_IN_COMPLETED: 'sign_in_completed',
  SIGN_OUT: 'sign_out',

  // Anchor creation (1.5 & shared)
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

  // Share Studio / social export (layout: minimal | style | editorial | vision)
  SHARE_STUDIO_OPENED: 'share_studio_opened',
  SHARE_LAYOUT_SELECTED: 'share_layout_selected',
  ANCHOR_EXPORT_SAVED: 'anchor_export_saved',
  ANCHOR_EXPORT_SHARED: 'anchor_export_shared',
  SHARE_EXPORTED: 'share_exported',

  ANCHOR_CHARGED: 'anchor_charged',
  ANCHOR_ACTIVATED: 'anchor_activated',
  ANCHOR_DELETED: 'anchor_deleted',
  ANCHOR_BURNED: 'anchor_burned',

  // Rituals & Release
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
  RELEASE_COMPLETED: 'release_completed',

  // Phase 3B — Practice, Thread Strength & Milestones (Canonical Anchor 2.0)
  PRACTICE_MODE_VIEWED: 'practice_mode_viewed',
  PRACTICE_STARTED: 'practice_started',
  PRACTICE_COMPLETED: 'practice_completed',
  PRACTICE_ABANDONED: 'practice_abandoned',
  PRACTICE_FAILED: 'practice_failed',
  THREAD_STRENGTH_CHANGED: 'thread_strength_changed',
  MILESTONE_EARNED: 'milestone_earned',

  // Phase 3C — Vision & Visualize (Canonical Anchor 2.0)
  VISION_OPENED: 'vision_opened',
  VISION_GENERATION_STARTED: 'vision_generation_started',
  VISION_GENERATION_COMPLETED: 'vision_generation_completed',
  VISION_GENERATION_FAILED: 'vision_generation_failed',
  VISION_IMAGE_SELECTED: 'vision_image_selected',
  VISION_PHOTO_ADDED: 'vision_photo_added',
  VISION_BOARD_SAVED: 'vision_board_saved',
  VISUALIZE_STARTED: 'visualize_started',
  VISUALIZE_COMPLETED: 'visualize_completed',
  VISUALIZE_ABANDONED: 'visualize_abandoned',

  // Phase 3D — Chart & Ask Chart (Canonical Anchor 2.0)
  CHART_OPENED: 'chart_opened',
  CHART_PLANNING_STARTED: 'chart_planning_started',
  CHART_GENERATED: 'chart_generated',
  CHART_GENERATION_FAILED: 'chart_generation_failed',
  CHART_APPROVED: 'chart_approved',
  CHART_ADJUSTMENT_REQUESTED: 'chart_adjustment_requested',
  ONE_MOVE_OPENED: 'one_move_opened',
  ONE_MOVE_COMPLETED: 'one_move_completed',
  ASK_CHART_OPENED: 'ask_chart_opened',
  ASK_CHART_MESSAGE_SENT: 'ask_chart_message_sent',
  WAYPOINT_REACHED: 'waypoint_reached',

  // Subscription & Limits
  ANCHOR_LIMIT_REACHED: 'anchor_limit_reached',
  UPGRADE_INITIATED: 'upgrade_initiated',
  BURN_TO_MAKE_ROOM_INITIATED: 'burn_to_make_room_initiated',

  // Trial lifecycle
  TRIAL_STARTED: 'trial_started',
  TRIAL_EXPIRED: 'trial_expired',
  TRIAL_CONVERTED: 'trial_converted',
  TRIAL_BANNER_VIEWED: 'trial_banner_viewed',
  TRIAL_BANNER_TAPPED: 'trial_banner_tapped',

  // Phase 3E — Paywall & Subscriptions (Canonical Anchor 2.0 + Legacy)
  PREMIUM_FEATURE_ATTEMPTED: 'premium_feature_attempted',
  PAYWALL_VIEWED: 'paywall_viewed',
  PAYWALL_PAGE_VIEWED: 'paywall_page_viewed',
  PAYWALL_DISMISSED: 'paywall_dismissed',
  PAYWALL_CTA_TAPPED: 'paywall_cta_tapped',
  PAYWALL_CONVERTED: 'paywall_converted',
  PAYWALL_STEP2_VIEWED: 'paywall_step2_viewed',
  PAYWALL_PLAN_SELECTED: 'paywall_plan_selected',
  PAYWALL_RESTORE_TAPPED: 'paywall_restore_tapped',
  PURCHASE_STARTED: 'purchase_started',
  PURCHASE_FAILED: 'purchase_failed',
  PURCHASE_CANCELLED: 'purchase_cancelled',
  RESTORE_ATTEMPTED: 'restore_attempted',

  // Phase 3F — Teaching, Notifications, Sharing & Progress (Canonical Anchor 2.0)
  TEACHING_SHOWN: 'teaching_shown',
  TEACHING_DISMISSED: 'teaching_dismissed',
  TEACHING_ACTION_TAKEN: 'teaching_action_taken',
  NOTIFICATION_PERMISSION_RESULT: 'notification_permission_result',
  REMINDER_ENABLED: 'reminder_enabled',
  WEEKLY_INSIGHT_OPENED: 'weekly_insight_opened',

  // Features (1.5 & shared)
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
  NOTIFICATION_INVITATION_SHOWN: 'notification_invitation_shown',
  NOTIFICATION_INVITATION_ACCEPTED: 'notification_invitation_accepted',
  NOTIFICATION_INVITATION_DISMISSED: 'notification_invitation_dismissed',
  REMINDER_TIME_SELECTED: 'reminder_time_selected',
  PERSONAL_REMINDER_ENABLED: 'personal_reminder_enabled',
  NOTIFICATION_CATEGORY_TOGGLED: 'notification_category_toggled',

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
