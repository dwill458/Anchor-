/**
 * AnalyticsService Tests
 */

import { AnalyticsService, AnalyticsEvents } from '../AnalyticsService';

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
    });
  });
});
