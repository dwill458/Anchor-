import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

const mockGetOfferingDisplayMetadata = jest.fn();

jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => false, useCreationReduceMotion: () => false }));
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { ...actual, __esModule: true, withDelay: jest.fn(actual.withDelay) };
});
jest.mock('@/services/RevenueCatService', () => ({
  __esModule: true,
  default: {
    purchasePackageByIdentifier: jest.fn(),
    restorePurchases: jest.fn().mockResolvedValue({ hasActiveEntitlement: false }),
    getOfferingDisplayMetadata: (...a: unknown[]) => mockGetOfferingDisplayMetadata(...a),
  },
}));
jest.mock('@/services/BillingService', () => ({
  __esModule: true,
  refreshServerEntitlement: jest.fn().mockResolvedValue({ hasActiveEntitlement: true }),
}));
jest.mock('@/adapters/v2/paywall/trialActivation', () => ({
  __esModule: true,
  activateV2Trial: jest.fn().mockResolvedValue({ status: 'activated', trialState: 'TRIAL_ACTIVE' }),
}));

import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { V2PaywallScreen } from '../V2PaywallScreen';

const withDelay = Reanimated.withDelay as jest.Mock;
const METADATA = {
  offeringId: 'anchor_pro',
  annual: { planId: 'annual', packageId: '$rc_annual', price: 59.99, priceString: '$59.99', currencyCode: 'USD', trialEligible: true },
  monthly: { planId: 'monthly', packageId: '$rc_monthly', price: 7.99, priceString: '$7.99', currencyCode: 'USD', trialEligible: false },
};
const noop = () => {};

beforeEach(() => {
  withDelay.mockClear();
  mockGetOfferingDisplayMetadata.mockResolvedValue(METADATA);
  useSubscriptionStore.setState({
    trialStartDate: null, isInTrial: false, isSubscribed: false, hasActiveEntitlement: false,
    trialExpired: true, entitlementReady: true, remoteCompedAccess: false, legacyMigrationAccess: false,
    devOverrideEnabled: false, subscriptionStatus: 'expired',
  } as never);
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
});

describe('V2PaywallScreen motion', () => {
  it('stages the contextual sheet in once and keeps its controls on screen', async () => {
    render(<V2PaywallScreen context="PRACTICE" onDismiss={noop} onEntitled={noop} />);
    expect(await screen.findByTestId('v2-paywall-close')).toBeTruthy();
    expect(screen.getByTestId('v2-paywall-view-plans')).toBeTruthy();
    expect(withDelay).toHaveBeenCalled();
    const longest = Math.max(...withDelay.mock.calls.map(([delay]) => delay as number));
    expect(longest).toBeLessThanOrEqual(6 * 60);
  });

  it('shows the trial-ended panel with both plans, arriving', async () => {
    render(<V2PaywallScreen context="TRIAL_ENDED" onDismiss={noop} onEntitled={noop} />);
    expect(await screen.findByTestId('v2-paywall-plan-annual')).toBeTruthy();
    expect(screen.getByTestId('v2-paywall-plan-monthly')).toBeTruthy();
    expect(withDelay).toHaveBeenCalled();
  });

  it('selects a plan on press without replaying the arrival, and tracks the touch', async () => {
    const view = render(<V2PaywallScreen context="TRIAL_ENDED" onDismiss={noop} onEntitled={noop} />);
    const monthly = await screen.findByTestId('v2-paywall-plan-monthly');
    await waitFor(() => expect(monthly.props.accessibilityState.disabled).toBe(false));
    const afterMount = withDelay.mock.calls.length;
    const tracked = view.UNSAFE_root.findAll(
      (node: { props?: Record<string, unknown> }) => node.props?.testID === 'v2-paywall-plan-monthly' && typeof node.props.onPressIn === 'function',
    );
    expect(tracked.length).toBeGreaterThan(0);
    fireEvent.press(monthly);
    await waitFor(() => expect(screen.getByTestId('v2-paywall-plan-monthly').props.accessibilityState.selected).toBe(true));
    expect(withDelay.mock.calls.length).toBe(afterMount);
  });
});
