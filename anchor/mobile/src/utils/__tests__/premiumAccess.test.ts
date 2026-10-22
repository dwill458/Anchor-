import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isProFeatureLocked } from '../premiumAccess';

const base = {
  devOverrideEnabled: false,
  devTierOverride: 'pro' as const,
  remoteCompedAccess: false,
  legacyMigrationAccess: false,
  hasActiveEntitlement: false,
  entitlementReady: true,
};

beforeEach(() => {
  useSubscriptionStore.setState(base);
  useSettingsStore.setState({ developerMasterAccountEnabled: false } as never);
});

describe('isProFeatureLocked', () => {
  it('locks a Free user and unlocks an entitled one', () => {
    expect(isProFeatureLocked()).toBe(true);
    useSubscriptionStore.setState({ hasActiveEntitlement: true });
    expect(isProFeatureLocked()).toBe(false);
  });

  it('defers to the server until RevenueCat has answered', () => {
    useSubscriptionStore.setState({ entitlementReady: false });
    expect(isProFeatureLocked()).toBe(false);
  });

  it('follows a dev tier override even before RevenueCat answers, and over the master account', () => {
    useSettingsStore.setState({ developerMasterAccountEnabled: true } as never);
    useSubscriptionStore.setState({ entitlementReady: false, hasActiveEntitlement: true, devOverrideEnabled: true, devTierOverride: 'expired' });
    expect(isProFeatureLocked()).toBe(true);
    useSubscriptionStore.setState({ devTierOverride: 'trial' });
    expect(isProFeatureLocked()).toBe(false);
  });
});
