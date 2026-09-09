import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockPurchase = jest.fn();
const mockRestore = jest.fn();
const mockGetOfferingDisplayMetadata = jest.fn();

jest.mock('@/services/RevenueCatService', () => ({
  __esModule: true,
  default: {
    purchasePackageByIdentifier: (...a: unknown[]) => mockPurchase(...a),
    restorePurchases: (...a: unknown[]) => mockRestore(...a),
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
import { useSettingsStore } from '@/stores/settingsStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useVisualizationSceneStore } from '@/stores/visualizationSceneStore';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { V2PaywallScreen } from '../V2PaywallScreen';

const METADATA = {
  offeringId: 'anchor_pro',
  annual: { planId: 'annual', packageId: '$rc_annual', price: 59.99, priceString: '$59.99', currencyCode: 'USD', trialEligible: true },
  monthly: { planId: 'monthly', packageId: '$rc_monthly', price: 7.99, priceString: '$7.99', currencyCode: 'USD', trialEligible: false },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetOfferingDisplayMetadata.mockResolvedValue(METADATA);
  mockRestore.mockResolvedValue({ hasActiveEntitlement: false });
  useSettingsStore.setState({ developerMasterAccountEnabled: false, reduceMotion: 'on' } as never);
  useSubscriptionStore.setState({
    trialStartDate: null, isInTrial: false, isSubscribed: false, hasActiveEntitlement: false,
    trialExpired: false, entitlementReady: true, remoteCompedAccess: false, legacyMigrationAccess: false,
    devOverrideEnabled: false, subscriptionStatus: 'expired',
  } as never);
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
  useVisualizationSceneStore.setState({ scenes: {} } as never);
});

const noop = () => {};

describe('V2PaywallScreen personalization', () => {
  it('shows the active Anchor artwork on the Practice paywall', async () => {
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a', intentionText: 'I finish what I start', category: 'career' })],
      currentAnchorId: 'a',
    });
    render(<V2PaywallScreen context="PRACTICE" onDismiss={noop} onEntitled={noop} />);
    expect(await screen.findByTestId('v2-paywall-artifact-anchor')).toBeTruthy();
    expect(screen.getByText('“I finish what I start”')).toBeTruthy();
    expect(screen.queryByTestId('v2-paywall-artifact-vision')).toBeNull();
  });

  it('shows the real Vision scene on the Visualize paywall', async () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })], currentAnchorId: 'a' });
    useVisualizationSceneStore.setState({
      scenes: { a: { id: 'v', accountId: 'acc', anchorId: 'a', anchorLocalId: 'a', currentText: 'A steady daily rhythm', originalSuggestion: 'x', generationSource: 'gemini', generationVersion: '1', clientUpdatedAt: 'now', syncState: 'synced' } },
    } as never);
    render(<V2PaywallScreen context="VISUALIZE" onDismiss={noop} onEntitled={noop} />);
    expect(await screen.findByTestId('v2-paywall-artifact-vision')).toBeTruthy();
    expect(screen.getByText('“A steady daily rhythm”')).toBeTruthy();
  });

  it('falls back to the contextual placeholder — never Anchor art — when no Vision exists', async () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })], currentAnchorId: 'a' });
    render(<V2PaywallScreen context="VISUALIZE" onDismiss={noop} onEntitled={noop} />);
    expect(await screen.findByTestId('v2-paywall-artifact-vision-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('v2-paywall-artifact-anchor')).toBeNull();
  });
});

describe('V2PaywallScreen behaviour', () => {
  it('does not begin a purchase on mount and exposes the trial CTA', async () => {
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={noop} />);
    await waitFor(() => expect(screen.getByTestId('v2-paywall-cta')).toBeTruthy());
    expect(mockPurchase).not.toHaveBeenCalled();
    expect(screen.getByText('Start 7-Day Free Trial')).toBeTruthy();
  });

  it('gives clear feedback when Restore finds no purchases', async () => {
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={noop} />);
    const restore = await screen.findByTestId('v2-paywall-restore');
    fireEvent.press(restore);
    expect(await screen.findByText('No purchases found to restore.')).toBeTruthy();
  });

  it('renders the trial-ended state with a paid CTA and no free-trial offer', async () => {
    useSubscriptionStore.setState({
      trialStartDate: new Date(Date.now() - 40 * 864e5).toISOString(), trialExpired: true, entitlementReady: true,
    } as never);
    render(<V2PaywallScreen context="TRIAL_ENDED" onDismiss={noop} onEntitled={noop} onSignIn={noop} />);
    expect(await screen.findByTestId('v2-paywall-trial-ended')).toBeTruthy();
    expect(screen.getByText('Keep building what you started.')).toBeTruthy();
    expect(screen.queryByText('Start 7-Day Free Trial')).toBeNull();
  });
});
