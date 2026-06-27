import { renderHook } from '@testing-library/react-native';
import { useTrialStatus } from '../useTrialStatus';

let mockState = {
  subscriptionStatus: 'trial' as 'trial' | 'active' | 'expired',
  trialStartDate: null as string | null,
  remoteCompedAccess: false,
  devOverrideEnabled: false,
  devTierOverride: 'pro' as 'free' | 'pro' | 'trial' | 'expired',
  rcSynced: false,
  hasActiveEntitlement: false,
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
      hasActiveEntitlement: false,
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
      hasActiveEntitlement: false,
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
      hasActiveEntitlement: false,
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
      hasActiveEntitlement: false,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.hasActiveEntitlement).toBe(true);
    expect(result.current.subscriptionStatus).toBe('active');
  });

  it('returns expired when trialStartDate is null and status is trial', () => {
    mockState = {
      subscriptionStatus: 'trial',
      trialStartDate: null,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
      rcSynced: false,
      hasActiveEntitlement: false,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isTrialActive).toBe(false);
    expect(result.current.hasExpired).toBe(true);
  });

  it('does not grant trial access when RC has synced but the local trial is unstamped', () => {
    // RC syncs during onboarding and returns hasActiveEntitlement=false (no paid sub).
    // Trial access should require the local timestamp stamped during account/session setup.
    mockState = {
      subscriptionStatus: 'trial',
      trialStartDate: null,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
      rcSynced: true,
      hasActiveEntitlement: false,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isTrialActive).toBe(false);
    expect(result.current.hasExpired).toBe(true);
  });

  it('does not expire a user mid-trial when RC has synced with no paid entitlement', () => {
    // RC syncs after trial is stamped. RC returns no paid entitlement (normal for trial users).
    // Trial has 5 days left — should still be active.
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mockState = {
      subscriptionStatus: 'trial',
      trialStartDate: fiveDaysAgo,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
      devTierOverride: 'pro',
      rcSynced: true,
      hasActiveEntitlement: false,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isTrialActive).toBe(true);
    expect(result.current.hasExpired).toBe(false);
    expect(result.current.daysRemaining).toBe(2);
  });
});
