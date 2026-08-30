import { renderHook } from '@testing-library/react-native';
import { useTrialStatus } from '../useTrialStatus';

let mockState = {
  subscriptionStatus: 'trial' as 'trial' | 'active' | 'expired',
  trialStartDate: null as string | null,
  remoteCompedAccess: false,
  devOverrideEnabled: false,
  devTierOverride: 'pro' as 'free' | 'pro' | 'trial' | 'expired',
  rcSynced: false,
  isInTrial: false,
  isSubscribed: false,
  hasActiveEntitlement: false,
  daysRemaining: null as number | null,
  trialExpired: false,
  entitlementReady: false,
};

jest.mock('@/stores/subscriptionStore', () => ({
  useSubscriptionStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
  computeDaysRemaining: (trialStartDate: string | null) => {
    if (!trialStartDate) return 0;
    const start = new Date(trialStartDate).getTime();
    const elapsedDays = Math.floor((Date.now() - start) / 86_400_000);
    return Math.max(0, 7 - elapsedDays);
  },
}));

jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: { developerMasterAccountEnabled: boolean }) => unknown) =>
    selector({ developerMasterAccountEnabled: false }),
}));

describe('useTrialStatus', () => {
  it('returns active trial state', () => {
    mockState = {
      subscriptionStatus: 'trial',
      trialStartDate: new Date().toISOString(),
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
      rcSynced: false,
      isInTrial: true,
      isSubscribed: false,
      hasActiveEntitlement: true,
      daysRemaining: 6,
      trialExpired: false,
      entitlementReady: true,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isTrialActive).toBe(true);
    expect(result.current.hasActiveEntitlement).toBe(true);
  });

  it('returns subscribed state', () => {
    mockState = {
      subscriptionStatus: 'active',
      trialStartDate: null,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
      rcSynced: false,
      isInTrial: false,
      isSubscribed: true,
      hasActiveEntitlement: true,
      daysRemaining: null,
      trialExpired: false,
      entitlementReady: true,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.hasActiveEntitlement).toBe(true);
  });

  it('returns expired state', () => {
    mockState = {
      subscriptionStatus: 'expired',
      trialStartDate: null,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
      rcSynced: false,
      isInTrial: false,
      isSubscribed: false,
      hasActiveEntitlement: false,
      daysRemaining: null,
      trialExpired: true,
      entitlementReady: true,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.trialExpired).toBe(true);
    expect(result.current.hasActiveEntitlement).toBe(false);
  });

  it('treats remote comped access as subscribed', () => {
    mockState = {
      subscriptionStatus: 'expired',
      trialStartDate: null,
      remoteCompedAccess: true,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
      rcSynced: false,
      isInTrial: false,
      isSubscribed: false,
      hasActiveEntitlement: false,
      daysRemaining: null,
      trialExpired: true,
      entitlementReady: true,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.hasActiveEntitlement).toBe(true);
    expect(result.current.subscriptionStatus).toBe('active');
  });

  it('returns expired when no RevenueCat entitlement is active', () => {
    mockState = {
      subscriptionStatus: 'trial',
      trialStartDate: null,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
      rcSynced: false,
      hasActiveEntitlement: false,
      isInTrial: false,
      isSubscribed: false,
      daysRemaining: null,
      trialExpired: true,
      entitlementReady: true,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isTrialActive).toBe(false);
    expect(result.current.hasExpired).toBe(true);
  });

  it('keeps a new user Free when RC has synced with no paid entitlement (post-onboarding race)', () => {
    // RC syncs during onboarding and returns no paid entitlement. Signup does
    // not seed a local trial, so this remains Free.
    mockState = {
      subscriptionStatus: 'expired',
      trialStartDate: null,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
      rcSynced: true,
      isInTrial: false,
      isSubscribed: false,
      hasActiveEntitlement: false,
      daysRemaining: null,
      trialExpired: true,
      entitlementReady: true,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isTrialActive).toBe(false);
    expect(result.current.hasExpired).toBe(true);
  });

  it('keeps a user Free when RC has synced with no paid entitlement', () => {
    // A store lookup without an active canonical entitlement is Free.
    mockState = {
      subscriptionStatus: 'expired',
      trialStartDate: null,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
      rcSynced: true,
      isInTrial: false,
      isSubscribed: false,
      hasActiveEntitlement: false,
      daysRemaining: null,
      trialExpired: true,
      entitlementReady: true,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isTrialActive).toBe(false);
    expect(result.current.hasExpired).toBe(true);
    expect(result.current.daysRemaining).toBe(0);
  });
});
