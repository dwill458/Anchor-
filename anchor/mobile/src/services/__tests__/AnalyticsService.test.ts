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

    /**
     * Decision D7 — the privacy half.
     *
     * The Chart event taxonomy is still awaiting approval, but the rule that
     * governs it is not: Chart analytics may carry opaque IDs only. Course
     * destinations, waypoint titles, and reflection content are user-authored
     * and must never leave the device. This asserts the rule holds regardless of
     * which event names are eventually approved.
     */
    it('strips every Chart free-text property while keeping opaque IDs', () => {
      expect(
        sanitizeAnalyticsProperties({
          course_id: 'course-chart-phase0',
          waypoint_id: 'wp-current',
          course_version: 7,
          waypoint_state: 'CURRENT',
          destination_text: 'Build a steadier creative practice',
          destinationText: 'Build a steadier creative practice',
          destination: 'Build a steadier creative practice',
          waypoint_title: 'DEEPEN THE PRACTICE',
          waypointTitle: 'DEEPEN THE PRACTICE',
          reflection: 'private reflection',
          reflection_body: 'private body',
          reflectionBody: 'private body',
          structured_content: { whatHelped: 'private' },
          structuredContent: { whatHelped: 'private' },
          what_helped: 'private',
          whatHelped: 'private',
        })
      ).toEqual({
        course_id: 'course-chart-phase0',
        waypoint_id: 'wp-current',
        course_version: 7,
        waypoint_state: 'CURRENT',
      });
    });

    it('strips Chart free text nested inside a practice-session payload', () => {
      expect(
        sanitizeAnalyticsProperties({
          source: 'chart_waypoint_detail',
          chart_context: {
            course_id: 'course-chart-phase0',
            waypoint_id: 'wp-current',
            destination_text: 'Build a steadier creative practice',
            waypoint_title: 'DEEPEN THE PRACTICE',
          },
        })
      ).toEqual({
        source: 'chart_waypoint_detail',
        chart_context: {
          course_id: 'course-chart-phase0',
          waypoint_id: 'wp-current',
        },
      });
    });
  });
});
