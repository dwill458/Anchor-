import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

const mockGetOfferingDisplayMetadata = jest.fn();
let mockReduceMotion = false;

jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({
  useV2ReduceMotion: () => mockReduceMotion,
  useCreationReduceMotion: () => mockReduceMotion,
}));
jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { ...actual, __esModule: true, withDelay: jest.fn(actual.withDelay), withRepeat: jest.fn(actual.withRepeat) };
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
jest.mock('@/hooks/v2/vision', () => ({
  __esModule: true,
  useV2Vision: () => ({ state: { state: 'none', anchorId: '' }, refresh: jest.fn() }),
}));

import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { PAYWALL_TIMING } from '@/components/v2/paywall/twoStep';
import { V2PaywallScreen } from '../V2PaywallScreen';

const withDelay = Reanimated.withDelay as jest.Mock;
const withRepeat = Reanimated.withRepeat as jest.Mock;
const METADATA = {
  offeringId: 'anchor_pro',
  annual: { planId: 'annual', packageId: '$rc_annual', price: 59.99, priceString: '$59.99', currencyCode: 'USD', trialEligible: true },
  weekly: { planId: 'weekly', packageId: '$rc_weekly', price: 1.99, priceString: '$1.99', currencyCode: 'USD', trialEligible: false },
  monthly: { planId: 'monthly', packageId: '$rc_monthly', price: 7.99, priceString: '$7.99', currencyCode: 'USD', trialEligible: false },
};
const noop = () => {};
const delays = () => withDelay.mock.calls.map(([delay]) => delay as number);

beforeEach(() => {
  mockReduceMotion = false;
  withDelay.mockClear();
  withRepeat.mockClear();
  mockGetOfferingDisplayMetadata.mockResolvedValue(METADATA);
  useSubscriptionStore.setState({
    trialStartDate: null, isInTrial: false, isSubscribed: false, hasActiveEntitlement: false,
    trialExpired: false, entitlementReady: true, remoteCompedAccess: false, legacyMigrationAccess: false,
    devOverrideEnabled: false, subscriptionStatus: 'expired',
  } as never);
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
});

describe('V2PaywallScreen motion', () => {
  it('stages the offer in on the 70 ms stagger with the medallion, route and sheen timings', async () => {
    render(<V2PaywallScreen context="PRACTICE" onDismiss={noop} onEntitled={noop} />);
    expect(await screen.findByTestId('v2-paywall-close')).toBeTruthy();
    const t = PAYWALL_TIMING;
    // Copy rises from 140 ms, 70 ms apart (headline … dots = 8 items).
    for (let i = 0; i < 8; i += 1) expect(delays()).toContain(t.introRiseDelayMs + i * t.riseStaggerMs);
    expect(delays()).toContain(t.medallionDelayMs);
    expect(delays()).toContain(t.underlineDelayMs);
    expect(delays()).toContain(t.routeDelayMs);
    expect(delays()).toContain(t.flagAtMs);
    expect(delays()).toContain(t.sheenIntroDelayMs);
    // Ambient loops: medallion float, idle CTA sheen, practice play ring.
    expect(withRepeat).toHaveBeenCalled();
  });

  it('replays the sheen and staggers step-2 copy after Continue, without replaying on plan change', async () => {
    render(<V2PaywallScreen context="PRACTICE" onDismiss={noop} onEntitled={noop} />);
    fireEvent.press(await screen.findByTestId('v2-paywall-continue'));
    await screen.findByText('$59.99 / year');
    const t = PAYWALL_TIMING;
    expect(delays()).toContain(t.sheenStepDelayMs);
    expect(delays()).toContain(t.stepRiseDelayMs + 2 * t.riseStaggerMs);
    expect(delays()).toContain(t.timelineDelayMs);

    const afterStep = withDelay.mock.calls.length;
    fireEvent.press(screen.getByTestId('v2-paywall-plan-weekly'));
    await waitFor(() => expect(screen.getByTestId('v2-paywall-plan-weekly').props.accessibilityState.checked).toBe(true));
    expect(withDelay.mock.calls.length).toBe(afterStep);
  });

  it('resolves instantly with no delays, loops or sheen under reduced motion', async () => {
    mockReduceMotion = true;
    render(<V2PaywallScreen context="PRACTICE" onDismiss={noop} onEntitled={noop} />);
    fireEvent.press(await screen.findByTestId('v2-paywall-continue'));
    await screen.findByText('$59.99 / year');
    expect(withDelay).not.toHaveBeenCalled();
    expect(withRepeat).not.toHaveBeenCalled();
  });

  it('shows the trial-ended panel with both plans, arriving', async () => {
    useSubscriptionStore.setState({ trialExpired: true } as never);
    render(<V2PaywallScreen context="TRIAL_ENDED" onDismiss={noop} onEntitled={noop} />);
    expect(await screen.findByTestId('v2-paywall-plan-annual')).toBeTruthy();
    expect(screen.getByTestId('v2-paywall-plan-monthly')).toBeTruthy();
    expect(withDelay).toHaveBeenCalled();
  });
});
