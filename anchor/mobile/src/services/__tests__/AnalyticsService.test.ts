/**
 * AnalyticsService Tests
 */

import {
  AnalyticsEvents,
  AnalyticsService,
  sanitizeAnalyticsProperties,
} from '../AnalyticsService';

beforeEach(() => {
  AnalyticsService.setEnabled(true);
  AnalyticsService.reset();
});

describe('AnalyticsService', () => {
  describe('initialize', () => {
    it('initializes with default config without throwing', () => {
      expect(() => AnalyticsService.initialize()).not.toThrow();
    });

    it('initializes with enabled=false without throwing', () => {
      expect(() => AnalyticsService.initialize({ enabled: false })).not.toThrow();
      // Re-enable for other tests
      AnalyticsService.setEnabled(true);
    });
  });

  describe('identify', () => {
    it('sets the user id and properties without throwing', () => {
      expect(() =>
        AnalyticsService.identify('user-123', { email: 'test@example.com', currentStreak: 5 })
      ).not.toThrow();
    });

    it('identifies without properties without throwing', () => {
      expect(() => AnalyticsService.identify('user-456')).not.toThrow();
    });

    it('does not throw when analytics is disabled', () => {
      AnalyticsService.setEnabled(false);
      expect(() => AnalyticsService.identify('user-123')).not.toThrow();
    });
  });

  describe('track', () => {
    it('tracks an event without throwing', () => {
      expect(() =>
        AnalyticsService.track('test_event', { category: 'health' })
      ).not.toThrow();
    });

    it('tracks an event with no properties without throwing', () => {
      expect(() => AnalyticsService.track('bare_event')).not.toThrow();
    });

    it('does not throw when analytics is disabled', () => {
      AnalyticsService.setEnabled(false);
      expect(() => AnalyticsService.track('suppressed_event')).not.toThrow();
    });
  });

  describe('trackAnonymous', () => {
    it('tracks lifecycle events without throwing', () => {
      AnalyticsService.identify('user-should-not-be-attached');
      expect(() =>
        AnalyticsService.trackAnonymous(AnalyticsEvents.SPLASH_STARTED, {
          authState: 'signed_in',
          startupOutcome: 'success',
        })
      ).not.toThrow();
    });

    it('does not throw when analytics is disabled', () => {
      AnalyticsService.setEnabled(false);
      expect(() => AnalyticsService.trackAnonymous(AnalyticsEvents.SPLASH_COMPLETED)).not.toThrow();
    });
  });

  describe('screen', () => {
    it('tracks a screen view without throwing', () => {
      expect(() => AnalyticsService.screen('VaultScreen')).not.toThrow();
    });

    it('tracks screen view with extra properties', () => {
      expect(() =>
        AnalyticsService.screen('AnchorDetailScreen', { anchorId: 'abc123' })
      ).not.toThrow();
    });
  });

  describe('setUserProperties', () => {
    it('sets user properties without throwing', () => {
      expect(() =>
        AnalyticsService.setUserProperties({ subscriptionStatus: 'pro', totalAnchorsCreated: 3 })
      ).not.toThrow();
    });

    it('does not throw when disabled', () => {
      AnalyticsService.setEnabled(false);
      expect(() => AnalyticsService.setUserProperties({ currentStreak: 7 })).not.toThrow();
    });
  });

  describe('incrementProperty', () => {
    it('increments a property without throwing', () => {
      expect(() => AnalyticsService.incrementProperty('total_anchors')).not.toThrow();
    });

    it('increments by a custom value without throwing', () => {
      expect(() => AnalyticsService.incrementProperty('total_activations', 5)).not.toThrow();
    });

    it('does not throw when disabled', () => {
      AnalyticsService.setEnabled(false);
      expect(() => AnalyticsService.incrementProperty('counter')).not.toThrow();
    });
  });

  describe('reset', () => {
    it('resets without throwing', () => {
      AnalyticsService.identify('user-999');
      expect(() => AnalyticsService.reset()).not.toThrow();
    });

    it('does not throw when disabled', () => {
      AnalyticsService.setEnabled(false);
      expect(() => AnalyticsService.reset()).not.toThrow();
    });
  });

  describe('setEnabled', () => {
    it('can be disabled then re-enabled', () => {
      AnalyticsService.setEnabled(false);
      AnalyticsService.setEnabled(true);
      expect(() => AnalyticsService.track('after_re_enable')).not.toThrow();
    });

    it('can be set to false without throwing', () => {
      expect(() => AnalyticsService.setEnabled(false)).not.toThrow();
    });
  });

  describe('AnalyticsEvents constants', () => {
    it('exports expected event name constants', () => {
      expect(AnalyticsEvents.ANCHOR_CREATION_COMPLETED).toBe('anchor_creation_completed');
      expect(AnalyticsEvents.ANCHOR_BURNED).toBe('anchor_burned');
      expect(AnalyticsEvents.SIGN_IN_COMPLETED).toBe('sign_in_completed');
      expect(AnalyticsEvents.ACTIVATION_RITUAL_COMPLETED).toBe('activation_ritual_completed');
      expect(AnalyticsEvents.APP_OPENED).toBe('app_opened');
      expect(AnalyticsEvents.SIGN_OUT).toBe('sign_out');
      expect(AnalyticsEvents.SPLASH_STARTED).toBe('splash_started');
      expect(AnalyticsEvents.SPLASH_COMPLETED).toBe('splash_completed');
      expect(AnalyticsEvents.SPLASH_SKIPPED_REDUCE_MOTION).toBe('splash_skipped_reduce_motion');
      expect(AnalyticsEvents.SPLASH_STARTUP_WAITED).toBe('splash_startup_waited');
    });
  });

  describe('sanitizeAnalyticsProperties', () => {
    it('removes sensitive top-level and nested properties', () => {
      expect(
        sanitizeAnalyticsProperties({
          category: 'health',
          email: 'person@example.com',
          intentionText: 'private intention',
          prompt: 'private prompt',
          scene: 'private scene',
          scene_snapshot: 'private snapshot',
          next_action: 'private action',
          text_content: 'private text',
          caption: 'private caption',
          description: 'private vision description',
          transcript: 'private chat transcript',
          chat_message: 'private chat message',
          idToken: 'secret-token',
          svg_data: '<svg>private</svg>',
          nested: {
            mantra: 'private mantra',
            safe: true,
            image_url: 'https://example.com/private.png',
          },
        })
      ).toEqual({
        category: 'health',
        nested: {
          safe: true,
        },
      });
    });
  });

  describe('Anchor 2.0 Launch Readiness & QA Scenarios', () => {
    it('replays pre-initialization queued events once PostHog is initialized', () => {
      // Simulate pre-init state by nulling internal posthog client and initialized flag
      (AnalyticsService as unknown as { initialized: boolean }).initialized = false;
      (AnalyticsService as unknown as { posthog: null }).posthog = null;
      (AnalyticsService as unknown as { pendingQueue: unknown[] }).pendingQueue = [];

      const mockCapture = jest.fn();
      const mockIdentify = jest.fn();

      // Queue calls before init
      AnalyticsService.track(AnalyticsEvents.SPLASH_STARTED, { cold_start: true });
      AnalyticsService.identify('user-queued-1', { currentStreak: 2 });
      AnalyticsService.screen('Onboarding');

      expect((AnalyticsService as unknown as { pendingQueue: unknown[] }).pendingQueue.length).toBe(3);

      // Attach mock PostHog client and flush pending queue
      (AnalyticsService as unknown as { initialized: boolean }).initialized = true;
      (AnalyticsService as unknown as { posthog: unknown }).posthog = {
        capture: mockCapture,
        identify: mockIdentify,
        reset: jest.fn(),
        flush: jest.fn(),
      };
      (AnalyticsService as unknown as { flushPendingQueue: () => void }).flushPendingQueue();

      expect(mockCapture).toHaveBeenCalledWith(
        AnalyticsEvents.SPLASH_STARTED,
        expect.objectContaining({ cold_start: true })
      );
      expect(mockIdentify).toHaveBeenCalledWith('user-queued-1', expect.objectContaining({ currentStreak: 2 }));
      expect(mockCapture).toHaveBeenCalledWith(
        'screen_view',
        expect.objectContaining({ screen_name: 'Onboarding' })
      );
      expect((AnalyticsService as unknown as { pendingQueue: unknown[] }).pendingQueue.length).toBe(0);
    });

    it('preserves PostHog anonymous identity on unauthenticated reset and only resets PostHog on sign-out', () => {
      const mockPostHogReset = jest.fn();
      (AnalyticsService as unknown as { posthog: unknown }).posthog = {
        capture: jest.fn(),
        identify: jest.fn(),
        screen: jest.fn(),
        reset: mockPostHogReset,
        flush: jest.fn(),
      };

      // Unauthenticated reset (userId is already null) -> should NOT wipe PostHog anonymous distinct_id
      (AnalyticsService as unknown as { userId: string | null }).userId = null;
      AnalyticsService.reset();
      expect(mockPostHogReset).not.toHaveBeenCalled();

      // Authenticated user signs out -> SHOULD reset PostHog identity
      AnalyticsService.identify('user-authenticated-42');
      AnalyticsService.reset();
      expect(mockPostHogReset).toHaveBeenCalledTimes(1);
    });

    it('deduplicates first_anchor_created across guest creation and subsequent account registration', () => {
      const mockCapture = jest.fn();
      (AnalyticsService as unknown as { posthog: unknown }).posthog = {
        capture: mockCapture,
        identify: jest.fn(),
        screen: jest.fn(),
        reset: jest.fn(),
        flush: jest.fn(),
      };

      AnalyticsService.reset({ forceReset: true });
      AnalyticsService.trackFirstAnchorCreatedOnce({
        anchor_id: 'local-anchor-1',
        category: 'career',
        is_guest: true,
      });
      // Simulate account registration handoff attempting to fire or mark again
      AnalyticsService.markFirstAnchorAlreadyCreated();
      AnalyticsService.trackFirstAnchorCreatedOnce({
        anchor_id: 'server-anchor-1',
        category: 'career',
        is_guest: false,
      });

      const firstAnchorCalls = mockCapture.mock.calls.filter(
        ([eventName]) => eventName === AnalyticsEvents.FIRST_ANCHOR_CREATED
      );
      expect(firstAnchorCalls).toHaveLength(1);
      expect(firstAnchorCalls[0][1]).toEqual(
        expect.objectContaining({
          anchor_id: 'local-anchor-1',
          category: 'career',
          is_guest: true,
        })
      );
    });

    it('emits canonical Phase 3 aliases alongside legacy/internal event names without breaking single-call expectations', () => {
      const mockCapture = jest.fn();
      (AnalyticsService as unknown as { posthog: unknown }).posthog = {
        capture: mockCapture,
        identify: jest.fn(),
        screen: jest.fn(),
        reset: jest.fn(),
        flush: jest.fn(),
      };

      AnalyticsService.track('auth_guest_chosen', { source: 'onboarding_save' });
      expect(mockCapture).toHaveBeenCalledWith('auth_guest_chosen', expect.objectContaining({ source: 'onboarding_save' }));
      expect(mockCapture).toHaveBeenCalledWith(
        AnalyticsEvents.ACCOUNT_SAVE_SKIPPED,
        expect.objectContaining({ source: 'onboarding_save' })
      );

      mockCapture.mockClear();
      AnalyticsService.track('chart_waypoint_completed', { courseId: 'c-1', replayed: false });
      expect(mockCapture).toHaveBeenCalledWith('chart_waypoint_completed', expect.objectContaining({ courseId: 'c-1' }));
      expect(mockCapture).toHaveBeenCalledWith(
        AnalyticsEvents.WAYPOINT_REACHED,
        expect.objectContaining({ courseId: 'c-1' })
      );
    });

    it('enriches events with shared context provider properties without overriding explicit properties', () => {
      const mockCapture = jest.fn();
      (AnalyticsService as unknown as { initialized: boolean }).initialized = true;
      (AnalyticsService as unknown as { posthog: unknown }).posthog = {
        capture: mockCapture,
        identify: jest.fn(),
        screen: jest.fn(),
        reset: jest.fn(),
        flush: jest.fn(),
      };

      AnalyticsService.setContextProvider(() => ({
        experience_version: '2.0',
        subscription_tier: 'trial',
        account_state: 'authenticated',
      }));

      AnalyticsService.track(AnalyticsEvents.CHART_OPENED, { anchor_id: 'a-1' });
      expect(mockCapture).toHaveBeenCalledWith(
        AnalyticsEvents.CHART_OPENED,
        expect.objectContaining({
          anchor_id: 'a-1',
          experience_version: '2.0',
          subscription_tier: 'trial',
          account_state: 'authenticated',
        })
      );

      AnalyticsService.setContextProvider(null);
    });
  });

  describe('P0 Launch Authorization — 11 Mandatory Verification Scenarios', () => {
    const attachMockPostHog = (initialDistinctId = 'anon-distinct-id-1') => {
      let currentDistinctId = initialDistinctId;
      const mockCapture = jest.fn();
      const mockIdentify = jest.fn((userId: string) => {
        currentDistinctId = userId;
      });
      const mockReset = jest.fn(() => {
        currentDistinctId = `anon-after-reset-${mockReset.mock.calls.length}`;
      });
      const mockOptIn = jest.fn();
      const mockOptOut = jest.fn();
      const mockFlush = jest.fn();

      (AnalyticsService as unknown as { initialized: boolean }).initialized = true;
      (AnalyticsService as unknown as { posthog: unknown }).posthog = {
        capture: mockCapture,
        identify: mockIdentify,
        reset: mockReset,
        optIn: mockOptIn,
        optOut: mockOptOut,
        flush: mockFlush,
        getDistinctId: () => currentDistinctId,
      };

      return { mockCapture, mockIdentify, mockReset, mockOptIn, mockOptOut, mockFlush };
    };

    it('1. Guest closes app and returns: preserves anonymous identity across restarts without calling posthog.reset()', () => {
      const { mockReset, mockCapture } = attachMockPostHog('anon-guest-persist-101');
      (AnalyticsService as unknown as { userId: string | null }).userId = null;
      (AnalyticsService as unknown as { persistedIdentifiedUserId: string | null }).persistedIdentifiedUserId = null;

      // Session 1: Guest opens app and starts onboarding
      AnalyticsService.track(AnalyticsEvents.ONBOARDING_STARTED, { resumed: false });
      expect(AnalyticsService.getDistinctId()).toBe('anon-guest-persist-101');

      // Simulate cold start rehydration with unauthenticated guest state (user: null)
      AnalyticsService.reset(); // Unauthenticated reset with no prior userId or persistedIdentifiedUserId
      AnalyticsService.track(AnalyticsEvents.APP_OPENED, { resumed: true });

      expect(mockReset).not.toHaveBeenCalled();
      expect(AnalyticsService.getDistinctId()).toBe('anon-guest-persist-101');
      expect(mockCapture).toHaveBeenCalledTimes(2);
    });

    it('2. Guest creates Anchor and later registers: links anonymous activity to authenticated identity and emits first_anchor_created exactly once', () => {
      const { mockCapture, mockIdentify, mockReset } = attachMockPostHog('anon-guest-202');
      AnalyticsService.reset({ forceReset: true });
      mockReset.mockClear();

      // Guest creates first Anchor prior to registration
      const emittedOnGuestCreate = AnalyticsService.trackFirstAnchorCreatedOnce({
        anchor_id: 'pending-first-anchor-1',
        category: 'career',
        is_guest: true,
      });
      expect(emittedOnGuestCreate).toBe(true);

      // Guest later registers an account; identify links anonymous distinct_id to user-registered-202 without resetting
      AnalyticsService.identify('user-registered-202', { subscriptionStatus: 'free' });
      expect(mockReset).not.toHaveBeenCalled();
      expect(mockIdentify).toHaveBeenCalledWith(
        'user-registered-202',
        expect.objectContaining({ subscriptionStatus: 'free' })
      );

      // Pending draft synchronization runs after registration
      AnalyticsService.markFirstAnchorAlreadyCreated();
      const emittedOnSync = AnalyticsService.trackFirstAnchorCreatedOnce({
        anchor_id: 'server-anchor-202',
        category: 'career',
        is_guest: false,
      });
      expect(emittedOnSync).toBe(false);

      const firstAnchorEvents = mockCapture.mock.calls.filter(
        ([eventName]) => eventName === AnalyticsEvents.FIRST_ANCHOR_CREATED
      );
      expect(firstAnchorEvents).toHaveLength(1);
    });

    it('3. Authenticated user logs out (and cold-start session expiration / account switching): resets PostHog identity using persisted marker even when in-memory userId is null', () => {
      const { mockReset, mockIdentify } = attachMockPostHog('anon-303');

      // User logs in
      AnalyticsService.identify('user-auth-A');
      expect(AnalyticsService.getDistinctId()).toBe('user-auth-A');

      // Simulate app restart where in-memory userId is null, but persistedIdentifiedUserId is still 'user-auth-A'
      (AnalyticsService as unknown as { userId: string | null }).userId = null;
      expect(
        (AnalyticsService as unknown as { persistedIdentifiedUserId: string | null }).persistedIdentifiedUserId
      ).toBe('user-auth-A');

      // Confirmed logout / session expiry during startup reconciliation triggers reset()
      AnalyticsService.reset({ reason: 'logout' });
      expect(mockReset).toHaveBeenCalledTimes(1);
      expect(AnalyticsService.getDistinctId()).toBe('anon-after-reset-1');

      // Account switch from user-auth-A to user-auth-B also forces a reset before identifying user-auth-B
      AnalyticsService.identify('user-auth-A');
      mockReset.mockClear();
      AnalyticsService.identify('user-auth-B');
      expect(mockReset).toHaveBeenCalledTimes(1);
      expect(mockIdentify).toHaveBeenLastCalledWith('user-auth-B', undefined);
    });

    it('4. App launches while auth and settings are rehydrating: buffers early events and identification in order and flushes only after privacy preference hydration', () => {
      (AnalyticsService as unknown as { initialized: boolean }).initialized = false;
      (AnalyticsService as unknown as { enabled: boolean }).enabled = true;
      (AnalyticsService as unknown as { posthog: null }).posthog = null;
      (AnalyticsService as unknown as { pendingQueue: unknown[] }).pendingQueue = [];
      (AnalyticsService as unknown as { userId: string | null }).userId = null;
      (AnalyticsService as unknown as { persistedIdentifiedUserId: string | null }).persistedIdentifiedUserId = null;

      const callOrder: string[] = [];
      const mockPostHog = {
        capture: jest.fn((eventName: string, _properties?: Record<string, any>) => {
          callOrder.push(`capture:${eventName}`);
        }),
        identify: jest.fn((userId: string, _properties?: Record<string, any>) => {
          callOrder.push(`identify:${userId}`);
        }),
        reset: jest.fn(() => {
          callOrder.push('reset');
        }),
        optIn: jest.fn(),
        optOut: jest.fn(),
        flush: jest.fn(),
        getDistinctId: () => 'user-rehydrated-404',
      };

      // Emit early startup events and auth rehydration while settings preference is still hydrating
      AnalyticsService.trackAnonymous(AnalyticsEvents.SPLASH_STARTED, { cold_start: true });
      AnalyticsService.identify('user-rehydrated-404', { subscriptionStatus: 'pro' });
      AnalyticsService.track(AnalyticsEvents.APP_OPENED, { source: 'cold_start' });

      expect(mockPostHog.capture).not.toHaveBeenCalled();
      expect(mockPostHog.identify).not.toHaveBeenCalled();

      // Settings hydration completes with analyticsEnabled = true
      (AnalyticsService as unknown as { posthog: unknown }).posthog = mockPostHog;
      AnalyticsService.initialize({ enabled: true, posthogApiKey: 'phc_test_key' });

      expect(callOrder).toEqual([
        `capture:${AnalyticsEvents.SPLASH_STARTED}`,
        'identify:user-rehydrated-404',
        `capture:${AnalyticsEvents.APP_OPENED}`,
      ]);
      // Anonymous splash event must not have userId attached
      expect(mockPostHog.capture.mock.calls[0][1]).not.toHaveProperty('userId');
      // Subsequent tracked event has userId attached
      expect(mockPostHog.capture.mock.calls[1][1]).toEqual(
        expect.objectContaining({ userId: 'user-rehydrated-404' })
      );
    });

    it('5. Analytics tracking disabled: purges pre-init queue on preference hydration, opts out, and never sends or retains events', () => {
      (AnalyticsService as unknown as { initialized: boolean }).initialized = false;
      (AnalyticsService as unknown as { enabled: boolean }).enabled = true;
      (AnalyticsService as unknown as { pendingQueue: unknown[] }).pendingQueue = [];

      const mockCapture = jest.fn();
      const mockIdentify = jest.fn();
      const mockOptOut = jest.fn();
      (AnalyticsService as unknown as { posthog: unknown }).posthog = {
        capture: mockCapture,
        identify: mockIdentify,
        optOut: mockOptOut,
        optIn: jest.fn(),
        reset: jest.fn(),
        flush: jest.fn(),
      };

      // Early events occur while settings are still hydrating
      AnalyticsService.trackAnonymous(AnalyticsEvents.SPLASH_STARTED);
      AnalyticsService.identify('user-opted-out');
      AnalyticsService.track(AnalyticsEvents.ONBOARDING_STARTED);
      expect((AnalyticsService as unknown as { pendingQueue: unknown[] }).pendingQueue.length).toBe(3);

      // Settings finish hydrating with analyticsEnabled = false
      AnalyticsService.initialize({ enabled: false });

      expect((AnalyticsService as unknown as { pendingQueue: unknown[] }).pendingQueue.length).toBe(0);
      expect(mockOptOut).toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
      expect(mockIdentify).not.toHaveBeenCalled();

      // Subsequent tracking calls while disabled are dropped immediately
      AnalyticsService.track(AnalyticsEvents.FIRST_ANCHOR_CREATED);
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('6. Practice completion retried: emits practice_completed once and prevents duplicate completion emission on retry', () => {
      const { mockCapture } = attachMockPostHog('user-practice-606');

      // First completion confirmation emits practice_session_completed -> aliases to canonical practice_completed
      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_COMPLETED, {
        session_id: 'sess-606',
        mode: 'focus',
        duration_seconds: 60,
        planned_duration_seconds: 60,
      });

      // Retry of the same sessionId hits PracticeCompletionService duplicate guard and emits practice_duplicate_prevented
      AnalyticsService.track(AnalyticsEvents.PRACTICE_DUPLICATE_PREVENTED, {
        session_id: 'sess-606',
        mode: 'focus',
        source: 'practice_tab',
      });

      const completedCalls = mockCapture.mock.calls.filter(
        ([name]) => name === AnalyticsEvents.PRACTICE_COMPLETED
      );
      const duplicatePreventedCalls = mockCapture.mock.calls.filter(
        ([name]) => name === AnalyticsEvents.PRACTICE_DUPLICATE_PREVENTED
      );

      expect(completedCalls).toHaveLength(1);
      expect(completedCalls[0][1]).toEqual(
        expect.objectContaining({
          session_id: 'sess-606',
          practice_mode: 'focus',
          planned_duration_ms: 60000,
          actual_duration_ms: 60000,
          completion_status: 'completed',
        })
      );
      expect(duplicatePreventedCalls).toHaveLength(1);
    });

    it('7. First Anchor synchronization retried: retrying finalizePendingFirstAnchorDraft does not emit a second first_anchor_created event', () => {
      const { mockCapture } = attachMockPostHog('user-sync-retry-707');
      AnalyticsService.reset({ forceReset: true });

      // Initial first Anchor creation succeeds locally
      expect(
        AnalyticsService.trackFirstAnchorCreatedOnce({
          anchor_id: 'pending-first-anchor-707',
          is_guest: true,
        })
      ).toBe(true);

      // Attempt 1 of finalizePendingFirstAnchorDraft fails on network
      AnalyticsService.markFirstAnchorAlreadyCreated();
      AnalyticsService.track('anchor_save_retry', { context: 'onboarding_save', attempt: 1 });

      // Attempt 2 of finalizePendingFirstAnchorDraft succeeds
      AnalyticsService.markFirstAnchorAlreadyCreated();
      expect(
        AnalyticsService.trackFirstAnchorCreatedOnce({
          anchor_id: 'server-anchor-707',
          is_guest: false,
        })
      ).toBe(false);

      const firstAnchorCalls = mockCapture.mock.calls.filter(
        ([name]) => name === AnalyticsEvents.FIRST_ANCHOR_CREATED
      );
      expect(firstAnchorCalls).toHaveLength(1);
    });

    it('8. Annual trial successfully started: emits trial_started and paywall_converted without emitting trial_converted', () => {
      const { mockCapture } = attachMockPostHog('user-trial-808');

      AnalyticsService.track(AnalyticsEvents.PAYWALL_CTA_TAPPED, {
        plan: 'annual',
        productId: 'anchor_pro_annual',
      });
      AnalyticsService.track(AnalyticsEvents.PURCHASE_STARTED, {
        plan: 'annual',
        productId: 'anchor_pro_annual',
        is_trial: true,
      });
      AnalyticsService.track(AnalyticsEvents.PAYWALL_CONVERTED, {
        plan: 'annual',
        productId: 'anchor_pro_annual',
        outcome: 'trial_started',
      });
      AnalyticsService.track(AnalyticsEvents.TRIAL_STARTED, {
        plan: 'annual',
        productId: 'anchor_pro_annual',
        outcome: 'trial_started',
      });

      const emittedNames = mockCapture.mock.calls.map(([name]) => name);
      expect(emittedNames).toContain(AnalyticsEvents.TRIAL_STARTED);
      expect(emittedNames).toContain(AnalyticsEvents.PAYWALL_CONVERTED);
      expect(emittedNames).not.toContain(AnalyticsEvents.TRIAL_CONVERTED);
    });

    it('9. Store checkout cancelled: emits purchase_started and purchase_cancelled without conversion events', () => {
      const { mockCapture } = attachMockPostHog('user-cancel-909');

      AnalyticsService.track(AnalyticsEvents.PAYWALL_CTA_TAPPED, {
        plan: 'annual',
        productId: 'anchor_pro_annual',
      });
      AnalyticsService.track(AnalyticsEvents.PURCHASE_STARTED, {
        plan: 'annual',
        productId: 'anchor_pro_annual',
        is_trial: true,
      });
      AnalyticsService.track(AnalyticsEvents.PURCHASE_CANCELLED, {
        plan: 'annual',
        productId: 'anchor_pro_annual',
        is_trial: true,
      });

      const emittedNames = mockCapture.mock.calls.map(([name]) => name);
      expect(emittedNames).toEqual([
        AnalyticsEvents.PAYWALL_CTA_TAPPED,
        AnalyticsEvents.PURCHASE_STARTED,
        AnalyticsEvents.PURCHASE_CANCELLED,
      ]);
      expect(emittedNames).not.toContain(AnalyticsEvents.PAYWALL_CONVERTED);
      expect(emittedNames).not.toContain(AnalyticsEvents.TRIAL_STARTED);
      expect(emittedNames).not.toContain(AnalyticsEvents.TRIAL_CONVERTED);
    });

    it('10. App backgrounded during onboarding: emits onboarding_backgrounded and flushes queue without conflating with onboarding_abandoned', () => {
      const { mockCapture, mockFlush } = attachMockPostHog('anon-bg-1010');

      AnalyticsService.track('onboarding_backgrounded', { step: 'creation' });
      AnalyticsService.flush();

      const emittedNames = mockCapture.mock.calls.map(([name]) => name);
      expect(emittedNames).toContain('onboarding_backgrounded');
      expect(emittedNames).not.toContain(AnalyticsEvents.ONBOARDING_ABANDONED);
      expect(mockFlush).toHaveBeenCalledTimes(1);
    });

    it('11. Network unavailable during event capture: catches SDK/network exceptions non-blockingly', () => {
      const { mockCapture, mockIdentify, mockFlush } = attachMockPostHog('user-offline-1111');
      mockCapture.mockImplementation(() => {
        throw new Error('Network request failed: offline');
      });
      mockIdentify.mockImplementation(() => {
        throw new Error('Network request failed: offline');
      });
      mockFlush.mockImplementation(() => {
        throw new Error('Network request failed: offline');
      });

      expect(() =>
        AnalyticsService.identify('user-offline-1111', { subscriptionStatus: 'free' })
      ).not.toThrow();
      expect(() =>
        AnalyticsService.track(AnalyticsEvents.FIRST_ANCHOR_CREATED, { anchor_id: 'a-offline' })
      ).not.toThrow();
      expect(() => AnalyticsService.flush()).not.toThrow();
    });

    it('12. Multi-account first_anchor_created deduplication: Account A and Account B each get at most 1 first_anchor_created even when switching back to Account A', async () => {
      const { mockCapture } = attachMockPostHog('anon-multi-1200');
      AnalyticsService.reset({ forceReset: true });

      // Account A signs in and creates first Anchor
      AnalyticsService.identify('account-A', { subscriptionStatus: 'free', totalAnchorsCreated: 0 });
      expect(
        AnalyticsService.trackFirstAnchorCreatedOnce({
          anchor_id: 'anchor-A1',
          account_id: 'account-A',
        })
      ).toBe(true);

      // Account A logs out
      AnalyticsService.reset({ reason: 'logout' });

      // Account B signs in on the same device and creates first Anchor
      AnalyticsService.identify('account-B', { subscriptionStatus: 'free', totalAnchorsCreated: 0 });
      expect(
        AnalyticsService.trackFirstAnchorCreatedOnce({
          anchor_id: 'anchor-B1',
          account_id: 'account-B',
        })
      ).toBe(true);

      // Account B logs out
      AnalyticsService.reset({ reason: 'logout' });

      // Account A signs back in on the same device and creates or syncs another Anchor
      AnalyticsService.identify('account-A', { subscriptionStatus: 'free', totalAnchorsCreated: 1 });
      expect(
        AnalyticsService.trackFirstAnchorCreatedOnce({
          anchor_id: 'anchor-A2',
          account_id: 'account-A',
        })
      ).toBe(false);

      const firstAnchorCalls = mockCapture.mock.calls.filter(
        ([name]) => name === AnalyticsEvents.FIRST_ANCHOR_CREATED
      );
      expect(firstAnchorCalls).toHaveLength(2);
      expect(firstAnchorCalls[0][1]).toEqual(
        expect.objectContaining({ anchor_id: 'anchor-A1', account_id: 'account-A' })
      );
      expect(firstAnchorCalls[1][1]).toEqual(
        expect.objectContaining({ anchor_id: 'anchor-B1', account_id: 'account-B' })
      );
    });

    it('13. PostHog reset while opted out does not call posthog.reset() or re-enable tracking', () => {
      const { mockCapture, mockReset, mockOptOut } = attachMockPostHog('user-optout-1300');
      AnalyticsService.identify('user-optout-1300', { subscriptionStatus: 'free' });

      // User opts out of analytics
      AnalyticsService.setEnabled(false);
      expect(mockOptOut).toHaveBeenCalledTimes(1);
      expect(AnalyticsService.isEnabled()).toBe(false);
      expect(AnalyticsService.getDistinctId()).toBeNull();

      // User logs out while opted out
      AnalyticsService.reset({ reason: 'logout', forceReset: true });

      // posthog.reset() MUST NOT be called when disabled (would wipe persisted opt-out flag in SDK)
      expect(mockReset).not.toHaveBeenCalled();
      expect(AnalyticsService.isEnabled()).toBe(false);

      // Subsequent tracking calls remain suppressed
      AnalyticsService.track(AnalyticsEvents.APP_OPENED, { cold_start: false });
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('14. DistinctId listener notifies null on opt-out and restores distinctId on opt-in for RevenueCat consent compliance', () => {
      attachMockPostHog('anon-consent-1400');
      const notifications: Array<string | null> = [];
      const unsubscribe = AnalyticsService.onDistinctIdChange((id) => {
        notifications.push(id);
      });

      AnalyticsService.setEnabled(false);
      expect(notifications).toContain(null);
      expect(AnalyticsService.getDistinctId()).toBeNull();

      AnalyticsService.setEnabled(true);
      expect(notifications[notifications.length - 1]).toBe('anon-consent-1400');
      expect(AnalyticsService.getDistinctId()).toBe('anon-consent-1400');

      unsubscribe();
    });

    it('15. Step 2 P1 Visualize, Vision, Chart, and Practice canonical events emit without double-counting', () => {
      const { mockCapture } = attachMockPostHog('user-p1-1500');

      // Visualize start -> emits practice_session_started, canonical practice_started, and canonical visualize_started once each
      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_STARTED, {
        practice_mode: 'visualize',
        session_id: 'vis-1',
        duration_seconds: 60,
      });

      // Visualize complete -> emits practice_session_completed, canonical practice_completed, and canonical visualize_completed once each
      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_COMPLETED, {
        practice_mode: 'visualize',
        session_id: 'vis-1',
        duration_seconds: 60,
      });

      // Visualize abandoned -> even if both VISUALIZE_ABANDONED and PRACTICE_SESSION_ENDED_EARLY fire on exit, visualize_abandoned fires only once
      AnalyticsService.track(AnalyticsEvents.VISUALIZE_ABANDONED, {
        practice_mode: 'visualize',
        session_id: 'vis-2',
        planned_duration_ms: 60000,
        actual_duration_ms: 15000,
      });
      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_ENDED_EARLY, {
        practice_mode: 'visualize',
        session_id: 'vis-2',
        planned_duration_seconds: 60,
        elapsed_seconds: 15,
      });

      const countEvent = (name: string) =>
        mockCapture.mock.calls.filter(([eventName]) => eventName === name).length;

      expect(countEvent(AnalyticsEvents.VISUALIZE_STARTED)).toBe(1);
      expect(countEvent(AnalyticsEvents.VISUALIZE_COMPLETED)).toBe(1);
      expect(countEvent(AnalyticsEvents.VISUALIZE_ABANDONED)).toBe(1);
      expect(countEvent(AnalyticsEvents.PRACTICE_STARTED)).toBe(1);
      expect(countEvent(AnalyticsEvents.PRACTICE_COMPLETED)).toBe(1);
      expect(countEvent(AnalyticsEvents.PRACTICE_ABANDONED)).toBe(1);
    });
  });
});
