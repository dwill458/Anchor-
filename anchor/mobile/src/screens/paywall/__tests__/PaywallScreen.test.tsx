import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { Anchor } from '@/types';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReset = jest.fn();
const mockTrack = jest.fn();
const mockSetPreferredPlanId = jest.fn();
const mockApplyServerEntitlement = jest.fn();
const mockRefreshServerEntitlement = jest.fn();
let mockPreferredPlanId: 'monthly' | 'annual' = 'annual';
let mockRouteParams: { preferredPlanId?: 'monthly' | 'annual'; source?: 'post_trial' | 'gated_feature' } | undefined;

let mockAnchorState: {
  anchors: Anchor[];
  primeStreak: number;
};

let mockProgressionData: {
  forgedCount: number;
  totalPrimes: number;
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    reset: mockReset,
  }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: any) => selector(mockAnchorState),
}));

jest.mock('@/stores/subscriptionStore', () => ({
  useSubscriptionStore: (selector: any) =>
    selector({
      preferredPlanId: mockPreferredPlanId,
      setPreferredPlanId: mockSetPreferredPlanId,
      applyServerEntitlement: mockApplyServerEntitlement,
    }),
}));

jest.mock('@/hooks/useProgressionData', () => ({
  useProgressionData: () => mockProgressionData,
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => true,
}));

jest.mock('@/hooks/useTrialStatus', () => ({
  useTrialStatus: () => ({
    isTrialActive: false,
    isSubscribed: false,
    hasExpired: true,
    trialExpired: true,
    hasActiveEntitlement: false,
    daysRemaining: 0,
    subscriptionStatus: 'expired',
  }),
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    track: (...args: any[]) => mockTrack(...args),
  },
  AnalyticsEvents: jest.requireActual('@/services/AnalyticsService').AnalyticsEvents,
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/services/RevenueCatService', () => ({
  __esModule: true,
  default: {
    getOfferingDisplayMetadata: jest.fn(),
    purchasePackageByIdentifier: jest.fn(),
    restorePurchases: jest.fn(),
    getPackagePresentations: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/services/BillingService', () => ({
  refreshServerEntitlement: (...args: unknown[]) => mockRefreshServerEntitlement(...args),
}));

import revenueCatService from '@/services/RevenueCatService';
import { PaywallScreen } from '../PaywallScreen';

const buildAnchor = (overrides: Partial<Anchor>): Anchor => ({
  id: 'anchor-1',
  userId: 'user-1',
  intentionText: 'Stay focused',
  category: 'career',
  distilledLetters: ['S', 'F'],
  baseSigilSvg: '<svg><path d="base" /></svg>',
  reinforcedSigilSvg: undefined,
  enhancedImageUrl: undefined,
  structureVariant: 'balanced',
  isCharged: false,
  activationCount: 0,
  createdAt: new Date('2026-06-01T12:00:00.000Z'),
  updatedAt: new Date('2026-06-01T12:00:00.000Z'),
  ...overrides,
});

const trialStatus = (hasActiveEntitlement: boolean) => ({
  isInTrial: false,
  isSubscribed: hasActiveEntitlement,
  hasActiveEntitlement,
  daysRemaining: null,
  trialExpired: !hasActiveEntitlement,
});

const serverEntitlement = (hasActiveEntitlement: boolean) => ({
  hasActiveEntitlement,
  subscriptionStatus: hasActiveEntitlement ? 'pro' as const : 'free' as const,
  productIdentifier: hasActiveEntitlement ? 'anchor_pro_annual' : null,
  source: 'revenuecat' as const,
});

const buildLiveOfferingMetadata = () => ({
  monthly: {
    planId: 'monthly' as const,
    packageId: '$rc_monthly',
    price: 7.99,
    priceString: '$7.99',
    pricePerMonth: 7.99,
    pricePerMonthString: '$7.99',
    pricePerYear: 95.88,
    pricePerYearString: '$95.88',
    currencyCode: 'USD',
  },
  annual: {
    planId: 'annual' as const,
    packageId: '$rc_annual',
    price: 59.99,
    priceString: '$59.99',
    pricePerMonth: 5,
    pricePerMonthString: '$5.00',
    pricePerYear: 59.99,
    pricePerYearString: '$59.99',
    currencyCode: 'USD',
  },
});

describe('PaywallScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockReset.mockClear();
    mockTrack.mockClear();
    mockSetPreferredPlanId.mockClear();
    mockApplyServerEntitlement.mockClear();
    mockRefreshServerEntitlement.mockReset();
    mockRefreshServerEntitlement.mockResolvedValue(serverEntitlement(false));
    mockPreferredPlanId = 'annual';
    mockRouteParams = undefined;
    mockAnchorState = {
      anchors: [
        buildAnchor({
          id: 'anchor-primary',
          activationCount: 5,
          reinforcedSigilSvg: '<svg><path d="primary" /></svg>',
        }),
      ],
      primeStreak: 7,
    };
    mockProgressionData = {
      forgedCount: 4,
      totalPrimes: 11,
    };

    jest.mocked(revenueCatService.getOfferingDisplayMetadata).mockReset();
    jest
      .mocked(revenueCatService.getOfferingDisplayMetadata)
      .mockImplementation(() => Promise.resolve(buildLiveOfferingMetadata()));
    jest.mocked(revenueCatService.purchasePackageByIdentifier).mockReset();
    jest.mocked(revenueCatService.purchasePackageByIdentifier).mockResolvedValue({
      status: trialStatus(false),
      dismissed: true,
    });
    jest.mocked(revenueCatService.restorePurchases).mockReset();
    jest.mocked(revenueCatService.restorePurchases).mockResolvedValue(trialStatus(false));
  });

  afterEach(async () => {
    cleanup();
    await act(async () => {});
    alertSpy.mockRestore();
  });

  it('renders monthly and annual plans plus the CTA', async () => {
    render(<PaywallScreen />);

    expect(screen.getByText('Monthly')).toBeTruthy();
    expect(screen.getByText('Annual')).toBeTruthy();
    expect(screen.queryByText('Lifetime')).toBeNull();
    await waitFor(() => {
      expect(screen.getByText('Continue my practice')).toBeTruthy();
    });
  });

  it('selects annual by default', () => {
    render(<PaywallScreen />);

    expect(screen.getByTestId('paywall-plan-annual').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('paywall-plan-monthly').props.accessibilityState.selected).toBe(false);
    expect(
      StyleSheet.flatten(screen.getByTestId('paywall-plan-check-annual').props.style).backgroundColor
    ).toBe('#f0cb6a');
  });

  it('uses the preferred plan from navigation params', () => {
    mockRouteParams = { preferredPlanId: 'monthly' };

    render(<PaywallScreen />);

    expect(screen.getByTestId('paywall-plan-monthly').props.accessibilityState.selected).toBe(true);
    expect(mockSetPreferredPlanId).toHaveBeenCalledWith('monthly');
  });

  it('changes plan selection without purchasing on card press', async () => {
    render(<PaywallScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Continue my practice, Annual selected')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('paywall-plan-monthly'));

    expect(screen.getByTestId('paywall-plan-monthly').props.accessibilityState.selected).toBe(true);
    expect(mockSetPreferredPlanId).toHaveBeenCalledWith('monthly');
    expect(revenueCatService.purchasePackageByIdentifier).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith('paywall_plan_selected', { plan: 'monthly' });
  });

  it('purchases the selected plan from the CTA', async () => {
    jest.mocked(revenueCatService.purchasePackageByIdentifier).mockResolvedValueOnce({
      status: trialStatus(false),
      dismissed: true,
    });

    render(<PaywallScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Continue my practice, Annual selected')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('paywall-plan-monthly'));
    fireEvent.press(screen.getByLabelText('Continue my practice, Monthly selected'));

    await waitFor(() => {
      expect(revenueCatService.purchasePackageByIdentifier).toHaveBeenCalledWith('$rc_monthly', {
        syncStatus: false,
      });
    });
  });

  it('resets to Main only after the server confirms an entitlement', async () => {
    jest.mocked(revenueCatService.purchasePackageByIdentifier).mockResolvedValueOnce({
      status: trialStatus(false),
      dismissed: false,
    });
    mockRefreshServerEntitlement.mockResolvedValueOnce(serverEntitlement(true));

    render(<PaywallScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Continue my practice, Annual selected')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Continue my practice, Annual selected'));

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    });
    expect(mockRefreshServerEntitlement).toHaveBeenCalledTimes(1);
    expect(mockApplyServerEntitlement).toHaveBeenCalledWith(true);
  });

  it('restores and unlocks only when the server reports active access', async () => {
    jest.mocked(revenueCatService.restorePurchases).mockResolvedValueOnce(trialStatus(false));
    mockRefreshServerEntitlement.mockResolvedValueOnce(serverEntitlement(true));

    render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText('Restore purchase'));

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    });
    expect(revenueCatService.restorePurchases).toHaveBeenCalledWith({ syncStatus: false });
    expect(mockApplyServerEntitlement).toHaveBeenCalledWith(true);
  });

  it('does not unlock when the server cannot confirm a restored entitlement', async () => {
    jest.mocked(revenueCatService.restorePurchases).mockResolvedValueOnce(trialStatus(true));
    mockRefreshServerEntitlement.mockResolvedValueOnce(serverEntitlement(false));

    render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText('Restore purchase'));

    await waitFor(() => {
      expect(revenueCatService.restorePurchases).toHaveBeenCalled();
    });
    expect(mockReset).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'No subscription found',
      'No active subscription was found for this account.'
    );
  });

  it('keeps the paywall visible while a completed purchase is still awaiting server confirmation', async () => {
    jest.mocked(revenueCatService.purchasePackageByIdentifier).mockResolvedValueOnce({
      status: trialStatus(true),
      dismissed: false,
    });
    mockRefreshServerEntitlement.mockResolvedValueOnce(serverEntitlement(false));

    render(<PaywallScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Continue my practice, Annual selected')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Continue my practice, Annual selected'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Purchase is still being confirmed',
        expect.stringContaining('Your receipt is safe')
      );
    });
    expect(mockReset).not.toHaveBeenCalled();
    expect(mockApplyServerEntitlement).not.toHaveBeenCalled();
  });

  it('disables purchase when RevenueCat returns no App Store products for offerings', async () => {
    jest.mocked(revenueCatService.getOfferingDisplayMetadata).mockResolvedValueOnce({});

    render(<PaywallScreen />);

    await waitFor(() => {
      expect(screen.getByText('Purchases unavailable')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Purchases unavailable'));

    expect(revenueCatService.purchasePackageByIdentifier).not.toHaveBeenCalled();
    expect(screen.getByText('Purchases are temporarily unavailable. Restore is still available.')).toBeTruthy();
    expect(screen.queryByTestId('paywall-price-comparison')).toBeNull();
  });

  it('uses live store pricing for the annual comparison and savings label', async () => {
    render(<PaywallScreen />);

    await waitFor(() => {
      expect(screen.getByText('Paying monthly totals $95.88 each year.')).toBeTruthy();
    });
    expect(screen.getByText('Best value · save 37%')).toBeTruthy();
  });

  it('does not compare prices across currencies', async () => {
    const mismatchedCurrencyOffering = buildLiveOfferingMetadata();
    mismatchedCurrencyOffering.annual.currencyCode = 'EUR';
    mismatchedCurrencyOffering.annual.priceString = '€59.99';
    jest.mocked(revenueCatService.getOfferingDisplayMetadata).mockResolvedValueOnce(
      mismatchedCurrencyOffering
    );

    render(<PaywallScreen />);

    await waitFor(() => {
      expect(screen.getByText('€59.99')).toBeTruthy();
    });
    expect(screen.queryByTestId('paywall-price-comparison')).toBeNull();
    expect(screen.queryByText(/Best value/)).toBeNull();
  });

  it('sanitizes RevenueCat configuration errors in purchase alerts', async () => {
    jest.mocked(revenueCatService.purchasePackageByIdentifier).mockRejectedValueOnce(
      new Error('There is an issue with your configuration. There are no App Store products registered in the RevenueCat dashboard for your offerings.')
    );

    render(<PaywallScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Continue my practice, Annual selected')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Continue my practice, Annual selected'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Purchase could not be completed',
        'Purchases are temporarily unavailable. Please try again later or restore an existing subscription.'
      );
    });
    expect(alertSpy.mock.calls[0][1]).not.toContain('RevenueCat dashboard');
  });

  it('renders the most reinforced active anchor as the hero', () => {
    mockAnchorState.anchors = [
      buildAnchor({
        id: 'recent-less-used',
        activationCount: 2,
        reinforcedSigilSvg: '<svg><path d="recent" /></svg>',
        lastActivatedAt: new Date('2026-06-08T12:00:00.000Z'),
      }),
      buildAnchor({
        id: 'older-more-used',
        activationCount: 8,
        reinforcedSigilSvg: '<svg><path d="winner" /></svg>',
        lastActivatedAt: new Date('2026-06-02T12:00:00.000Z'),
      }),
      buildAnchor({
        id: 'released-most-used',
        activationCount: 99,
        reinforcedSigilSvg: '<svg><path d="released" /></svg>',
        isReleased: true,
      }),
    ];

    render(<PaywallScreen />);

    expect(screen.getByTestId('paywall-primary-anchor-svg').props.xml).toContain('winner');
  });

  it('uses recency as the primary-anchor tie breaker', () => {
    mockAnchorState.anchors = [
      buildAnchor({
        id: 'older',
        activationCount: 4,
        reinforcedSigilSvg: '<svg><path d="older" /></svg>',
        lastActivatedAt: new Date('2026-06-01T12:00:00.000Z'),
      }),
      buildAnchor({
        id: 'newer',
        activationCount: 4,
        reinforcedSigilSvg: '<svg><path d="newer" /></svg>',
        lastActivatedAt: new Date('2026-06-08T12:00:00.000Z'),
      }),
    ];

    render(<PaywallScreen />);

    expect(screen.getByTestId('paywall-primary-anchor-svg').props.xml).toContain('newer');
  });

  it('renders recap stats from progression and anchor state', () => {
    render(<PaywallScreen />);

    expect(screen.getByTestId('paywall-recap')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Anchors forged')).toBeTruthy();
    expect(screen.getByText('Sessions primed')).toBeTruthy();
    expect(screen.getByText('Prime record')).toBeTruthy();
  });

  it('frames the expired-trial decision as retaining access, not losing stored work', () => {
    render(<PaywallScreen />);

    expect(screen.getByText(/Your anchors and progress are safe/)).toBeTruthy();
    expect(screen.getByText(/Keep it within reach as you/)).toBeTruthy();
  });

  it('opens sign in from the paywall', () => {
    render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText('Already subscribed? Sign in'));

    expect(mockNavigate).toHaveBeenCalledWith('Settings', {
      screen: 'Login',
      params: {
        initialTab: 'signin',
        context: 'paywall',
        preferredPlanId: 'annual',
      },
    });
  });
});
