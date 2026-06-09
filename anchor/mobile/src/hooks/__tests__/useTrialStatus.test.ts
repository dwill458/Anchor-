import { renderHook } from '@testing-library/react-native';
import { useTrialStatus } from '../useTrialStatus';

let mockState = {
  subscriptionStatus: 'expired' as 'trial' | 'active' | 'expired',
  isInTrial: false,
  isSubscribed: false,
  hasActiveEntitlement: false,
  daysRemaining: null as number | null,
  trialExpired: false,
  remoteCompedAccess: false,
  devOverrideEnabled: false,
  devTierOverride: 'pro' as 'free' | 'pro' | 'trial' | 'expired',
};

jest.mock('@/stores/subscriptionStore', () => ({
  useSubscriptionStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: { developerMasterAccountEnabled: boolean }) => unknown) =>
    selector({ developerMasterAccountEnabled: false }),
}));

describe('useTrialStatus', () => {
  it('returns active trial state from RevenueCat-backed snapshot', () => {
    mockState = {
      subscriptionStatus: 'trial',
      isInTrial: true,
      isSubscribed: false,
      hasActiveEntitlement: true,
      daysRemaining: 6,
      trialExpired: false,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isTrialActive).toBe(true);
    expect(result.current.hasActiveEntitlement).toBe(true);
    expect(result.current.daysRemaining).toBe(6);
  });

  it('returns subscribed state', () => {
    mockState = {
      subscriptionStatus: 'active',
      isInTrial: false,
      isSubscribed: true,
      hasActiveEntitlement: true,
      daysRemaining: null,
      trialExpired: false,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.hasActiveEntitlement).toBe(true);
  });

  it('returns expired state', () => {
    mockState = {
      subscriptionStatus: 'expired',
      isInTrial: false,
      isSubscribed: false,
      hasActiveEntitlement: false,
      daysRemaining: 0,
      trialExpired: true,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.trialExpired).toBe(true);
    expect(result.current.hasActiveEntitlement).toBe(false);
  });

  it('treats remote comped access as subscribed', () => {
    mockState = {
      subscriptionStatus: 'expired',
      isInTrial: false,
      isSubscribed: false,
      hasActiveEntitlement: false,
      daysRemaining: 0,
      trialExpired: true,
      remoteCompedAccess: true,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.hasActiveEntitlement).toBe(true);
    expect(result.current.subscriptionStatus).toBe('active');
  });

  it('keeps a persisted trial active before the next RevenueCat refresh', () => {
    mockState = {
      subscriptionStatus: 'trial',
      isInTrial: false,
      isSubscribed: false,
      hasActiveEntitlement: false,
      daysRemaining: null,
      trialExpired: false,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isTrialActive).toBe(true);
    expect(result.current.hasExpired).toBe(false);
    expect(result.current.daysRemaining).toBe(0);
  });
});
