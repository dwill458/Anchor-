import { AnalyticsEvents, AnalyticsService } from '../AnalyticsService';
import { FrictionAnalytics } from '../FrictionAnalytics';

describe('FrictionAnalytics', () => {
  let trackSpy: jest.SpyInstance;

  beforeEach(() => {
    FrictionAnalytics.reset();
    trackSpy = jest.spyOn(AnalyticsService, 'track').mockImplementation(() => undefined);
  });

  afterEach(() => {
    trackSpy.mockRestore();
  });

  it('starts a flow and tracks a viewed route step', () => {
    FrictionAnalytics.trackRouteViewed('AIGenerating', {
      anchor_count: 1,
      subscription_status: 'trial',
    });

    expect(trackSpy).toHaveBeenCalledWith(
      AnalyticsEvents.FLOW_STARTED,
      expect.objectContaining({
        flow: 'anchor_creation',
        anchor_count: 1,
        subscription_status: 'trial',
        flow_session_id: expect.stringContaining('anchor_creation_'),
      })
    );
    expect(trackSpy).toHaveBeenCalledWith(
      AnalyticsEvents.FLOW_STEP_VIEWED,
      expect.objectContaining({
        flow: 'anchor_creation',
        step: 'ai_generating',
        route_name: 'AIGenerating',
        source: 'navigation',
      })
    );
  });

  it('tracks retries with incrementing attempts', () => {
    FrictionAnalytics.startFlow('anchor_creation');

    FrictionAnalytics.flowRetry('anchor_creation', 'ai_generating');
    FrictionAnalytics.flowRetry('anchor_creation', 'ai_generating');

    expect(trackSpy).toHaveBeenLastCalledWith(
      AnalyticsEvents.FLOW_RETRY,
      expect.objectContaining({
        flow: 'anchor_creation',
        step: 'ai_generating',
        attempt: 2,
      })
    );
  });

  it('completes and resets a flow session', () => {
    FrictionAnalytics.startFlow('paywall');
    FrictionAnalytics.completeFlow('paywall', { source: 'post_trial' });
    FrictionAnalytics.stepViewed('paywall', 'paywall');

    const startedCalls = trackSpy.mock.calls.filter(
      ([eventName]) => eventName === AnalyticsEvents.FLOW_STARTED
    );

    expect(startedCalls).toHaveLength(2);
    expect(trackSpy).toHaveBeenCalledWith(
      AnalyticsEvents.FLOW_COMPLETED,
      expect.objectContaining({
        flow: 'paywall',
        source: 'post_trial',
        duration_ms: expect.any(Number),
      })
    );
  });
});
