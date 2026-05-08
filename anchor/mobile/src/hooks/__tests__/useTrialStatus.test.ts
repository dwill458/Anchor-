import { renderHook } from '@testing-library/react-hooks';
import { useTrialStatus } from '../useTrialStatus';

let mockState = {
  subscriptionStatus: 'trial' as 'trial' | 'active' | 'expired',
  trialStartDate: null as string | null,
  remoteCompedAccess: false,
  devOverrideEnabled: false,
  devTierOverride: 'pro' as 'free' | 'pro' | 'trial' | 'expired',
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
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.hasActiveEntitlement).toBe(true);
    expect(result.current.subscriptionStatus).toBe('active');
  });
});
