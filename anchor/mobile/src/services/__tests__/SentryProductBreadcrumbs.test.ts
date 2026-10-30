import { AnalyticsService, AnalyticsEvents } from '../AnalyticsService';
import { ErrorTrackingService } from '../ErrorTrackingService';

describe('Sentry product breadcrumbs', () => {
  beforeEach(() => { AnalyticsService.setEnabled(true); AnalyticsService.setContextProvider(() => ({ experience_version: '2.0' })); });
  afterEach(() => { jest.restoreAllMocks(); AnalyticsService.setContextProvider(null); });

  it('records known 2.0 events without their potentially private properties', () => {
    const breadcrumb = jest.spyOn(ErrorTrackingService, 'addBreadcrumb').mockImplementation(() => {});
    AnalyticsService.track('onboarding_started', { intention: 'private', anchor_id: '123' });
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_STARTED, { text: 'private' });
    expect(breadcrumb).toHaveBeenCalledWith('onboarding_started', 'product.2.0');
    expect(breadcrumb).toHaveBeenCalledWith(AnalyticsEvents.PRACTICE_SESSION_STARTED, 'product.2.0');
  });

  it('does not record unknown names, opted-out events, or 1.5 events', () => {
    const breadcrumb = jest.spyOn(ErrorTrackingService, 'addBreadcrumb').mockImplementation(() => {});
    AnalyticsService.track('private arbitrary text');
    AnalyticsService.setContextProvider(() => ({ experience_version: '1.5' }));
    AnalyticsService.track('onboarding_started');
    AnalyticsService.setEnabled(false);
    AnalyticsService.track('onboarding_started');
    expect(breadcrumb).not.toHaveBeenCalled();
  });

  it('does not interrupt analytics if Sentry throws', () => {
    jest.spyOn(ErrorTrackingService, 'addBreadcrumb').mockImplementation(() => { throw new Error('sentry'); });
    expect(() => AnalyticsService.track('onboarding_started')).not.toThrow();
  });
});
