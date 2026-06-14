/**
 * subscriptionStore Tests
 */

import { renderHook, act } from '@testing-library/react-native';
import { useSubscriptionStore } from '../subscriptionStore';

// Reset the store state before each test
beforeEach(() => {
  const { result } = renderHook(() => useSubscriptionStore());
  act(() => {
    result.current.setRcTier('free');
    result.current.resetOverrides();
    result.current.setRemoteCompedAccess(false);
    useSubscriptionStore.setState({
      trialStartDate: null,
      subscriptionStatus: 'expired',
      remoteCompedAccess: false,
      hasActiveEntitlement: false,
      rcSynced: false,
      preferredPlanId: 'annual',
    });
  });
});

describe('subscriptionStore', () => {
  describe('initial state', () => {
    it('starts with free tier', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      expect(result.current.rcTier).toBe('free');
    });

    it('starts with dev override disabled', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      expect(result.current.devOverrideEnabled).toBe(false);
    });

    it('starts with devTierOverride as pro', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      expect(result.current.devTierOverride).toBe('pro');
    });
  });

  describe('setRcTier', () => {
    it('updates rcTier to pro', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => result.current.setRcTier('pro'));
      expect(result.current.rcTier).toBe('pro');
    });

    it('updates rcTier back to free', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => {
        result.current.setRcTier('pro');
        result.current.setRcTier('free');
      });
      expect(result.current.rcTier).toBe('free');
    });
  });

  describe('setDevOverrideEnabled', () => {
    it('enables the dev override', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => result.current.setDevOverrideEnabled(true));
      expect(result.current.devOverrideEnabled).toBe(true);
    });

    it('disables the dev override', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => {
        result.current.setDevOverrideEnabled(true);
        result.current.setDevOverrideEnabled(false);
      });
      expect(result.current.devOverrideEnabled).toBe(false);
    });
  });

  describe('setDevTierOverride', () => {
    it('sets the dev tier override to free', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => result.current.setDevTierOverride('free'));
      expect(result.current.devTierOverride).toBe('free');
    });

    it('sets the dev tier override to trial', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => result.current.setDevTierOverride('trial'));
      expect(result.current.devTierOverride).toBe('trial');
    });
  });

  describe('resetOverrides', () => {
    it('resets devOverrideEnabled to false', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => {
        result.current.setDevOverrideEnabled(true);
        result.current.resetOverrides();
      });
      expect(result.current.devOverrideEnabled).toBe(false);
    });

    it('resets devTierOverride to pro', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => {
        result.current.setDevTierOverride('free');
        result.current.resetOverrides();
      });
      expect(result.current.devTierOverride).toBe('pro');
    });
  });

  describe('getEffectiveTier', () => {
    it('returns free when rcTier is free and override is disabled', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      expect(result.current.getEffectiveTier()).toBe('free');
    });

    it('returns pro for an active account trial after RevenueCat has synced without entitlement', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => {
        result.current.syncAccountTrial(new Date().toISOString());
        result.current.setRcSynced(true);
      });
      expect(result.current.getEffectiveTier()).toBe('pro');
    });

    it('does not grant pro for a trial without a start date', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => {
        useSubscriptionStore.setState({
          subscriptionStatus: 'trial',
          trialStartDate: null,
          rcSynced: true,
          hasActiveEntitlement: false,
        });
      });
      expect(result.current.getEffectiveTier()).toBe('free');
    });

    it('expires an account trial after the trial window', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000).toISOString();
      act(() => {
        result.current.syncAccountTrial(eightDaysAgo);
      });
      expect(result.current.subscriptionStatus).toBe('expired');
      expect(result.current.getEffectiveTier()).toBe('free');
    });

    it('returns pro when rcTier starts with pro', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => result.current.setRcTier('pro'));
      expect(result.current.getEffectiveTier()).toBe('pro');
    });

    it('returns pro when devOverrideEnabled and devTierOverride is pro', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => {
        result.current.setDevOverrideEnabled(true);
        result.current.setDevTierOverride('pro');
      });
      expect(result.current.getEffectiveTier()).toBe('pro');
    });

    it('returns pro when devOverrideEnabled and devTierOverride is trial', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => {
        result.current.setDevOverrideEnabled(true);
        result.current.setDevTierOverride('trial');
      });
      expect(result.current.getEffectiveTier()).toBe('pro');
    });

    it('returns free when devOverrideEnabled and devTierOverride is free', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => {
        result.current.setDevOverrideEnabled(true);
        result.current.setDevTierOverride('free');
      });
      expect(result.current.getEffectiveTier()).toBe('free');
    });

    it('returns pro when remote comped access is enabled', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => {
        result.current.setRemoteCompedAccess(true);
      });
      expect(result.current.getEffectiveTier()).toBe('pro');
    });

    it('ignores dev override when devOverrideEnabled is false', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => {
        result.current.setDevOverrideEnabled(false);
        result.current.setDevTierOverride('pro');
        result.current.setRcTier('free');
      });
      expect(result.current.getEffectiveTier()).toBe('free');
    });
  });

  describe('preferredPlanId', () => {
    it('persists the selected plan preference', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      act(() => result.current.setPreferredPlanId('monthly'));
      expect(result.current.preferredPlanId).toBe('monthly');
    });
  });
});
