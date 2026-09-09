const mockGetOfferingDisplayMetadata = jest.fn();

jest.mock('@/services/RevenueCatService', () => ({
  __esModule: true,
  default: { getOfferingDisplayMetadata: (...a: unknown[]) => mockGetOfferingDisplayMetadata(...a) },
}));

import {
  loadV2PaywallPricing,
  toV2PaywallPricing,
  resolvePricingStatus,
  planPerMonthLabel,
  packageIdForPlan,
} from '../revenueCatPricing';

beforeEach(() => mockGetOfferingDisplayMetadata.mockReset());

describe('V2 paywall pricing (RevenueCat-driven, never hard-coded)', () => {
  it('surfaces the localised store price, currency and per-month string verbatim', async () => {
    mockGetOfferingDisplayMetadata.mockResolvedValueOnce({
      offeringId: 'anchor_pro',
      annual: {
        planId: 'annual',
        packageId: '$rc_annual',
        price: 44.99,
        priceString: '£44.99',
        pricePerMonthString: '£3.75',
        currencyCode: 'GBP',
        trialEligible: true,
      },
      monthly: {
        planId: 'monthly',
        packageId: '$rc_monthly',
        price: 5.99,
        priceString: '£5.99',
        currencyCode: 'GBP',
        trialEligible: false,
      },
    });

    const pricing = await loadV2PaywallPricing();

    expect(pricing.annual.priceLabel).toBe('£44.99');
    expect(pricing.annual.currencyCode).toBe('GBP');
    expect(pricing.annual.trialEligible).toBe(true);
    expect(pricing.monthly.priceLabel).toBe('£5.99');
    expect(planPerMonthLabel(pricing.annual)).toBe('£3.75');
    expect(resolvePricingStatus(pricing)).toBe('ready');
  });

  it('derives a localised per-month label from a real amount when the store omits one', () => {
    const pricing = toV2PaywallPricing({
      annual: { planId: 'annual', packageId: '$rc_annual', price: 60, priceString: '$60.00', currencyCode: 'USD' },
    } as Parameters<typeof toV2PaywallPricing>[0]);
    expect(planPerMonthLabel(pricing.annual)).toMatch(/5[.,]00/);
  });

  it('is `unavailable` when no plan is purchasable and never invents a price', () => {
    const pricing = toV2PaywallPricing({});
    expect(pricing.annual.priceLabel).toBeNull();
    expect(pricing.annual.purchasable).toBe(false);
    expect(resolvePricingStatus(pricing)).toBe('unavailable');
    // Falls back to the configured package id so a retry can still purchase.
    expect(packageIdForPlan(pricing, 'annual')).toBe('$rc_annual');
  });
});
