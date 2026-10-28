import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockPurchase = jest.fn();
const mockRestore = jest.fn();
const mockGetOfferingDisplayMetadata = jest.fn();
const mockScheduleReminder = jest.fn();
const mockTrack = jest.fn();
let mockVisionState: unknown = { state: 'none', anchorId: '' };

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
jest.mock('@/services/v2/trialReminder', () => ({
  __esModule: true,
  scheduleTrialEndReminder: (...a: unknown[]) => mockScheduleReminder(...a),
}));
jest.mock('@/hooks/v2/vision', () => ({
  __esModule: true,
  useV2Vision: () => ({ state: mockVisionState, refresh: jest.fn() }),
}));
jest.mock('@/services/AnalyticsService', () => {
  const actual = jest.requireActual('@/services/AnalyticsService');
  return {
    __esModule: true,
    ...actual,
    AnalyticsService: { ...actual.AnalyticsService, track: (...a: unknown[]) => mockTrack(...a) },
  };
});

import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import './paywallSkiaMock';
import { V2PaywallScreen } from '../V2PaywallScreen';

const plan = (planId: string, price: number, trialEligible = false) => ({
  planId,
  packageId: `$rc_${planId}`,
  price,
  priceString: `$${price}`,
  currencyCode: 'USD',
  trialEligible,
});
const METADATA = {
  offeringId: 'anchor_pro',
  annual: plan('annual', 59.99, true),
  weekly: plan('weekly', 1.99),
  monthly: plan('monthly', 7.99),
  lifetime: plan('lifetime', 149.99),
};
const HIDDEN = { includeHiddenElements: true } as const;

beforeEach(() => {
  jest.clearAllMocks();
  mockVisionState = { state: 'none', anchorId: '' };
  mockGetOfferingDisplayMetadata.mockResolvedValue(METADATA);
  mockRestore.mockResolvedValue({ hasActiveEntitlement: false });
  mockPurchase.mockResolvedValue({ status: { hasActiveEntitlement: true }, dismissed: false });
  useSettingsStore.setState({ developerMasterAccountEnabled: false, reduceMotion: 'on' } as never);
  useSubscriptionStore.setState({
    trialStartDate: null, isInTrial: false, isSubscribed: false, hasActiveEntitlement: false,
    trialExpired: false, entitlementReady: true, remoteCompedAccess: false, legacyMigrationAccess: false,
    devOverrideEnabled: false, devTierOverride: 'pro', subscriptionStatus: 'expired',
  } as never);
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
});

const noop = () => {};

async function openPlans() {
  fireEvent.press(await screen.findByTestId('v2-paywall-continue'));
  await screen.findByText('Choose your plan');
  // Prices are in once the annual card shows a real amount.
  await screen.findByText('$59.99 / year');
}

describe('V2PaywallScreen step 1 — the offer', () => {
  it('shows the offer copy and starts nothing on mount', async () => {
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={noop} />);
    expect(await screen.findByText('Don’t let this become another goal you forget')).toBeTruthy();
    expect(screen.getByText('See what you’re building toward.')).toBeTruthy();
    expect(screen.getByText('Use short guided sessions to keep your Anchor active.')).toBeTruthy();
    expect(screen.getByText('Turn intention into your next move.')).toBeTruthy();
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it('dismisses from the X and from "Maybe later" exactly as before', async () => {
    const onDismiss = jest.fn();
    render(<V2PaywallScreen context="PRACTICE" onDismiss={onDismiss} onEntitled={noop} />);
    fireEvent.press(await screen.findByTestId('v2-paywall-close'));
    fireEvent.press(screen.getByTestId('v2-paywall-maybe-later'));
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(mockTrack).toHaveBeenCalledWith('paywall_dismissed', { source: 'PRACTICE', context: 'PRACTICE', step: 1 });
  });

  it('fires paywall_viewed once, after store pricing settles', async () => {
    const view = render(<V2PaywallScreen context="PRACTICE" onDismiss={noop} onEntitled={noop} />);
    await waitFor(() => expect(mockTrack).toHaveBeenCalledWith('paywall_viewed', expect.objectContaining({
      source: 'PRACTICE', context: 'PRACTICE', defaultPlan: 'annual', trial_status: 'expired',
    })));
    view.rerender(<V2PaywallScreen context="PRACTICE" onDismiss={noop} onEntitled={noop} />);
    expect(mockTrack.mock.calls.filter(([event]) => event === 'paywall_viewed')).toHaveLength(1);
  });

  // The tiles are decorative (hidden from assistive tech; the row label speaks), hence HIDDEN.
  it('uses the real Vision image and title, with a calm fallback when there is none', async () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })], currentAnchorId: 'a' });
    const view = render(<V2PaywallScreen context="PRACTICE" onDismiss={noop} onEntitled={noop} />);
    expect(await screen.findByTestId('v2-paywall-vision-fallback', HIDDEN)).toBeTruthy();
    expect(screen.getByText('Add your Vision', HIDDEN)).toBeTruthy();
    view.unmount();

    mockVisionState = {
      state: 'ready', anchorId: 'a', visionId: 'v', title: 'A calmer, freer me', description: 'x',
      tiles: [{ id: 't', sceneId: 's', imageUrl: 'https://img/v.jpg', prompt: null, sortOrder: 0, isHero: true }],
      featuredTileId: 't', seenToday: false, raw: {},
    };
    render(<V2PaywallScreen context="PRACTICE" onDismiss={noop} onEntitled={noop} />);
    expect(await screen.findByTestId('v2-paywall-vision-image', HIDDEN)).toBeTruthy();
    expect(screen.getByText('A calmer, freer me', HIDDEN)).toBeTruthy();
  });
});

describe('V2PaywallScreen step 2 — the plans', () => {
  it('opens on Annual with the trial, timeline and RevenueCat-derived savings', async () => {
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={noop} />);
    await openPlans();
    expect(mockTrack).toHaveBeenCalledWith('paywall_step2_viewed', { source: 'GENERAL_UPGRADE', context: 'GENERAL_UPGRADE' });
    expect(screen.getByTestId('v2-paywall-plan-annual').props.accessibilityState.checked).toBe(true);
    expect(screen.getByText('7 days free')).toBeTruthy();
    // 1 - 59.99 / (1.99 * 52) = 42%
    expect(screen.getByText('Save 42% vs weekly, then $59.99/year.')).toBeTruthy();
    expect(screen.getByTestId('v2-paywall-cta-label').props.children).toBe('Start my free trial');
    expect(screen.getByTestId('v2-paywall-cta-sub').props.children).toBe('No charge today');
    expect(screen.getByTestId('v2-paywall-trial-timeline')).toBeTruthy();
    expect(screen.getByText('Billed $59.99')).toBeTruthy();
  });

  it('switches to Weekly: Continue, billed-today line, no timeline', async () => {
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={noop} />);
    await openPlans();
    fireEvent.press(screen.getByTestId('v2-paywall-plan-weekly'));
    await waitFor(() => expect(screen.getByTestId('v2-paywall-cta-label').props.children).toBe('Continue'));
    expect(mockTrack).toHaveBeenCalledWith('paywall_plan_selected', { plan: 'weekly', source: 'GENERAL_UPGRADE', context: 'GENERAL_UPGRADE' });
    expect(screen.getByTestId('v2-paywall-cta-sub').props.children).toBe('$1.99 billed today, then weekly');
    expect(screen.getByText('Weekly has no free trial. You’re billed $1.99 today, then every week.')).toBeTruthy();
    expect(screen.queryByTestId('v2-paywall-trial-timeline')).toBeNull();

    fireEvent.press(screen.getByTestId('v2-paywall-cta'));
    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith('$rc_weekly', { syncStatus: false }));
    expect(mockScheduleReminder).not.toHaveBeenCalled();
  });

  it('shows no trial language anywhere to a user who is not eligible', async () => {
    mockGetOfferingDisplayMetadata.mockResolvedValue({ ...METADATA, annual: plan('annual', 59.99, false) });
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={noop} />);
    await openPlans();
    expect(screen.getByTestId('v2-paywall-cta-label').props.children).toBe('Continue');
    expect(screen.getByTestId('v2-paywall-cta-sub').props.children).toBe('$59.99 billed today, then yearly');
    expect(screen.queryByTestId('v2-paywall-trial-timeline', HIDDEN)).toBeNull();
    expect(screen.queryAllByText(/trial|days free|no charge/i, HIDDEN)).toHaveLength(0);
    fireEvent.press(screen.getByTestId('v2-paywall-plan-weekly'));
    await waitFor(() => expect(screen.getByText('You’re billed $1.99 today, then every week.')).toBeTruthy());
    expect(screen.queryAllByText(/trial/i, HIDDEN)).toHaveLength(0);
  });

  it('starts the annual trial and schedules the day-5 reminder', async () => {
    const onEntitled = jest.fn();
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={onEntitled} />);
    await openPlans();
    fireEvent.press(screen.getByTestId('v2-paywall-cta'));
    await waitFor(() => expect(onEntitled).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'trial_started', plan: 'annual' })));
    expect(mockPurchase).toHaveBeenCalledWith('$rc_annual', { syncStatus: false });
    expect(mockScheduleReminder).toHaveBeenCalledWith('$59.99');
    const funnel = { source: 'GENERAL_UPGRADE', context: 'GENERAL_UPGRADE', plan: 'annual', productId: '$rc_annual' };
    expect(mockTrack).toHaveBeenCalledWith('paywall_cta_tapped', funnel);
    expect(mockTrack).toHaveBeenCalledWith('paywall_converted', { ...funnel, outcome: 'trial_started' });
    expect(mockTrack).toHaveBeenCalledWith('trial_started', { ...funnel, outcome: 'trial_started' });
    expect(mockTrack).not.toHaveBeenCalledWith('trial_converted', expect.anything());
  });

  it('fires paywall_cta_tapped but no conversion when the store sheet is cancelled', async () => {
    mockPurchase.mockResolvedValueOnce({ status: { hasActiveEntitlement: false }, dismissed: true });
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={noop} />);
    await openPlans();
    fireEvent.press(screen.getByTestId('v2-paywall-plan-weekly'));
    fireEvent.press(screen.getByTestId('v2-paywall-cta'));
    await waitFor(() => expect(mockTrack).toHaveBeenCalledWith('paywall_cta_tapped', expect.objectContaining({ plan: 'weekly', productId: '$rc_weekly' })));
    expect(mockTrack).not.toHaveBeenCalledWith('paywall_converted', expect.anything());
  });

  it('offers no free trial while a dev "Expired" tier is simulated', async () => {
    useSubscriptionStore.setState({ devOverrideEnabled: true, devTierOverride: 'expired' } as never);
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={noop} />);
    await openPlans();
    expect(screen.getByTestId('v2-paywall-cta-label').props.children).toBe('Continue');
    expect(screen.queryAllByText(/trial|days free|no charge/i, { includeHiddenElements: true })).toHaveLength(0);
  });

  it('resets after a cancelled purchase and explains a failed one inline', async () => {
    mockPurchase.mockResolvedValueOnce({ status: { hasActiveEntitlement: false }, dismissed: true });
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={noop} />);
    await openPlans();
    fireEvent.press(screen.getByTestId('v2-paywall-cta'));
    await waitFor(() => expect(mockPurchase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('v2-paywall-cta').props.accessibilityState.disabled).toBe(false));
    expect(screen.queryByTestId('v2-paywall-error')).toBeNull();

    mockPurchase.mockRejectedValueOnce(new Error('store down'));
    fireEvent.press(screen.getByTestId('v2-paywall-cta'));
    expect(await screen.findByTestId('v2-paywall-error')).toBeTruthy();
    expect(screen.getByTestId('v2-paywall-cta').props.accessibilityState.disabled).toBe(false);
  });

  it('restores through the existing restore call and reports the result', async () => {
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={noop} />);
    await openPlans();
    fireEvent.press(screen.getByTestId('v2-paywall-restore'));
    expect(await screen.findByText('No purchases found to restore.')).toBeTruthy();
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('paywall_restore_tapped', { source: 'GENERAL_UPGRADE', context: 'GENERAL_UPGRADE' });
  });

  it('returns to the offer from the back arrow', async () => {
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={noop} />);
    await openPlans();
    fireEvent.press(screen.getByTestId('v2-paywall-back'));
    await waitFor(() => expect(screen.getByTestId('v2-paywall-continue')).toBeTruthy());
    expect(screen.queryByTestId('v2-paywall-cta')).toBeNull();
  });

  it('keeps forbidden vocabulary out of every visible string', async () => {
    render(<V2PaywallScreen context="GENERAL_UPGRADE" onDismiss={noop} onEntitled={noop} />);
    await openPlans();
    expect(screen.queryAllByText(/sigil|streak|ritual|prime/i, HIDDEN)).toHaveLength(0);
  });
});

describe('V2PaywallScreen trial ended', () => {
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
