import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockPurchase = jest.fn();
const mockRestore = jest.fn();
const mockGetOfferingDisplayMetadata = jest.fn();
const mockActivateV2Trial = jest.fn();
const mockRefreshServerEntitlement = jest.fn();

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
  refreshServerEntitlement: (...a: unknown[]) => mockRefreshServerEntitlement(...a),
}));
jest.mock('../../../../adapters/v2/paywall/trialActivation', () => ({
  __esModule: true,
  activateV2Trial: (...a: unknown[]) => mockActivateV2Trial(...a),
}));

import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useV2Paywall } from '../useV2Paywall';

const TRIAL_ELIGIBLE_METADATA = {
  offeringId: 'anchor_pro',
  annual: { planId: 'annual', packageId: '$rc_annual', price: 59.99, priceString: '$59.99', currencyCode: 'USD', trialEligible: true },
  monthly: { planId: 'monthly', packageId: '$rc_monthly', price: 7.99, priceString: '$7.99', currencyCode: 'USD', trialEligible: false },
};

function setSubscription(overrides: Record<string, unknown>) {
  useSubscriptionStore.setState({
    trialStartDate: null,
    isInTrial: false,
    isSubscribed: false,
    hasActiveEntitlement: false,
    trialExpired: false,
    entitlementReady: true,
    remoteCompedAccess: false,
    legacyMigrationAccess: false,
    devOverrideEnabled: false,
    subscriptionStatus: 'expired',
    ...overrides,
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetOfferingDisplayMetadata.mockResolvedValue(TRIAL_ELIGIBLE_METADATA);
  mockActivateV2Trial.mockResolvedValue({ status: 'activated', trialState: 'TRIAL_ACTIVE', trialStartedAt: 'x', hasProAccess: true, isTrialPeriod: true });
  mockRefreshServerEntitlement.mockResolvedValue({ hasActiveEntitlement: true });
  mockPurchase.mockResolvedValue({ status: { hasActiveEntitlement: true }, dismissed: false });
  mockRestore.mockResolvedValue({ hasActiveEntitlement: true });
  useSettingsStore.setState({ developerMasterAccountEnabled: false } as never);
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
  setSubscription({});
});

const renderPaywall = (context: 'PRACTICE' | 'TRIAL_ENDED' = 'PRACTICE', onEntitled = jest.fn()) => ({
  onEntitled,
  ...renderHook(() => useV2Paywall({ context, onEntitled })),
});

describe('useV2Paywall — trial start', () => {
  it('starts NOTHING on mount — the trial begins only on an explicit CTA tap', async () => {
    const { result } = renderPaywall();
    await waitFor(() => expect(result.current.pricingStatus).toBe('ready'));

    expect(mockPurchase).not.toHaveBeenCalled();
    expect(mockActivateV2Trial).not.toHaveBeenCalled();
    expect(result.current.offersTrial).toBe(true);

    await act(async () => {
      await result.current.startTrial();
    });

    expect(mockPurchase).toHaveBeenCalledTimes(1);
    expect(mockPurchase).toHaveBeenCalledWith('$rc_annual', { syncStatus: false });
    expect(mockActivateV2Trial).toHaveBeenCalledTimes(1);
  });

  it('resumes the original intent once entitlement is granted', async () => {
    const { result, onEntitled } = renderPaywall('PRACTICE');
    await waitFor(() => expect(result.current.pricingStatus).toBe('ready'));

    await act(async () => {
      await result.current.startTrial();
    });

    expect(onEntitled).toHaveBeenCalledWith({ context: 'PRACTICE', outcome: 'trial_started', plan: 'annual' });
    expect(result.current.purchaseState).toBe('success');
  });

  it('prevents a double submission from firing two purchases', async () => {
    let release: (v: unknown) => void = () => {};
    mockPurchase.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));

    const { result } = renderPaywall();
    await waitFor(() => expect(result.current.pricingStatus).toBe('ready'));

    await act(async () => {
      result.current.startTrial();
      result.current.startTrial();
      result.current.submitPrimary();
    });

    expect(mockPurchase).toHaveBeenCalledTimes(1);

    await act(async () => {
      release({ status: { hasActiveEntitlement: true }, dismissed: false });
    });
  });

  it('marks the purchase cancelled (nothing charged) when the store sheet is dismissed', async () => {
    mockPurchase.mockResolvedValueOnce({ status: { hasActiveEntitlement: false }, dismissed: true });
    const { result, onEntitled } = renderPaywall();
    await waitFor(() => expect(result.current.pricingStatus).toBe('ready'));

    await act(async () => {
      await result.current.startTrial();
    });

    expect(result.current.purchaseState).toBe('cancelled');
    expect(mockActivateV2Trial).not.toHaveBeenCalled();
    expect(onEntitled).not.toHaveBeenCalled();
  });
});

describe('useV2Paywall — active subscriber', () => {
  it('bypasses the trial-start CTA and never purchases', async () => {
    setSubscription({ isSubscribed: true, hasActiveEntitlement: true, subscriptionStatus: 'active' });
    const { result } = renderPaywall();
    await waitFor(() => expect(result.current.pricingStatus).toBe('ready'));

    expect(result.current.isActiveSubscriber).toBe(true);
    expect(result.current.offersTrial).toBe(false);

    await act(async () => {
      await result.current.startTrial();
      await result.current.purchaseSelectedPlan();
    });
    expect(mockPurchase).not.toHaveBeenCalled();
  });
});

describe('useV2Paywall — expired trial', () => {
  it('cannot restart the trial — the CTA is a paid purchase', async () => {
    setSubscription({ trialStartDate: new Date(Date.now() - 30 * 864e5).toISOString(), trialExpired: true });
    const { result } = renderPaywall('TRIAL_ENDED');
    await waitFor(() => expect(result.current.pricingStatus).toBe('ready'));

    expect(result.current.trialState).toBe('TRIAL_ENDED');
    expect(result.current.offersTrial).toBe(false);

    await act(async () => {
      await result.current.startTrial();
    });
    expect(mockPurchase).not.toHaveBeenCalled();
  });
});

describe('useV2Paywall — restore', () => {
  it('reports no_purchases_found without granting entitlement', async () => {
    mockRestore.mockResolvedValueOnce({ hasActiveEntitlement: false });
    const { result, onEntitled } = renderPaywall();
    await waitFor(() => expect(result.current.pricingStatus).toBe('ready'));

    await act(async () => {
      await result.current.restore();
    });

    expect(result.current.restoreState).toBe('no_purchases_found');
    expect(onEntitled).not.toHaveBeenCalled();
  });

  it('surfaces the transient `restoring` state while in flight', async () => {
    let release: (v: unknown) => void = () => {};
    mockRestore.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const { result } = renderPaywall();
    await waitFor(() => expect(result.current.pricingStatus).toBe('ready'));

    let pending: Promise<void>;
    await act(async () => {
      pending = result.current.restore();
    });
    expect(result.current.restoreState).toBe('restoring');
    expect(result.current.busy).toBe(true);

    await act(async () => {
      release({ hasActiveEntitlement: true });
      await pending;
    });
    expect(result.current.restoreState).toBe('success');
  });

  it('reports success and resumes intent when a subscription is found', async () => {
    const { result, onEntitled } = renderPaywall();
    await waitFor(() => expect(result.current.pricingStatus).toBe('ready'));

    await act(async () => {
      await result.current.restore();
    });

    expect(result.current.restoreState).toBe('success');
    expect(onEntitled).toHaveBeenCalledWith({ context: 'PRACTICE', outcome: 'restored', plan: undefined });
  });

  it('reports a recoverable error when restore throws', async () => {
    mockRestore.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderPaywall();
    await waitFor(() => expect(result.current.pricingStatus).toBe('ready'));

    await act(async () => {
      await result.current.restore();
    });
    expect(result.current.restoreState).toBe('error');
  });
});
