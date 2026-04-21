import { renderHook } from '@testing-library/react-hooks';
import { useTrialStatus } from '../useTrialStatus';

let mockState = {
  isInTrial: false,
  isSubscribed: false,
  hasActiveEntitlement: false,
  daysRemaining: null as number | null,
  trialExpired: false,
};

jest.mock('@/stores/subscriptionStore', () => ({
  useSubscriptionStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

describe('useTrialStatus', () => {
  it('returns active trial state', () => {
    mockState = {
      isInTrial: true,
      isSubscribed: false,
      hasActiveEntitlement: true,
      daysRemaining: 7,
      trialExpired: false,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current).toEqual(mockState);
  });

  it('returns subscribed state', () => {
    mockState = {
      isInTrial: false,
      isSubscribed: true,
      hasActiveEntitlement: true,
      daysRemaining: null,
      trialExpired: false,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.hasActiveEntitlement).toBe(true);
  });

  it('returns expired state', () => {
    mockState = {
      isInTrial: false,
      isSubscribed: false,
      hasActiveEntitlement: false,
      daysRemaining: 0,
      trialExpired: true,
    };

    const { result } = renderHook(() => useTrialStatus());

    expect(result.current.trialExpired).toBe(true);
    expect(result.current.hasActiveEntitlement).toBe(false);
  });
});
