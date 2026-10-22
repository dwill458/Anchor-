import { AnalyticsService } from '@/services/AnalyticsService';
import { OnboardingAnalytics, stepFor } from '../onboardingAnalytics';

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));

const track = AnalyticsService.track as jest.Mock;

describe('OnboardingAnalytics', () => {
  beforeEach(() => { jest.clearAllMocks(); OnboardingAnalytics.reset(); });

  it.each([
    ['welcome', 'welcome'], ['bridge', 'bridge'], ['motivation', 'motivation'],
    ['outcome', 'motivation'], ['meaning', 'motivation'], ['friction', 'motivation'], ['system', 'motivation'],
    ['handoff', 'motivation'], ['life', 'motivation'], ['need', 'motivation'], ['summary', 'motivation'],
    ['creation', 'creation'], ['intention', 'creation'], ['formation', 'creation'], ['anchor', 'creation'], ['expression', 'creation'],
    ['auth', 'save'], ['vision', 'save'], ['focus', 'save'], ['complete', 'complete'], ['future_step', 'future_step'],
  ])('maps %s to %s', (raw, expected) => expect(stepFor(raw)).toBe(expected));

  it('does not emit for changes within the creation group', () => {
    OnboardingAnalytics.started('creation');
    OnboardingAnalytics.stepChanged(undefined, 'creation');
    track.mockClear();
    OnboardingAnalytics.stepChanged('intention', 'formation');
    expect(track).not.toHaveBeenCalled();
  });

  it('classifies forward and backward movement', () => {
    OnboardingAnalytics.started('welcome');
    OnboardingAnalytics.stepChanged(undefined, 'welcome');
    OnboardingAnalytics.stepChanged('welcome', 'bridge');
    OnboardingAnalytics.stepChanged('bridge', 'welcome');
    expect(track.mock.calls.filter(([name]) => name === 'onboarding_step_completed').map(([, props]) => props.exit))
      .toEqual(['continue', 'back']);
  });

  it('emits started only once per app session', () => {
    OnboardingAnalytics.started('welcome');
    OnboardingAnalytics.started('bridge');
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('onboarding_started', expect.objectContaining({ resumed: false, restored_step: 'welcome' }));
  });

  it.each([
    ['An account already exists for this email', 'email_in_use'],
    ['auth/wrong-password', 'bad_credentials'], ['incorrect credential', 'bad_credentials'],
    ['auth/user-not-found', 'user_not_found'], ['No user found', 'user_not_found'], ['invalid-email', 'invalid_email'],
    ['Password weak: at least 8 characters', 'weak_password'], ['network unavailable', 'network'], ['request cancelled', 'cancelled'],
    ['unexpected private error', 'unknown'],
  ])('classifies auth error without returning its message', (message, expected) => {
    const code = OnboardingAnalytics.classifyAuthError(message);
    expect(code).toBe(expected);
    expect(code).not.toContain(message);
  });

  it('classifies provider error objects by their message without returning it', () => {
    expect(OnboardingAnalytics.classifyAuthError({ message: 'auth/network-request-failed private data' })).toBe('network');
  });

  it('attributes save failures to the supplied auth context and survives tracking errors', () => {
    OnboardingAnalytics.auth.saveFailed('v2_auth', 'unknown');
    OnboardingAnalytics.auth.saveFailed('onboarding_save', 'network');
    expect(track).toHaveBeenNthCalledWith(1, 'anchor_save_failed', { context: 'v2_auth', error_code: 'unknown' });
    expect(track).toHaveBeenNthCalledWith(2, 'anchor_save_failed', { context: 'onboarding_save', error_code: 'network' });

    track.mockImplementation(() => { throw new Error('track failed'); });
    expect(() => OnboardingAnalytics.auth.saveFailed('v2_auth', 'unknown')).not.toThrow();
  });

  it('never passes sensitive property names and survives tracking errors', () => {
    OnboardingAnalytics.started('welcome');
    OnboardingAnalytics.stepChanged(undefined, 'welcome');
    OnboardingAnalytics.cta('welcome', 'start');
    OnboardingAnalytics.auth.started('v2_auth', 'email', 'signin');
    for (const [, properties] of track.mock.calls) {
      expect(Object.keys(properties)).not.toEqual(expect.arrayContaining(['email', 'message', 'text', 'intention']));
    }
    track.mockImplementation(() => { throw new Error('track failed'); });
    expect(() => OnboardingAnalytics.backgrounded('welcome')).not.toThrow();
    expect(() => OnboardingAnalytics.auth.failed('v2_auth', 'email', 'signin', 'provider', 'unknown')).not.toThrow();
  });
});
